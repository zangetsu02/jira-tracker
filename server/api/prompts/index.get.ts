import { eq } from 'drizzle-orm'
import { useDB } from '~~/server/utils/db'
import { analysisPrompts } from '~~/server/database/schema'
import { requireAuth } from '~~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const db = await useDB(event)

  const prompts = await db
    .select()
    .from(analysisPrompts)
    .where(eq(analysisPrompts.userId, user.id))
    .orderBy(analysisPrompts.createdAt)

  return prompts
})
