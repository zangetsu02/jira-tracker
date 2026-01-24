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

  await db.update(analysisResults).set({
    jiraIssueKey: body.jiraIssueKey
  }).where(eq(analysisResults.id, parseInt(id)))

  return { success: true }
})
