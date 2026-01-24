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
      message: 'Jira non configurato. Salva prima la configurazione Jira.'
    })
  }

  console.log('Testing Jira connection to:', config[0].url)

  const client = new JiraClient({
    url: config[0].url,
    username: config[0].username,
    password: config[0].password
  })

  const result = await client.testConnection()

  console.log('Jira test result:', result)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      message: result.error || 'Test connessione fallito'
    })
  }

  return {
    success: true,
    user: result.user
  }
})
