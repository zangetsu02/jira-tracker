import { eq } from 'drizzle-orm'
import { useDB } from '~~/server/utils/db'
import { microservices, analysisResults } from '~~/server/database/schema'
import { analyzeMicroservice } from '~~/server/utils/claude'
import {
  findLegacyPath,
  buildJiraDescription,
  issueTypeToStatus,
  severityToConfidence
} from '~~/server/utils/analysis'

export default defineEventHandler(async (event) => {
  const name = getRouterParam(event, 'name')

  if (!name) {
    throw createError({ statusCode: 400, message: 'Microservice name is required' })
  }

  const db = await useDB(event)

  const [ms] = await db
    .select()
    .from(microservices)
    .where(eq(microservices.name, name))
    .limit(1)

  if (!ms) {
    throw createError({ statusCode: 404, message: 'Microservice not found' })
  }

  const legacyPath = await findLegacyPath(ms.path)
  const pdfPath = ms.pdfPath || null

  if (!pdfPath && !legacyPath) {
    throw createError({
      statusCode: 400,
      message: 'Nessun PDF o codice legacy trovato. Carica un PDF o assicurati che esista la cartella docs/aspx nel microservizio.'
    })
  }

  try {
    // Delete old analysis results
    await db.delete(analysisResults).where(eq(analysisResults.microserviceId, ms.id))

    // Run analysis
    const result = await analyzeMicroservice(ms.path, legacyPath, pdfPath)

    // Save issues as analysis results
    const savedResults = await Promise.all(
      result.issues.map(async (issue) => {
        const [saved] = await db
          .insert(analysisResults)
          .values({
            microserviceId: ms.id,
            usecaseId: null,
            status: issueTypeToStatus(issue.type),
            confidence: severityToConfidence(issue.severity),
            evidence: issue.microserviceReference || '',
            notes: buildJiraDescription(issue)
          })
          .returning()
        return saved
      })
    )

    // Update microservice
    await db
      .update(microservices)
      .set({
        lastAnalysis: new Date(),
        lastReport: JSON.stringify(result, null, 2),
        legacyPath
      })
      .where(eq(microservices.id, ms.id))

    return {
      success: true,
      issues: result.issues,
      results: savedResults
    }
  } catch (error) {
    throw createError({
      statusCode: 500,
      message: `Analisi fallita: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`
    })
  }
})
