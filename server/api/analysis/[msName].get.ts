import { eq } from 'drizzle-orm'
import { useDB } from '~~/server/utils/db'
import { microservices, usecases, analysisResults } from '~~/server/database/schema'

export default defineEventHandler(async (event) => {
  const msName = getRouterParam(event, 'msName')
  const query = getQuery(event)
  const includeIgnored = query.includeIgnored === 'true'

  if (!msName) {
    throw createError({
      statusCode: 400,
      message: 'Microservice name is required'
    })
  }

  const db = await useDB(event)

  const ms = await db
    .select()
    .from(microservices)
    .where(eq(microservices.name, msName))
    .limit(1)

  if (!ms[0]) {
    throw createError({
      statusCode: 404,
      message: 'Microservice not found'
    })
  }

  const msUsecases = await db
    .select()
    .from(usecases)
    .where(eq(usecases.microserviceId, ms[0].id))

  const msAnalyses = await db
    .select()
    .from(analysisResults)
    .where(eq(analysisResults.microserviceId, ms[0].id))

  const resultsWithUsecases = msAnalyses.map(analysis => ({
    ...analysis,
    usecase: msUsecases.find(uc => uc.id === analysis.usecaseId)
  }))

  // Separa risultati attivi da ignorati
  const activeResults = resultsWithUsecases.filter(r => !r.ignored)
  const ignoredResults = resultsWithUsecases.filter(r => r.ignored)

  // Summary conta solo risultati attivi
  const summary = {
    total: activeResults.length,
    implemented: activeResults.filter(r => r.status === 'implemented').length,
    partial: activeResults.filter(r => r.status === 'partial').length,
    missing: activeResults.filter(r => r.status === 'missing').length,
    unclear: activeResults.filter(r => r.status === 'unclear').length,
    ignored: ignoredResults.length
  }

  return {
    microservice: ms[0],
    results: includeIgnored ? ignoredResults : activeResults,
    summary
  }
})
