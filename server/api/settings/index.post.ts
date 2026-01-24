import { eq } from 'drizzle-orm'
import { useDB } from '~~/server/utils/db'
import { appSettings } from '~~/server/database/schema'
import { requireAuth } from '~~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const db = await useDB(event)
  const body = await readBody(event)

  const { microservicesDirectory, microservicesPattern } = body

  if (!microservicesDirectory) {
    throw createError({
      statusCode: 400,
      message: 'microservicesDirectory is required'
    })
  }

  const existing = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.userId, user.id))
    .limit(1)

  if (existing[0]) {
    await db
      .update(appSettings)
      .set({
        microservicesDirectory,
        microservicesPattern: microservicesPattern || 'sil-ms-*',
        updatedAt: new Date()
      })
      .where(eq(appSettings.userId, user.id))
  } else {
    await db
      .insert(appSettings)
      .values({
        userId: user.id,
        microservicesDirectory,
        microservicesPattern: microservicesPattern || 'sil-ms-*'
      })
  }

  return { success: true }
})
