import { eq } from 'drizzle-orm'
import { useDB } from '~~/server/utils/db'
import { microservices, usecases, analysisResults } from '~~/server/database/schema'

export default defineEventHandler(async (event) => {
  const name = getRouterParam(event, 'name')

  if (!name) {
    throw createError({
      statusCode: 400,
      message: 'Microservice name is required'
    })
  }

  const db = await useDB(event)

  const ms = await db
    .select()
    .from(microservices)
    .where(eq(microservices.name, name))
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

  return {
    ...ms[0],
    usecases: msUsecases,
    analyses: msAnalyses.map(analysis => ({
      ...analysis,
      usecase: msUsecases.find(uc => uc.id === analysis.usecaseId)
    }))
  }
})
