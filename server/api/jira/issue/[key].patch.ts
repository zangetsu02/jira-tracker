import { eq } from 'drizzle-orm'
import { useDB } from '~~/server/utils/db'
import { jiraConfig } from '~~/server/database/schema'
import { JiraClient } from '~~/server/utils/jira'
import { requireAuth } from '~~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const key = getRouterParam(event, 'key')
  const body = await readBody(event)

  if (!key) {
    throw createError({
      statusCode: 400,
      message: 'Issue key is required'
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
    await client.updateIssue(key, {
      summary: body.summary,
      description: body.description,
      priority: body.priority,
      labels: body.labels,
      assignee: body.assignee
    })

    return { success: true }
  } catch (error) {
    throw createError({
      statusCode: 500,
      message: `Failed to update issue: ${error instanceof Error ? error.message : 'Unknown error'}`
    })
  }
})
