import { eq } from 'drizzle-orm'
import { useDB } from '~~/server/utils/db'
import { jiraConfig } from '~~/server/database/schema'
import { JiraClient } from '~~/server/utils/jira'
import { requireAuth } from '~~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const key = getRouterParam(event, 'key')

  if (!key) {
    throw createError({ statusCode: 400, message: 'Issue key is required' })
  }

  const user = await requireAuth(event)
  const db = await useDB(event)

  const body = await readBody<{ transitionId: string }>(event)

  if (!body.transitionId) {
    throw createError({ statusCode: 400, message: 'Transition ID is required' })
  }

  const config = await db
    .select()
    .from(jiraConfig)
    .where(eq(jiraConfig.userId, user.id))
    .limit(1)

  if (!config[0]) {
    throw createError({ statusCode: 400, message: 'Jira configuration not found' })
  }

  const client = new JiraClient({
    url: config[0].url,
    username: config[0].username,
    password: config[0].password
  })

  await client.doTransition(key, body.transitionId)

  return { success: true }
})
