import { desc, isNotNull } from 'drizzle-orm'
import { useDB } from '~~/server/utils/db'
import { microservices } from '~~/server/database/schema'

export default defineEventHandler(async (event) => {
  const db = await useDB(event)

  const history = await db
    .select()
    .from(microservices)
    .where(isNotNull(microservices.lastAnalysis))
    .orderBy(desc(microservices.lastAnalysis))
    .limit(50)

  return history
})
