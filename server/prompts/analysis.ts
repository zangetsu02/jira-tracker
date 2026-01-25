import type { UseCase } from '~~/shared/utils/types'

export interface AnalysisPromptParams {
  microservicePath: string
  legacyPath: string | null
  pdfPath: string | null
  usecases?: UseCase[]
}

const PROMPT_TEMPLATE = `# Analisi Microservizio

Sei un senior software engineer specializzato in migrazione da sistemi legacy ASPX a microservizi.

## Contesto

- **Microservizio**: \`{{microservicePath}}\`
{{#if legacyPath}}- **Codice legacy ASPX**: \`{{legacyPath}}\`{{/if}}
{{#if pdfPath}}- **Documento requisiti (PDF)**: \`{{pdfPath}}\`{{/if}}

{{#if usecases}}
## Use Case da Verificare

I seguenti use case sono stati estratti dal documento dei requisiti e devono essere verificati nel codice:

{{usecasesList}}
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
- Output SOLO JSON, nessun testo prima o dopo
- Nessun markdown, nessun code fence, nessun commento
- JSON deve iniziare con { e terminare con }
- Usa null per campi non applicabili
- In relatedUseCases usa i codici degli use case forniti sopra`

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
    const usecasesList = params.usecases.map(uc => {
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
