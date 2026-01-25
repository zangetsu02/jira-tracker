import { eq } from 'drizzle-orm'
import { useDB } from '~~/server/utils/db'
import { jiraConfig } from '~~/server/database/schema'
import { requireAuth } from '~~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const db = await useDB(event)
  const body = await readBody(event)

  const { url, username, password, defaultProject, baseLabel, titlePrefix } = body

  if (!url || !username) {
    throw createError({
      statusCode: 400,
      message: 'url e username sono obbligatori'
    })
  }

  const existing = await db
    .select()
    .from(jiraConfig)
    .where(eq(jiraConfig.userId, user.id))
    .limit(1)

  if (existing[0]) {
    // Update - keep existing password if not provided
    await db
      .update(jiraConfig)
      .set({
        url,
        username,
        ...(password && { password }),
        defaultProject,
        baseLabel: baseLabel || null,
        titlePrefix: titlePrefix || null,
        updatedAt: new Date()
      })
      .where(eq(jiraConfig.userId, user.id))
  } else {
    // Insert - password is required for new config
    if (!password) {
      throw createError({
        statusCode: 400,
        message: 'La password è obbligatoria per la prima configurazione'
      })
    }
    await db
      .insert(jiraConfig)
      .values({
        userId: user.id,
        url,
        username,
        password,
        defaultProject,
        baseLabel: baseLabel || null,
        titlePrefix: titlePrefix || null
      })
  }

  return { success: true }
})
