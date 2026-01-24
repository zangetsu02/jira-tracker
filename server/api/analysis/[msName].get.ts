import { eq } from 'drizzle-orm'
import { useDB } from '~~/server/utils/db'
import { microservices, usecases, analysisResults } from '~~/server/database/schema'

export default defineEventHandler(async (event) => {
  const msName = getRouterParam(event, 'msName')

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

  const summary = {
    total: resultsWithUsecases.length,
    implemented: resultsWithUsecases.filter(r => r.status === 'implemented').length,
    partial: resultsWithUsecases.filter(r => r.status === 'partial').length,
    missing: resultsWithUsecases.filter(r => r.status === 'missing').length,
    unclear: resultsWithUsecases.filter(r => r.status === 'unclear').length
  }

  return {
    microservice: ms[0],
    results: resultsWithUsecases,
    summary
  }
})
