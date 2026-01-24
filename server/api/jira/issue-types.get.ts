import { eq } from 'drizzle-orm'
import { useDB } from '~~/server/utils/db'
import { jiraConfig } from '~~/server/database/schema'
import { requireAuth } from '~~/server/utils/auth'
import { JiraClient } from '~~/server/utils/jira'

export default defineEventHandler(async (event) => {
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
      message: 'Jira not configured'
    })
  }

  if (!config[0].defaultProject) {
    throw createError({
      statusCode: 400,
      message: 'Default Jira project not configured'
    })
  }

  const client = new JiraClient({
    url: config[0].url,
    username: config[0].username,
    password: config[0].password
  })

  try {
    const issueTypes = await client.getIssueTypes(config[0].defaultProject)
    return issueTypes.filter(t => !t.subtask)
  } catch (error) {
    throw createError({
      statusCode: 500,
      message: `Failed to get issue types: ${error instanceof Error ? error.message : 'Unknown error'}`
    })
  }
})
