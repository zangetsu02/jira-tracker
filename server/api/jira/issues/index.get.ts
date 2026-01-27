import { eq } from 'drizzle-orm'
import { useDB } from '~~/server/utils/db'
import { jiraConfig } from '~~/server/database/schema'
import { JiraClient } from '~~/server/utils/jira'
import { requireAuth } from '~~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const status = query.status as string | undefined
  const search = query.search as string | undefined

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
      message: 'Jira configuration not found. Please configure Jira in Settings.'
    })
  }

  const client = new JiraClient({
    url: config[0].url,
    username: config[0].username,
    password: config[0].password,
    defaultProject: config[0].defaultProject || undefined
  })

  try {
    const result = await client.searchIssues({
      project: config[0].defaultProject || undefined,
      status: status || undefined,
      search: search || undefined,
      maxResults: 500
    })

    return {
      total: result.total,
      issues: result.issues.map(issue => ({
        key: issue.key,
        url: client.buildIssueUrl(issue.key),
        summary: issue.fields.summary,
        description: issue.fields.description,
        status: issue.fields.status?.name,
        priority: issue.fields.priority?.name,
        assignee: issue.fields.assignee?.displayName,
        assigneeId: issue.fields.assignee?.accountId,
        reporter: issue.fields.reporter?.displayName,
        labels: issue.fields.labels || [],
        updated: issue.fields.updated,
        created: issue.fields.created
      }))
    }
  } catch (error) {
    throw createError({
      statusCode: 500,
      message: `Failed to fetch issues: ${error instanceof Error ? error.message : 'Unknown error'}`
    })
  }
})
