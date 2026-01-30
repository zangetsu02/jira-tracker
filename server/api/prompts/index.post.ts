import { eq } from 'drizzle-orm'
import { useDB } from '~~/server/utils/db'
import { analysisPrompts } from '~~/server/database/schema'
import { requireAuth } from '~~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const db = await useDB(event)
  const body = await readBody(event)

  const { name, description, content, isDefault } = body

  if (!name || !content) {
    throw createError({
      statusCode: 400,
      message: 'name e content sono obbligatori'
    })
  }

  // If setting as default, remove default from other prompts
  if (isDefault) {
    await db
      .update(analysisPrompts)
      .set({ isDefault: false })
      .where(eq(analysisPrompts.userId, user.id))
  }

  const [newPrompt] = await db
    .insert(analysisPrompts)
    .values({
      userId: user.id,
      name,
      description: description || null,
      content,
      isDefault: isDefault || false
    })
    .returning()

  return newPrompt
})
