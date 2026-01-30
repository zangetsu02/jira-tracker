import { eq, and } from 'drizzle-orm'
import { useDB } from '~~/server/utils/db'
import { analysisPrompts } from '~~/server/database/schema'
import { requireAuth } from '~~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const db = await useDB(event)
  const id = Number(getRouterParam(event, 'id'))

  if (isNaN(id)) {
    throw createError({
      statusCode: 400,
      message: 'ID non valido'
    })
  }

  // Check ownership
  const [existing] = await db
    .select()
    .from(analysisPrompts)
    .where(and(
      eq(analysisPrompts.id, id),
      eq(analysisPrompts.userId, user.id)
    ))
    .limit(1)

  if (!existing) {
    throw createError({
      statusCode: 404,
      message: 'Prompt non trovato'
    })
  }

  await db
    .delete(analysisPrompts)
    .where(eq(analysisPrompts.id, id))

  return { success: true }
})
