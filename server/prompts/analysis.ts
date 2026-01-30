import type { UseCase } from '~~/shared/utils/types'
import type { ExistingJiraIssue } from '~~/server/utils/claude'

export interface AnalysisPromptParams {
  microservicePath: string
  legacyPath: string | null
  pdfPath: string | null
  usecases?: UseCase[]
  existingJiraIssues?: ExistingJiraIssue[]
}

const PROMPT_TEMPLATE = `# Analisi Microservizio

Sei un senior software engineer specializzato in migrazione da sistemi legacy ASPX a microservizi Java/Spring Boot.

IMPORTANTE: Rispondi SEMPRE in ITALIANO. Tutti i titoli, descrizioni e contenuti delle issue devono essere in lingua italiana.

## Contesto

- **Microservizio**: \`{{microservicePath}}\` (Java/Spring Boot)
{{#if legacyPath}}- **Codice legacy ASPX**: \`{{legacyPath}}\`{{/if}}
{{#if pdfPath}}- **Documento requisiti (PDF)**: \`{{pdfPath}}\`{{/if}}

## Stack Tecnologico del Microservizio
- Java 17+
- Spring Boot 3.x
- Spring Web (REST API)
- Spring Data JPA
- Maven/Gradle

{{#if usecases}}
## Use Case da Verificare

I seguenti use case sono stati estratti dal documento dei requisiti e devono essere verificati nel codice:

{{usecasesList}}
{{/if}}

{{#if existingJiraIssues}}
## ISSUE GIA' TRACCIATE IN JIRA - ESCLUDERE DALL'OUTPUT

ATTENZIONE: Le seguenti issue sono GIA' state segnalate e tracciate in Jira.
NON includerle nel JSON di output, anche se riformulate con parole diverse.

{{existingJiraIssuesList}}

REGOLA CRITICA: Prima di aggiungere una issue al JSON, verifica che NON sia semanticamente equivalente a una delle issue sopra elencate. Se il problema e' lo stesso (anche con titolo diverso), NON includerlo.
{{/if}}

## Obiettivo

Analizza il microservizio e identifica issue da risolvere confrontando:
{{#if usecases}}
1. **Use Case estratti**: verifica che ogni use case sia implementato correttamente
{{/if}}
{{#if legacyPath}}
2. **Codice Legacy**: confronta il comportamento con il sistema ASPX originale
{{/if}}
3. **Implementazione**: mappa endpoint, servizi, repository e verifica completezza

## Tipi di Issue

- \`missing_implementation\`: Funzionalita assente (use case non implementato)
- \`partial_implementation\`: Funzionalita incompleta
- \`legacy_mismatch\`: Comportamento diverso dal legacy
- \`behavior_difference\`: Differenza rispetto ai requisiti/use case
- \`missing_test\`: Funzionalita non testata
- \`security_concern\`: Problema di sicurezza
- \`performance_concern\`: Problema di performance
- \`documentation_gap\`: Documentazione mancante

## Valori ammessi

- **severity**: critical, high, medium, low
- **priority**: highest, high, medium, low, lowest
- **estimatedEffort**: XS, S, M, L, XL

## Output

Restituisci ESCLUSIVAMENTE un oggetto JSON valido con questa struttura esatta:

{"issues":[{"code":"ISSUE-001","title":"Titolo","type":"missing_implementation","severity":"high","priority":"high","description":"Descrizione","relatedUseCases":["UC-001"],"legacyReference":null,"microserviceReference":"src/file.ts:45","acceptanceCriteria":["Criterio 1"],"suggestedLabels":["backend"],"estimatedEffort":"M"}]}

REGOLE CRITICHE:
- LINGUA: Scrivi TUTTO in ITALIANO (titoli, descrizioni, criteri di accettazione, note)
- EFFICIENZA: Usa massimo 8-10 tool calls. Leggi SOLO i file essenziali
- STRUTTURA JAVA: Cerca in src/main/java per Controller, Service, Repository, Entity
- Usa Glob per trovare i file, poi leggi solo quelli rilevanti
- NON leggere tutti i file - concentrati su *Controller.java, *Service.java, *Repository.java
- IMPORTANTE: L'ultima cosa che devi fare e' SEMPRE generare il JSON di output. Non terminare mai con una tool call.
- DOPO aver analizzato, genera IMMEDIATAMENTE il JSON come testo (NON come tool call)
- Output SOLO JSON valido, nessun testo prima o dopo
- Nessun markdown, nessun code fence, nessun commento
- JSON deve iniziare con { e terminare con }
- NON scrivere frasi come "Based on my analysis..." - vai direttamente al JSON
- Usa null per campi non applicabili
- In relatedUseCases usa i codici degli use case forniti sopra
- Se non ci sono issue, restituisci {"issues":[]}
- RICORDA: Devi SEMPRE concludere con l'output JSON testuale, mai con una tool call`

/**
 * Build prompt from custom template string
 */
export function buildPromptFromTemplate(template: string, params: AnalysisPromptParams): string {
  let result = template

  // Replace simple placeholder
  result = result.replace(/\{\{microservicePath\}\}/g, params.microservicePath)

  // Handle conditional blocks
  result = processConditionalBlock(result, 'pdfPath', params.pdfPath)
  result = processConditionalBlock(result, 'legacyPath', params.legacyPath)

  // Handle use cases
  if (params.usecases && params.usecases.length > 0) {
    const usecasesList = params.usecases.map((uc) => {
      const lines = [`### ${uc.code || 'UC'}: ${uc.title || 'Senza titolo'}`]
      if (uc.description) lines.push(`**Descrizione**: ${uc.description}`)
      if (uc.actors) lines.push(`**Attori**: ${uc.actors}`)
      if (uc.preconditions) lines.push(`**Precondizioni**: ${uc.preconditions}`)
      if (uc.mainFlow) lines.push(`**Flusso principale**: ${uc.mainFlow}`)
      if (uc.alternativeFlows) lines.push(`**Flussi alternativi**: ${uc.alternativeFlows}`)
      return lines.join('\n')
    }).join('\n\n')

    result = result.replace(/\{\{usecasesList\}\}/g, usecasesList)
    result = processConditionalBlock(result, 'usecases', 'true')
  } else {
    result = processConditionalBlock(result, 'usecases', null)
  }

  // Handle existing Jira issues
  if (params.existingJiraIssues && params.existingJiraIssues.length > 0) {
    const existingIssuesList = params.existingJiraIssues.map((issue) => {
      let entry = `- **${issue.jiraKey}**: ${issue.title}`
      if (issue.description) {
        const firstLine = issue.description.split('\n')[0].substring(0, 200)
        entry += `\n  > ${firstLine}`
      }
      return entry
    }).join('\n')

    result = result.replace(/\{\{existingJiraIssuesList\}\}/g, existingIssuesList)
    result = processConditionalBlock(result, 'existingJiraIssues', 'true')
  } else {
    result = processConditionalBlock(result, 'existingJiraIssues', null)
  }

  return result
}

/**
 * Build analysis prompt from template
 */
export function buildAnalysisPrompt(params: AnalysisPromptParams): string {
  let template = PROMPT_TEMPLATE

  // Replace simple placeholder
  template = template.replace(/\{\{microservicePath\}\}/g, params.microservicePath)

  // Handle conditional blocks
  template = processConditionalBlock(template, 'pdfPath', params.pdfPath)
  template = processConditionalBlock(template, 'legacyPath', params.legacyPath)

  // Handle use cases
  if (params.usecases && params.usecases.length > 0) {
    const usecasesList = params.usecases.map((uc) => {
      const lines = [`### ${uc.code || 'UC'}: ${uc.title || 'Senza titolo'}`]
      if (uc.description) lines.push(`**Descrizione**: ${uc.description}`)
      if (uc.actors) lines.push(`**Attori**: ${uc.actors}`)
      if (uc.preconditions) lines.push(`**Precondizioni**: ${uc.preconditions}`)
      if (uc.mainFlow) lines.push(`**Flusso principale**: ${uc.mainFlow}`)
      if (uc.alternativeFlows) lines.push(`**Flussi alternativi**: ${uc.alternativeFlows}`)
      return lines.join('\n')
    }).join('\n\n')

    template = template.replace(/\{\{usecasesList\}\}/g, usecasesList)
    template = processConditionalBlock(template, 'usecases', 'true')
  } else {
    template = processConditionalBlock(template, 'usecases', null)
  }

  // Handle existing Jira issues
  if (params.existingJiraIssues && params.existingJiraIssues.length > 0) {
    const existingIssuesList = params.existingJiraIssues.map((issue) => {
      let entry = `- **${issue.jiraKey}**: ${issue.title}`
      if (issue.description) {
        // Add first line of description for context
        const firstLine = issue.description.split('\n')[0].substring(0, 200)
        entry += `\n  > ${firstLine}`
      }
      return entry
    }).join('\n')

    template = template.replace(/\{\{existingJiraIssuesList\}\}/g, existingIssuesList)
    template = processConditionalBlock(template, 'existingJiraIssues', 'true')
  } else {
    template = processConditionalBlock(template, 'existingJiraIssues', null)
  }

  return template
}

/**
 * Process conditional block: {{#if var}}...{{else}}...{{/if}} or {{#if var}}...{{/if}}
 */
function processConditionalBlock(template: string, varName: string, value: string | null): string {
  const ifElsePattern = new RegExp(`\\{\\{#if ${varName}\\}\\}([\\s\\S]*?)\\{\\{else\\}\\}([\\s\\S]*?)\\{\\{\\/if\\}\\}`, 'g')
  const ifOnlyPattern = new RegExp(`\\{\\{#if ${varName}\\}\\}([\\s\\S]*?)\\{\\{\\/if\\}\\}`, 'g')
  const varPattern = new RegExp(`\\{\\{${varName}\\}\\}`, 'g')

  if (value) {
    template = template.replace(varPattern, value)
    template = template.replace(ifElsePattern, '$1')
    template = template.replace(ifOnlyPattern, '$1')
  } else {
    template = template.replace(ifElsePattern, '$2')
    template = template.replace(ifOnlyPattern, '')
  }

  return template
}
