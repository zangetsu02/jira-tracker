import { eq } from 'drizzle-orm'
import { useDB } from '~~/server/utils/db'
import { analysisResults } from '~~/server/database/schema'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const body = await readBody(event)

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Analysis ID is required'
    })
  }

  const db = await useDB(event)

  const updateData: Record<string, unknown> = {}

  if (body.jiraIssueKey !== undefined) {
    updateData.jiraIssueKey = body.jiraIssueKey
  }

  if (body.ignored !== undefined) {
    updateData.ignored = body.ignored
    updateData.ignoredAt = body.ignored ? new Date() : null
  }

  if (Object.keys(updateData).length === 0) {
    throw createError({
      statusCode: 400,
      message: 'No fields to update'
    })
  }

  await db.update(analysisResults).set(updateData).where(eq(analysisResults.id, parseInt(id)))

  return { success: true }
})
