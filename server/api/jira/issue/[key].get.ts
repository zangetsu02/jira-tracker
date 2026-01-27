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
    const issue = await client.getIssue(key)

    // Extract attachments and create proxy URLs
    const rawAttachments = (issue.fields.attachment as Array<{
      id: string
      filename: string
      mimeType: string
      size: number
      content: string
      thumbnail?: string
      created: string
    }>) || []

    const attachments = rawAttachments.map(a => ({
      id: a.id,
      filename: a.filename,
      mimeType: a.mimeType,
      size: a.size,
      // Pass the original Jira URL encoded, so our proxy can fetch it with auth
      content: `/api/jira/attachment-proxy?url=${encodeURIComponent(a.content)}`,
      thumbnail: a.thumbnail ? `/api/jira/attachment-proxy?url=${encodeURIComponent(a.thumbnail)}` : undefined,
      created: a.created
    }))

    return {
      key: issue.key,
      url: client.buildIssueUrl(issue.key),
      summary: issue.fields.summary as string,
      description: issue.fields.description as string | null,
      status: (issue.fields.status as { name: string })?.name,
      priority: (issue.fields.priority as { name: string } | null)?.name,
      assignee: issue.fields.assignee
        ? {
            displayName: (issue.fields.assignee as { displayName: string }).displayName,
            accountId: (issue.fields.assignee as { accountId?: string }).accountId,
            name: (issue.fields.assignee as { name?: string }).name
          }
        : null,
      reporter: issue.fields.reporter
        ? {
            displayName: (issue.fields.reporter as { displayName: string }).displayName
          }
        : null,
      labels: (issue.fields.labels as string[]) || [],
      created: issue.fields.created as string,
      updated: issue.fields.updated as string,
      issueType: (issue.fields.issuetype as { name: string })?.name,
      attachments
    }
  } catch (error) {
    throw createError({
      statusCode: 500,
      message: `Failed to fetch issue: ${error instanceof Error ? error.message : 'Unknown error'}`
    })
  }
})
