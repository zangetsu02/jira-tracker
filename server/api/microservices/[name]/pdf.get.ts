import { eq } from 'drizzle-orm'
import { readFile } from 'fs/promises'
import { useDB } from '~~/server/utils/db'
import { microservices } from '~~/server/database/schema'

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

  if (!ms[0].pdfPath) {
    throw createError({
      statusCode: 404,
      message: 'No PDF associated with this microservice'
    })
  }

  try {
    const pdfBuffer = await readFile(ms[0].pdfPath)

    setHeader(event, 'Content-Type', 'application/pdf')
    setHeader(event, 'Content-Disposition', `inline; filename="${ms[0].pdfFilename || 'document.pdf'}"`)

    return pdfBuffer
  } catch {
    throw createError({
      statusCode: 404,
      message: 'PDF file not found on disk'
    })
  }
})
