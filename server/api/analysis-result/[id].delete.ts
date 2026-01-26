import { eq } from 'drizzle-orm'
import { useDB } from '~~/server/utils/db'
import { analysisResults } from '~~/server/database/schema'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Analysis ID is required'
    })
  }

  const db = await useDB(event)

  const result = await db.delete(analysisResults)
    .where(eq(analysisResults.id, parseInt(id)))
    .returning()

  if (result.length === 0) {
    throw createError({
      statusCode: 404,
      message: 'Analysis result not found'
    })
  }

  return { success: true }
})
