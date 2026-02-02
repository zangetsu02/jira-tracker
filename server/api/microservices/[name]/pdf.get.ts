import { eq, and } from 'drizzle-orm'
import { readFile } from 'fs/promises'
import { useDB } from '~~/server/utils/db'
import { microservices, microservicePdfs } from '~~/server/database/schema'

export default defineEventHandler(async (event) => {
  const name = getRouterParam(event, 'name')
  const query = getQuery(event)
  const pdfId = query.id ? parseInt(query.id as string, 10) : null

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

  // If pdfId is provided, get specific PDF from new table
  if (pdfId) {
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

    try {
      const pdfBuffer = await readFile(pdf[0].path)
      setHeader(event, 'Content-Type', 'application/pdf')
      setHeader(event, 'Content-Disposition', `inline; filename="${pdf[0].filename}"`)
      return pdfBuffer
    } catch {
      throw createError({
        statusCode: 404,
        message: 'PDF file not found on disk'
      })
    }
  }

  // Fallback: try new table first (get first PDF)
  const pdfs = await db
    .select()
    .from(microservicePdfs)
    .where(eq(microservicePdfs.microserviceId, ms[0].id))
    .limit(1)

  if (pdfs[0]) {
    try {
      const pdfBuffer = await readFile(pdfs[0].path)
      setHeader(event, 'Content-Type', 'application/pdf')
      setHeader(event, 'Content-Disposition', `inline; filename="${pdfs[0].filename}"`)
      return pdfBuffer
    } catch {
      throw createError({
        statusCode: 404,
        message: 'PDF file not found on disk'
      })
    }
  }

  // Legacy fallback: try old microservices.pdfPath field
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
