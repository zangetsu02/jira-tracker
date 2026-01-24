import { eq } from 'drizzle-orm'
import { useDB } from '~~/server/utils/db'
import { microservices, usecases } from '~~/server/database/schema'

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

  return msUsecases
})
