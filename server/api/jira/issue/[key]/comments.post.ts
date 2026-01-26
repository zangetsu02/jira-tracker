import { eq } from 'drizzle-orm'
import { useDB } from '~~/server/utils/db'
import { jiraConfig } from '~~/server/database/schema'
import { JiraClient } from '~~/server/utils/jira'
import { requireAuth } from '~~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const key = getRouterParam(event, 'key')

  if (!key) {
    throw createError({
      statusCode: 400,
      message: 'Issue key is required'
    })
  }

  const body = await readBody<{ body: string }>(event)

  if (!body?.body?.trim()) {
    throw createError({
      statusCode: 400,
      message: 'Comment body is required'
    })
  }

  const user = await requireAuth(event)
  const db = await useDB(event)

  const config = await db
    .select()
    .from(jiraConfig)
    .where(eq(jiraConfig.userId, user.id))
    .limit(1)

  if (!config[0]) {
    throw createError({
      statusCode: 400,
      message: 'Jira configuration not found'
    })
  }

  const client = new JiraClient({
    url: config[0].url,
    username: config[0].username,
    password: config[0].password
  })

  try {
    const comment = await client.addComment(key, body.body.trim())

    return {
      id: comment.id,
      body: comment.body,
      author: {
        displayName: comment.author.displayName,
        avatarUrl: comment.author.avatarUrls?.['48x48'] || comment.author.avatarUrls?.['32x32']
      },
      created: comment.created,
      updated: comment.updated
    }
  } catch (error) {
    throw createError({
      statusCode: 500,
      message: `Failed to add comment: ${error instanceof Error ? error.message : 'Unknown error'}`
    })
  }
})
