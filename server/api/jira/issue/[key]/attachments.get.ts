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
        const attachments = await client.getAttachments(key)

        // Return attachments with proxy URLs instead of direct Jira URLs
        return {
            attachments: attachments.map(a => ({
                id: a.id,
                filename: a.filename,
                mimeType: a.mimeType,
                size: a.size,
                // Use proxy URL for content (requires auth)
                content: `/api/jira/attachment/${a.id}`,
                // Thumbnail also needs proxy - extract ID from thumbnail URL if available
                thumbnail: a.thumbnail ? `/api/jira/attachment/${a.id}?thumbnail=true` : undefined,
                created: a.created
            }))
        }
    } catch (error) {
        throw createError({
            statusCode: 500,
            message: `Failed to fetch attachments: ${error instanceof Error ? error.message : 'Unknown error'}`
        })
    }
})
