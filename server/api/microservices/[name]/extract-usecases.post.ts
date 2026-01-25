import { eq } from 'drizzle-orm'
import { useDB } from '~~/server/utils/db'
import { microservices, usecases } from '~~/server/database/schema'
import { extractUseCasesFromPdf } from '~~/server/utils/claude'

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

  if (!ms.pdfPath) {
    throw createError({
      statusCode: 400,
      message: 'Nessun PDF caricato per questo microservizio'
    })
  }

  // Set up SSE
  setHeader(event, 'Content-Type', 'text/event-stream')
  setHeader(event, 'Cache-Control', 'no-cache')
  setHeader(event, 'Connection', 'keep-alive')

  const sendEvent = (type: string, data: unknown) => {
    event.node.res.write(`data: ${JSON.stringify({ type, ...data as object })}\n\n`)
  }

  try {
    sendEvent('status', { step: 'init', message: 'Inizializzazione estrazione...', progress: 5 })

    // Delete old use cases for this microservice
    sendEvent('status', { step: 'cleanup', message: 'Pulizia use case precedenti...', progress: 10 })
    await db.delete(usecases).where(eq(usecases.microserviceId, ms.id))

    sendEvent('status', { step: 'claude_start', message: 'Avvio estrazione con Claude...', progress: 15 })

    // Extract use cases from PDF
    const result = await extractUseCasesFromPdf(ms.pdfPath, (message, phase) => {
      const progress = phase === 'preparing' ? 20 : phase === 'analyzing' ? 50 : phase === 'parsing' ? 90 : 60
      sendEvent('chunk', { text: message, phase, progress })
    })

    sendEvent('status', { step: 'saving', message: `Salvataggio ${result.usecases.length} use case...`, progress: 95 })

    // Save use cases to database
    const savedUseCases = []
    for (const uc of result.usecases) {
      const [inserted] = await db.insert(usecases).values({
        microserviceId: ms.id,
        code: uc.code || null,
        title: uc.title || null,
        description: uc.description || null,
        actors: uc.actors || null,
        preconditions: uc.preconditions || null,
        mainFlow: uc.mainFlow || null,
        alternativeFlows: uc.alternativeFlows || null
      }).returning()
      savedUseCases.push(inserted)
    }

    sendEvent('complete', {
      success: true,
      usecasesCount: savedUseCases.length,
      usecases: savedUseCases,
      progress: 100
    })
  } catch (error) {
    sendEvent('error', {
      message: error instanceof Error ? error.message : 'Errore sconosciuto'
    })
  } finally {
    event.node.res.end()
  }
})
