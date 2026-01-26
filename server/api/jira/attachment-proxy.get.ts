import { eq } from 'drizzle-orm'
import { useDB } from '~~/server/utils/db'
import { jiraConfig } from '~~/server/database/schema'
import { requireAuth } from '~~/server/utils/auth'

export default defineEventHandler(async (event) => {
    const query = getQuery(event)
    const url = query.url as string

    if (!url) {
        throw createError({
            statusCode: 400,
            message: 'URL is required'
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

    // Validate that the URL is from the configured Jira instance
    const baseUrl = config[0].url.replace(/\/$/, '')
    if (!url.startsWith(baseUrl)) {
        throw createError({
            statusCode: 403,
            message: 'URL is not from the configured Jira instance'
        })
    }

    const auth = Buffer.from(`${config[0].username}:${config[0].password}`).toString('base64')

    try {
        const response = await fetch(url, {
            headers: {
                'Authorization': `Basic ${auth}`
            }
        })

        if (!response.ok) {
            throw new Error(`Failed to fetch: ${response.status}`)
        }

        // Get content type from response
        const contentType = response.headers.get('content-type') || 'application/octet-stream'

        // Set response headers
        setResponseHeader(event, 'Content-Type', contentType)
        setResponseHeader(event, 'Cache-Control', 'private, max-age=3600')

        // Return the binary data
        const buffer = await response.arrayBuffer()
        return new Uint8Array(buffer)
    } catch (error) {
        console.error('Error fetching attachment:', error)
        throw createError({
            statusCode: 500,
            message: `Failed to fetch attachment: ${error instanceof Error ? error.message : 'Unknown error'}`
        })
    }
})
