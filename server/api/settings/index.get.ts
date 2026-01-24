import { eq } from 'drizzle-orm'
import { useDB } from '~~/server/utils/db'
import { appSettings } from '~~/server/database/schema'
import { requireAuth } from '~~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const db = await useDB(event)

  const settings = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.userId, user.id))
    .limit(1)

  if (!settings[0]) {
    const config = useRuntimeConfig()
    return {
      microservicesDirectory: config.microservicesDir || '',
      microservicesPattern: 'sil-ms-*'
    }
  }

  return settings[0]
})
