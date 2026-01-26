import { eq } from 'drizzle-orm'
import { useDB } from '~~/server/utils/db'
import { microservices } from '~~/server/database/schema'

export default defineEventHandler(async (event) => {
  const name = getRouterParam(event, 'name')
  const body = await readBody(event)

  if (!name) {
    throw createError({ statusCode: 400, message: 'Nome microservizio richiesto' })
  }

  const { excluded } = body

  if (typeof excluded !== 'boolean') {
    throw createError({ statusCode: 400, message: 'Campo excluded richiesto (boolean)' })
  }

  const db = await useDB(event)

  const [ms] = await db
    .select()
    .from(microservices)
    .where(eq(microservices.name, name))
    .limit(1)

  if (!ms) {
    throw createError({ statusCode: 404, message: 'Microservizio non trovato' })
  }

  await db
    .update(microservices)
    .set({ excluded })
    .where(eq(microservices.name, name))

  return { success: true, excluded }
})
