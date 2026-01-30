import { eq, and, isNull } from 'drizzle-orm'
import { useDB } from '~~/server/utils/db'
import { microservices, analysisResults } from '~~/server/database/schema'
import { runClaudePrompt } from '~~/server/utils/claude'

interface DeduplicateResult {
  duplicatesToDelete: number[]
}

export default defineEventHandler(async (event) => {
  const msName = getRouterParam(event, 'msName')

  if (!msName) {
    throw createError({ statusCode: 400, message: 'Microservice name is required' })
  }

  const db = await useDB(event)

  // Get microservice
  const [ms] = await db
    .select()
    .from(microservices)
    .where(eq(microservices.name, msName))
    .limit(1)

  if (!ms) {
    throw createError({ statusCode: 404, message: 'Microservice not found' })
  }

  // Get ALL analysis results (both with and without Jira)
  const allResults = await db
    .select()
    .from(analysisResults)
    .where(eq(analysisResults.microserviceId, ms.id))

  // Separate results with and without Jira
  const withJira = allResults.filter(r => r.jiraIssueKey)
  const withoutJira = allResults.filter(r => !r.jiraIssueKey)

  if (withoutJira.length === 0) {
    return { deleted: 0, message: 'Tutte le issue sono già collegate a Jira' }
  }

  if (allResults.length < 2) {
    return { deleted: 0, message: 'Non ci sono abbastanza risultati da confrontare' }
  }

  // Build prompt with clear distinction between protected (Jira) and deletable issues
  const jiraIssuesList = withJira.map(r => {
    const title = r.jiraIssueSummary || r.evidence || r.notes?.substring(0, 300) || 'Senza titolo'
    return `[JIRA:${r.jiraIssueKey}] ${title}`
  }).join('\n')

  const nonJiraIssuesList = withoutJira.map(r => {
    const title = r.evidence || r.notes?.substring(0, 300) || 'Senza titolo'
    return `[ID:${r.id}] ${title}`
  }).join('\n')

  const prompt = `Sei un analista che deve identificare issue DUPLICATE.

ISSUE GIA' IN JIRA (NON ELIMINABILI - usale come riferimento):
${jiraIssuesList || '(nessuna)'}

ISSUE DA ANALIZZARE (possono essere eliminate se duplicate):
${nonJiraIssuesList}

COMPITO:
Identifica quali issue "DA ANALIZZARE" sono DUPLICATE SEMANTICHE di:
1. Issue già in Jira (stesso problema descritto diversamente)
2. Altre issue "DA ANALIZZARE" (in questo caso tieni la più descrittiva)

Due issue sono duplicate se descrivono lo STESSO problema anche con parole diverse.
Esempi di duplicati:
- "Gestione allegati non implementata" = "Endpoint per caricamento allegati mancante"
- "Controllo stato prima della modifica" = "Verifica stato protocollazione nella modifica"
- "Visualizzazione integrazioni non implementata" = "Endpoint visualizzazione integrazioni mancante"

Rispondi SOLO con un JSON contenente gli ID delle issue DA ELIMINARE:
{"duplicatesToDelete":[123,456,789]}

Se non ci sono duplicati:
{"duplicatesToDelete":[]}`

  console.log('[deduplicate] Prompt:', prompt)

  try {
    const response = await runClaudePrompt(prompt)
    console.log('[deduplicate] Response:', response)
    
    // Parse response
    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return { deleted: 0, message: 'Nessun duplicato trovato' }
    }

    const result: DeduplicateResult = JSON.parse(jsonMatch[0])
    
    if (!result.duplicatesToDelete || result.duplicatesToDelete.length === 0) {
      return { deleted: 0, message: 'Nessun duplicato identificato' }
    }

    // Delete duplicates (only those without Jira)
    let deletedCount = 0
    const deletedIds: number[] = []

    for (const deleteId of result.duplicatesToDelete) {
      // Verify the ID exists and doesn't have a Jira issue
      const [toDelete] = await db
        .select()
        .from(analysisResults)
        .where(
          and(
            eq(analysisResults.id, deleteId),
            eq(analysisResults.microserviceId, ms.id),
            isNull(analysisResults.jiraIssueKey)
          )
        )
        .limit(1)

      if (toDelete) {
        await db.delete(analysisResults).where(eq(analysisResults.id, deleteId))
        deletedCount++
        deletedIds.push(deleteId)
      }
    }

    return {
      deleted: deletedCount,
      deletedIds,
      message: `Eliminati ${deletedCount} duplicati`
    }
  } catch (error) {
    console.error('[deduplicate] Error:', error)
    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Errore durante la deduplica'
    })
  }
})
