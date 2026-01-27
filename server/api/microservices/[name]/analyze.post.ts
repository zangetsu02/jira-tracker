import { eq } from 'drizzle-orm'
import { useDB } from '~~/server/utils/db'
import { microservices, analysisResults, usecases } from '~~/server/database/schema'
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

  // Fetch use cases
  const msUsecases = await db
    .select({ id: usecases.id, code: usecases.code })
    .from(usecases)
    .where(eq(usecases.microserviceId, ms.id))

  if (!pdfPath && !legacyPath && msUsecases.length === 0) {
    throw createError({
      statusCode: 400,
      message: 'Nessun PDF, codice legacy o use case trovato.'
    })
  }

  try {
    // Delete old analysis results
    await db.delete(analysisResults).where(eq(analysisResults.microserviceId, ms.id))

    // Run analysis
    const result = await analyzeMicroservice(ms.path, legacyPath, pdfPath)

    // Collect use case codes with issues
    const usecaseCodesWithIssues = new Set<string>()
    for (const issue of result.issues) {
      for (const code of issue.relatedUseCases) {
        usecaseCodesWithIssues.add(code.toUpperCase())
      }
    }

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

    // Save implemented status for use cases without issues
    for (const uc of msUsecases) {
      const ucCode = (uc.code || '').toUpperCase()
      if (ucCode && !usecaseCodesWithIssues.has(ucCode)) {
        await db.insert(analysisResults).values({
          microserviceId: ms.id,
          usecaseId: uc.id,
          status: 'implemented',
          confidence: 'high',
          evidence: `Use case ${uc.code} implementato correttamente`,
          notes: null
        })
      }
    }

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
