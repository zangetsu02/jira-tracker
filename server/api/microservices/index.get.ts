import { eq } from 'drizzle-orm'
import { listMicroservices } from '~~/server/utils/scanner'
import { useDB } from '~~/server/utils/db'
import { microservices, analysisResults, microservicePdfs } from '~~/server/database/schema'

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

        // Count PDFs from new table
        const pdfs = dbRecord
          ? await db
              .select()
              .from(microservicePdfs)
              .where(eq(microservicePdfs.microserviceId, dbRecord.id))
          : []

        // Escludi risultati ignorati dalle statistiche
        const activeAnalyses = analyses.filter(a => !a.ignored)
        const implementedCount = activeAnalyses.filter(a => a.status === 'implemented').length
        const totalCount = activeAnalyses.length

        return {
          ...dbRecord,
          pdfCount: pdfs.length,
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
