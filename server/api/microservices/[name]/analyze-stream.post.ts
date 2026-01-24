import { eq } from 'drizzle-orm'
import { useDB } from '~~/server/utils/db'
import { microservices, analysisResults } from '~~/server/database/schema'
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

  if (!pdfPath && !legacyPath) {
    throw createError({
      statusCode: 400,
      message: 'Nessun PDF o codice legacy trovato.'
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
