import { eq } from 'drizzle-orm'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
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

  const storedFilename = `${name}-${Date.now()}.pdf`
  const filepath = join(uploadsDir, storedFilename)

  await writeFile(filepath, file.data)

  const originalFilename = file.filename || storedFilename

  const [inserted] = await db
    .insert(microservicePdfs)
    .values({
      microserviceId: ms[0].id,
      filename: originalFilename,
      path: filepath
    })
    .returning()

  return {
    success: true,
    id: inserted.id,
    filename: originalFilename,
    path: filepath
  }
})
