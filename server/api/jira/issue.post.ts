import { eq } from 'drizzle-orm'
import { useDB } from '~~/server/utils/db'
import { jiraConfig, analysisResults, usecases, microservices } from '~~/server/database/schema'
import { requireAuth } from '~~/server/utils/auth'
import { JiraClient } from '~~/server/utils/jira'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const db = await useDB(event)
  const body = await readBody(event)

  // Support both direct parameters and analysisResultId
  const { analysisResultId, summary: directSummary, description: directDescription, priority, labels, assignee } = body

  const config = await db
    .select()
    .from(jiraConfig)
    .where(eq(jiraConfig.userId, user.id))
    .limit(1)

  if (!config[0]) {
    throw createError({
      statusCode: 400,
      message: 'Jira not configured'
    })
  }

  if (!config[0].defaultProject) {
    throw createError({
      statusCode: 400,
      message: 'Default Jira project not configured'
    })
  }

  const client = new JiraClient({
    url: config[0].url,
    username: config[0].username,
    password: config[0].password
  })

  // Direct issue creation (without analysisResultId)
  if (directSummary && !analysisResultId) {
    try {
      const issue = await client.createIssue({
        project: config[0].defaultProject,
        summary: directSummary,
        description: directDescription || '',
        issueType: 'Task',
        priority,
        labels,
        assignee
      })

      return {
        success: true,
        key: issue.key,
        url: client.buildIssueUrl(issue.key)
      }
    } catch (error) {
      throw createError({
        statusCode: 500,
        message: `Failed to create Jira issue: ${error instanceof Error ? error.message : 'Unknown error'}`
      })
    }
  }

  // Original flow with analysisResultId
  if (!analysisResultId) {
    throw createError({
      statusCode: 400,
      message: 'Either summary or analysisResultId is required'
    })
  }

  const analysis = await db
    .select()
    .from(analysisResults)
    .where(eq(analysisResults.id, analysisResultId))
    .limit(1)

  if (!analysis[0]) {
    throw createError({
      statusCode: 404,
      message: 'Analysis result not found'
    })
  }

  if (analysis[0].jiraIssueKey) {
    throw createError({
      statusCode: 400,
      message: `Issue already created: ${analysis[0].jiraIssueKey}`
    })
  }

  const usecase = analysis[0].usecaseId
    ? await db
        .select()
        .from(usecases)
        .where(eq(usecases.id, analysis[0].usecaseId))
        .limit(1)
    : null

  const ms = await db
    .select()
    .from(microservices)
    .where(eq(microservices.id, analysis[0].microserviceId!))
    .limit(1)

  const uc = usecase?.[0]
  const msName = ms[0]?.name || 'Unknown'

  const summary = directSummary || `[${msName}] Implementare UC ${uc?.code || ''}: ${uc?.title || 'Use Case'}`

  const description = directDescription || `
*Microservizio:* ${msName}
*Use Case:* ${uc?.code || 'N/A'} - ${uc?.title || 'N/A'}
*Status Analisi:* ${analysis[0].status}
*Confidence:* ${analysis[0].confidence}

h2. Descrizione Use Case
${uc?.description || 'N/A'}

h2. Attori
${uc?.actors || 'N/A'}

h2. Precondizioni
${uc?.preconditions || 'N/A'}

h2. Flusso Principale
${uc?.mainFlow || 'N/A'}

h2. Flussi Alternativi
${uc?.alternativeFlows || 'N/A'}

h2. Note Analisi
${analysis[0].notes || 'Nessuna nota'}

h2. Evidenze
${analysis[0].evidence || 'Nessuna evidenza'}
  `.trim()

  try {
    const issue = await client.createIssue({
      project: config[0].defaultProject,
      summary,
      description,
      issueType: 'Task',
      priority,
      labels: labels || [msName],
      assignee
    })

    await db
      .update(analysisResults)
      .set({ jiraIssueKey: issue.key })
      .where(eq(analysisResults.id, analysisResultId))

    return {
      success: true,
      key: issue.key,
      url: client.buildIssueUrl(issue.key)
    }
  } catch (error) {
    throw createError({
      statusCode: 500,
      message: `Failed to create Jira issue: ${error instanceof Error ? error.message : 'Unknown error'}`
    })
  }
})
