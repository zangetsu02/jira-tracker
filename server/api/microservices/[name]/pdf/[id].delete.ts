import { eq, and } from 'drizzle-orm'
import { unlink } from 'fs/promises'
import { useDB } from '~~/server/utils/db'
import { microservices, microservicePdfs } from '~~/server/database/schema'

export default defineEventHandler(async (event) => {
  const name = getRouterParam(event, 'name')
  const id = getRouterParam(event, 'id')

  if (!name) {
    throw createError({
      statusCode: 400,
      message: 'Microservice name is required'
    })
  }

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'PDF id is required'
    })
  }

  const pdfId = parseInt(id, 10)
  if (isNaN(pdfId)) {
    throw createError({
      statusCode: 400,
      message: 'Invalid PDF id'
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

  const pdf = await db
    .select()
    .from(microservicePdfs)
    .where(and(
      eq(microservicePdfs.id, pdfId),
      eq(microservicePdfs.microserviceId, ms[0].id)
    ))
    .limit(1)

  if (!pdf[0]) {
    throw createError({
      statusCode: 404,
      message: 'PDF not found'
    })
  }

  // Delete file from disk
  try {
    await unlink(pdf[0].path)
  } catch {
    // Ignore file not found errors
  }

  // Delete from database
  await db
    .delete(microservicePdfs)
    .where(eq(microservicePdfs.id, pdfId))

  return {
    success: true,
    id: pdfId
  }
})
