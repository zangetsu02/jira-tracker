import { eq } from 'drizzle-orm'
import { useDB } from '~~/server/utils/db'
import { microservices, analysisResults } from '~~/server/database/schema'
import { analyzeMicroservice } from '~~/server/utils/claude'
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

    if (data.type !== 'start-analysis') {
      return
    }

    const { microserviceName } = data
    if (!microserviceName) {
      peer.send(JSON.stringify({ type: 'error', message: 'Nome microservizio richiesto' }))
      return
    }

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

    const legacyPath = await findLegacyPath(ms.path)
    const pdfPath = ms.pdfPath || null

    if (!pdfPath && !legacyPath) {
      peer.send(JSON.stringify({ type: 'error', message: 'Nessun PDF o codice legacy trovato.' }))
      return
    }

    try {
      sendStatus(peer, 'init', 'Inizializzazione analisi...', 5)
      sendStatus(peer, 'cleanup', 'Pulizia dati precedenti...', 8)

      await db.delete(analysisResults).where(eq(analysisResults.microserviceId, ms.id))

      sendStatus(peer, 'claude_start', 'Avvio analisi con Claude...', 15)

      let lastPhase = ''
      const result = await analyzeMicroservice(ms.path, legacyPath, pdfPath, (chunk, phase) => {
        const progress = PHASE_PROGRESS[phase] ?? 50

        if (phase !== lastPhase) {
          lastPhase = phase
          sendStatus(peer, phase, chunk, progress)
        }

        peer.send(JSON.stringify({ type: 'chunk', text: chunk, phase, progress }))
      })

      sendStatus(peer, 'saving', `Salvataggio ${result.issues.length} issue...`, 98)

      await saveAnalysisResults(db, ms.id, result)
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

function parseMessage(message: unknown): { type: string; microserviceName?: string } | null {
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

async function saveAnalysisResults(
  db: Awaited<ReturnType<typeof useDB>>,
  microserviceId: number,
  result: IssuesOnlyResult
): Promise<void> {
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
