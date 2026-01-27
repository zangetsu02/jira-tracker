import { eq } from 'drizzle-orm'
import { useDB } from '~~/server/utils/db'
import { microservices, analysisResults, usecases } from '~~/server/database/schema'
import { analyzeMicroservice } from '~~/server/utils/claude'
import {
  findLegacyPath,
  buildJiraDescription,
  issueTypeToStatus,
  severityToConfidence
} from '~~/server/utils/analysis'

export default defineEventHandler(async (event) => {
  const name = getRouterParam(event, 'name')

  if (!name) {
    throw createError({ statusCode: 400, message: 'Microservice name is required' })
  }

  const db = await useDB(event)

  const [ms] = await db
    .select()
    .from(microservices)
    .where(eq(microservices.name, name))
    .limit(1)

  if (!ms) {
    throw createError({ statusCode: 404, message: 'Microservice not found' })
  }

  const legacyPath = await findLegacyPath(ms.path)
  const pdfPath = ms.pdfPath || null

  // Fetch use cases
  const msUsecases = await db
    .select({ id: usecases.id, code: usecases.code })
    .from(usecases)
    .where(eq(usecases.microserviceId, ms.id))

  if (!pdfPath && !legacyPath && msUsecases.length === 0) {
    throw createError({
      statusCode: 400,
      message: 'Nessun PDF, codice legacy o use case trovato.'
    })
  }

  // Set up SSE
  setHeader(event, 'Content-Type', 'text/event-stream')
  setHeader(event, 'Cache-Control', 'no-cache')
  setHeader(event, 'Connection', 'keep-alive')

  const sendEvent = (type: string, data: unknown) => {
    event.node.res.write(`data: ${JSON.stringify({ type, data })}\n\n`)
  }

  try {
    sendEvent('status', { step: 'init', message: 'Inizializzazione analisi...' })

    // Delete old data
    sendEvent('status', { step: 'cleanup', message: 'Pulizia dati precedenti...' })
    await db.delete(analysisResults).where(eq(analysisResults.microserviceId, ms.id))

    sendEvent('status', { step: 'claude_start', message: 'Avvio analisi con Claude...' })

    // Run analysis with progress updates
    const result = await analyzeMicroservice(ms.path, legacyPath, pdfPath, (message, phase) => {
      sendEvent('chunk', { text: message, phase })
    })

    sendEvent('status', { step: 'saving', message: `Salvataggio ${result.issues.length} issue...` })

    // Collect use case codes with issues
    const usecaseCodesWithIssues = new Set<string>()
    for (const issue of result.issues) {
      for (const code of issue.relatedUseCases) {
        usecaseCodesWithIssues.add(code.toUpperCase())
      }
    }

    // Save issues
    for (const issue of result.issues) {
      await db.insert(analysisResults).values({
        microserviceId: ms.id,
        usecaseId: null,
        status: issueTypeToStatus(issue.type),
        confidence: severityToConfidence(issue.severity),
        evidence: issue.microserviceReference || '',
        notes: buildJiraDescription(issue)
      })
    }

    // Save implemented status for use cases without issues
    for (const uc of msUsecases) {
      const ucCode = (uc.code || '').toUpperCase()
      if (ucCode && !usecaseCodesWithIssues.has(ucCode)) {
        await db.insert(analysisResults).values({
          microserviceId: ms.id,
          usecaseId: uc.id,
          status: 'implemented',
          confidence: 'high',
          evidence: `Use case ${uc.code} implementato correttamente`,
          notes: null
        })
      }
    }

    // Update microservice
    await db.update(microservices).set({
      lastAnalysis: new Date(),
      lastReport: JSON.stringify(result, null, 2),
      legacyPath
    }).where(eq(microservices.id, ms.id))

    sendEvent('complete', {
      success: true,
      issuesCount: result.issues.length,
      issues: result.issues
    })
  } catch (error) {
    sendEvent('error', {
      message: error instanceof Error ? error.message : 'Errore sconosciuto'
    })
  } finally {
    event.node.res.end()
  }
})
