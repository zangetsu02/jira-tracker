import { eq } from 'drizzle-orm'
import { useDB } from '~~/server/utils/db'
import { jiraConfig } from '~~/server/database/schema'
import { requireAuth } from '~~/server/utils/auth'
import { JiraClient } from '~~/server/utils/jira'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const label = getRouterParam(event, 'label')

  if (!label) {
    throw createError({
      statusCode: 400,
      message: 'Label is required'
    })
  }

  const db = await useDB(event)

  const config = await db
    .select()
    .from(jiraConfig)
    .where(eq(jiraConfig.userId, user.id))
    .limit(1)

  if (!config[0]) {
    throw createError({
      statusCode: 400,
      message: 'Jira non configurato'
    })
  }

  const client = new JiraClient({
    url: config[0].url,
    username: config[0].username,
    password: config[0].password
  })

  try {
    const result = await client.searchByLabel(label)

    return {
      total: result.total,
      issues: result.issues.map(issue => ({
        key: issue.key,
        url: client.buildIssueUrl(issue.key),
        summary: issue.fields.summary,
        status: issue.fields.status?.name,
        priority: issue.fields.priority?.name,
        assignee: issue.fields.assignee?.displayName,
        updated: issue.fields.updated,
        created: issue.fields.created
      }))
    }
  } catch (error) {
    throw createError({
      statusCode: 500,
      message: `Errore ricerca Jira: ${error instanceof Error ? error.message : 'Unknown error'}`
    })
  }
})
