import { eq } from 'drizzle-orm'
import { listMicroservices } from '~~/server/utils/scanner'
import { useDB } from '~~/server/utils/db'
import { microservices, analysisResults } from '~~/server/database/schema'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const db = await useDB(event)

  const msDir = config.microservicesDir
  if (!msDir) {
    throw createError({
      statusCode: 500,
      message: 'NUXT_MICROSERVICES_DIR not configured'
    })
  }

  try {
    const msList = await listMicroservices(msDir)

    const result = await Promise.all(
      msList.map(async (ms) => {
        const existing = await db
          .select()
          .from(microservices)
          .where(eq(microservices.name, ms.name))
          .limit(1)

        let dbRecord = existing[0]

        if (!dbRecord) {
          const inserted = await db
            .insert(microservices)
            .values({
              name: ms.name,
              path: ms.path
            })
            .returning()
          dbRecord = inserted[0]
        }

        const analyses = dbRecord
          ? await db
              .select()
              .from(analysisResults)
              .where(eq(analysisResults.microserviceId, dbRecord.id))
          : []

        const implementedCount = analyses.filter(a => a.status === 'implemented').length
        const totalCount = analyses.length

        return {
          ...dbRecord,
          hasAnalysis: totalCount > 0,
          lastAnalysisStatus: totalCount === 0
            ? undefined
            : implementedCount === totalCount
              ? 'success'
              : implementedCount > 0
                ? 'partial'
                : 'issues',
          useCaseCount: totalCount,
          implementedCount
        }
      })
    )

    return result
  } catch (error) {
    throw createError({
      statusCode: 500,
      message: `Failed to list microservices: ${error instanceof Error ? error.message : 'Unknown error'}`
    })
  }
})
