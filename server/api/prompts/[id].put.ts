import { eq, and } from 'drizzle-orm'
import { useDB } from '~~/server/utils/db'
import { analysisPrompts } from '~~/server/database/schema'
import { requireAuth } from '~~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const db = await useDB(event)
  const id = Number(getRouterParam(event, 'id'))
  const body = await readBody(event)

  if (isNaN(id)) {
    throw createError({
      statusCode: 400,
      message: 'ID non valido'
    })
  }

  const { name, description, content, isDefault } = body

  if (!name || !content) {
    throw createError({
      statusCode: 400,
      message: 'name e content sono obbligatori'
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

  // If setting as default, remove default from other prompts
  if (isDefault) {
    await db
      .update(analysisPrompts)
      .set({ isDefault: false })
      .where(eq(analysisPrompts.userId, user.id))
  }

  const [updated] = await db
    .update(analysisPrompts)
    .set({
      name,
      description: description || null,
      content,
      isDefault: isDefault || false,
      updatedAt: new Date()
    })
    .where(eq(analysisPrompts.id, id))
    .returning()

  return updated
})
