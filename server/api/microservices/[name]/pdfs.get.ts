import { eq } from 'drizzle-orm'
import { useDB } from '~~/server/utils/db'
import { microservices, microservicePdfs } from '~~/server/database/schema'

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

  const pdfs = await db
    .select()
    .from(microservicePdfs)
    .where(eq(microservicePdfs.microserviceId, ms[0].id))
    .orderBy(microservicePdfs.createdAt)

  return pdfs
})
