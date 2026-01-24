import { eq } from 'drizzle-orm'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
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

  const formData = await readMultipartFormData(event)

  if (!formData || formData.length === 0) {
    throw createError({
      statusCode: 400,
      message: 'No file uploaded'
    })
  }

  const file = formData.find(f => f.name === 'pdf')

  if (!file || !file.data) {
    throw createError({
      statusCode: 400,
      message: 'PDF file is required'
    })
  }

  const uploadsDir = join(process.cwd(), 'uploads', 'pdfs')
  await mkdir(uploadsDir, { recursive: true })

  const filename = `${name}-${Date.now()}.pdf`
  const filepath = join(uploadsDir, filename)

  await writeFile(filepath, file.data)

  await db
    .update(microservices)
    .set({
      pdfFilename: file.filename || filename,
      pdfPath: filepath
    })
    .where(eq(microservices.id, ms[0].id))

  return {
    success: true,
    filename: file.filename || filename,
    path: filepath
  }
})
