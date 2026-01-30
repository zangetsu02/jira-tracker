import { eq, and, isNull, isNotNull } from 'drizzle-orm'
import { useDB } from '~~/server/utils/db'
import { microservices, analysisResults, usecases, analysisPrompts, microservicePdfs } from '~~/server/database/schema'
import {
  analyzeMicroservice,
  extractUseCasesFromPdfs,
  type ExistingJiraIssue,
  type UseCaseExtractionResult
} from '~~/server/utils/claude'
import {
  findLegacyPath,
  buildJiraDescription,
  issueTypeToStatus,
  severityToConfidence,
  type IssuesOnlyResult
} from '~~/server/utils/analysis'

// ============================================================================
// CONSTANTS
// ============================================================================

const PHASE_PROGRESS: Record<string, number> = {
  starting: 15,
  preparing: 18,
  info: 20,
  analyzing: 50,
  cost: 80,
  parsing: 90,
  complete: 100
}

// ============================================================================
// WEBSOCKET HANDLER
// ============================================================================

export default defineWebSocketHandler({
  async message(peer, message) {
    const data = parseMessage(message)
    if (!data) {
      peer.send(JSON.stringify({ type: 'error', message: 'Messaggio non valido' }))
      return
    }

    const { microserviceName } = data
    if (!microserviceName) {
      peer.send(JSON.stringify({ type: 'error', message: 'Nome microservizio richiesto' }))
      return
    }

    // Route to appropriate handler
    if (data.type === 'start-extraction') {
      await handleExtraction(peer, microserviceName)
    } else if (data.type === 'start-analysis') {
      await handleAnalysis(peer, microserviceName, data.promptId)
    }
  },

  open(peer) {
    console.log('WebSocket connected:', peer.id)
  },

  close(peer) {
    console.log('WebSocket disconnected:', peer.id)
  }
})

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function parseMessage(message: unknown): { type: string, microserviceName?: string, promptId?: number } | null {
  try {
    const msgText = typeof message === 'string' ? message : (message as { text: () => string }).text()
    return JSON.parse(msgText)
  } catch {
    return null
  }
}

function sendStatus(peer: { send: (msg: string) => void }, step: string, message: string, progress: number): void {
  peer.send(JSON.stringify({ type: 'status', step, message, progress }))
}

// ============================================================================
// EXTRACTION HANDLER
// ============================================================================

async function handleExtraction(
  peer: { send: (msg: string) => void },
  microserviceName: string
): Promise<void> {
  const db = await useDB()

  const [ms] = await db
    .select()
    .from(microservices)
    .where(eq(microservices.name, microserviceName))
    .limit(1)

  if (!ms) {
    peer.send(JSON.stringify({ type: 'error', message: 'Microservizio non trovato' }))
    return
  }

  // Get all PDFs from new table
  const pdfs = await db
    .select()
    .from(microservicePdfs)
    .where(eq(microservicePdfs.microserviceId, ms.id))
    .orderBy(microservicePdfs.createdAt)

  // Collect all PDF paths (new table + legacy field for backward compatibility)
  const pdfPaths: string[] = pdfs.map(p => p.path)
  if (pdfPaths.length === 0 && ms.pdfPath) {
    pdfPaths.push(ms.pdfPath)
  }

  if (pdfPaths.length === 0) {
    peer.send(JSON.stringify({ type: 'error', message: 'Nessun PDF caricato' }))
    return
  }

  try {
    sendStatus(peer, 'init', 'Inizializzazione estrazione...', 5)
    sendStatus(peer, 'cleanup', 'Pulizia use case precedenti...', 10)

    await db.delete(usecases).where(eq(usecases.microserviceId, ms.id))

    sendStatus(peer, 'claude_start', `Avvio estrazione con Claude da ${pdfPaths.length} PDF...`, 15)

    let lastPhase = ''
    const result = await extractUseCasesFromPdfs(pdfPaths, (chunk, phase) => {
      const progress = PHASE_PROGRESS[phase] ?? 50

      if (phase !== lastPhase) {
        lastPhase = phase
        sendStatus(peer, phase, chunk, progress)
      }

      peer.send(JSON.stringify({ type: 'chunk', text: chunk, phase, progress }))
    })

    sendStatus(peer, 'saving', `Salvataggio ${result.usecases.length} use case...`, 95)

    await saveUseCases(db, ms.id, result)

    peer.send(JSON.stringify({
      type: 'complete',
      usecasesCount: result.usecases.length,
      progress: 100
    }))
  } catch (error) {
    peer.send(JSON.stringify({
      type: 'error',
      message: error instanceof Error ? error.message : 'Errore sconosciuto'
    }))
  }
}

// ============================================================================
// ANALYSIS HANDLER
// ============================================================================

async function handleAnalysis(
  peer: { send: (msg: string) => void },
  microserviceName: string,
  promptId?: number
): Promise<void> {
  const db = await useDB()

  // Fetch custom prompt if provided
  let customPromptContent: string | null = null
  if (promptId) {
    const [prompt] = await db
      .select()
      .from(analysisPrompts)
      .where(eq(analysisPrompts.id, promptId))
      .limit(1)
    if (prompt) {
      customPromptContent = prompt.content
    }
  }

  const [ms] = await db
    .select()
    .from(microservices)
    .where(eq(microservices.name, microserviceName))
    .limit(1)

  if (!ms) {
    peer.send(JSON.stringify({ type: 'error', message: 'Microservizio non trovato' }))
    return
  }

  console.log('[handleAnalysis] Analyzing microservice:', microserviceName, 'path:', ms.path)

  const legacyPath = await findLegacyPath(ms.path)
  const pdfPath = ms.pdfPath || null

  // Fetch use cases from database
  const msUsecases = await db
    .select()
    .from(usecases)
    .where(eq(usecases.microserviceId, ms.id))

  // Require either use cases, PDF, or legacy code
  if (msUsecases.length === 0 && !pdfPath && !legacyPath) {
    peer.send(JSON.stringify({ type: 'error', message: 'Nessun use case estratto, PDF o codice legacy trovato. Estrai prima gli use case dal PDF.' }))
    return
  }

  // Fetch existing analysis results with Jira issues linked
  const existingJiraResults = await db
    .select({
      jiraIssueKey: analysisResults.jiraIssueKey,
      evidence: analysisResults.evidence,
      notes: analysisResults.notes
    })
    .from(analysisResults)
    .where(
      and(
        eq(analysisResults.microserviceId, ms.id),
        isNotNull(analysisResults.jiraIssueKey)
      )
    )

  // Map to ExistingJiraIssue format
  const existingJiraIssues: ExistingJiraIssue[] = existingJiraResults.map(r => ({
    jiraKey: r.jiraIssueKey!,
    title: r.evidence || 'Issue senza titolo',
    description: r.notes || undefined
  }))

  console.log('[handleAnalysis] Found', existingJiraIssues.length, 'existing Jira issues to exclude')

  try {
    sendStatus(peer, 'init', 'Inizializzazione analisi...', 5)
    sendStatus(peer, 'cleanup', 'Pulizia dati precedenti (mantenendo issue Jira)...', 8)

    // Delete only results WITHOUT a linked Jira issue
    await db.delete(analysisResults).where(
      and(
        eq(analysisResults.microserviceId, ms.id),
        isNull(analysisResults.jiraIssueKey)
      )
    )

    sendStatus(peer, 'loading_usecases', `Caricamento ${msUsecases.length} use case...`, 12)
    sendStatus(peer, 'claude_start', `Avvio analisi con Claude (${existingJiraIssues.length} issue Jira esistenti)...`, 15)

    let lastPhase = ''
    const result = await analyzeMicroservice(
      ms.path,
      legacyPath,
      pdfPath,
      (chunk, phase) => {
        const progress = PHASE_PROGRESS[phase] ?? 50

        if (phase !== lastPhase) {
          lastPhase = phase
          sendStatus(peer, phase, chunk, progress)
        }

        peer.send(JSON.stringify({ type: 'chunk', text: chunk, phase, progress }))
      },
      msUsecases,
      customPromptContent,
      existingJiraIssues
    )

    sendStatus(peer, 'saving', `Salvataggio ${result.issues.length} issue...`, 98)

    await saveAnalysisResults(db, ms.id, result, msUsecases)
    await updateMicroservice(db, ms.id, result, legacyPath)

    peer.send(JSON.stringify({
      type: 'complete',
      issuesCount: result.issues.length,
      progress: 100
    }))
  } catch (error) {
    peer.send(JSON.stringify({
      type: 'error',
      message: error instanceof Error ? error.message : 'Errore sconosciuto'
    }))
  }
}

// ============================================================================
// DATABASE HELPERS
// ============================================================================

async function saveUseCases(
  db: Awaited<ReturnType<typeof useDB>>,
  microserviceId: number,
  result: UseCaseExtractionResult
): Promise<void> {
  for (const uc of result.usecases) {
    await db.insert(usecases).values({
      microserviceId,
      code: uc.code || null,
      title: uc.title || null,
      description: uc.description || null,
      actors: uc.actors || null,
      preconditions: uc.preconditions || null,
      mainFlow: uc.mainFlow || null,
      alternativeFlows: uc.alternativeFlows || null
    })
  }
}

async function saveAnalysisResults(
  db: Awaited<ReturnType<typeof useDB>>,
  microserviceId: number,
  result: IssuesOnlyResult,
  msUsecases: { id: number, code: string | null }[]
): Promise<void> {
  // Collect all use case codes that have issues
  const usecaseCodesWithIssues = new Set<string>()
  for (const issue of result.issues) {
    if (issue.relatedUseCases && Array.isArray(issue.relatedUseCases)) {
      for (const code of issue.relatedUseCases) {
        usecaseCodesWithIssues.add(code.toUpperCase())
      }
    }
  }

  // Save issues (problems found)
  for (const issue of result.issues) {
    await db.insert(analysisResults).values({
      microserviceId,
      usecaseId: null,
      status: issueTypeToStatus(issue.type),
      confidence: severityToConfidence(issue.severity),
      evidence: issue.title,
      notes: buildJiraDescription(issue)
    })
  }

  // Save implemented status for use cases without issues
  for (const uc of msUsecases) {
    const ucCode = (uc.code || '').toUpperCase()
    if (ucCode && !usecaseCodesWithIssues.has(ucCode)) {
      await db.insert(analysisResults).values({
        microserviceId,
        usecaseId: uc.id,
        status: 'implemented',
        confidence: 'high',
        evidence: `Use case ${uc.code} implementato correttamente`,
        notes: null
      })
    }
  }
}

async function updateMicroservice(
  db: Awaited<ReturnType<typeof useDB>>,
  microserviceId: number,
  result: IssuesOnlyResult,
  legacyPath: string | null
): Promise<void> {
  await db
    .update(microservices)
    .set({
      lastAnalysis: new Date(),
      lastReport: JSON.stringify(result, null, 2),
      legacyPath
    })
    .where(eq(microservices.id, microserviceId))
}
