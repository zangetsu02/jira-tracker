export interface AnalysisPromptParams {
  microservicePath: string
  legacyPath: string | null
  pdfPath: string | null
}

const PROMPT_TEMPLATE = `# Analisi Microservizio

Sei un senior software engineer specializzato in migrazione da sistemi legacy ASPX a microservizi.

## Contesto

- **Microservizio**: \`{{microservicePath}}\`
{{#if pdfPath}}- **Documento requisiti (PDF)**: \`{{pdfPath}}\`{{/if}}
{{#if legacyPath}}- **Codice legacy ASPX**: \`{{legacyPath}}\`{{/if}}

## Obiettivo

Analizza il microservizio e identifica issue da risolvere.

## Cosa analizzare

1. **Requisiti** (dal PDF): estrai use case e verifica copertura
2. **Implementazione**: mappa endpoint, servizi, repository
3. **Legacy** (se presente): confronta comportamento

## Tipi di Issue

- \`missing_implementation\`: Funzionalita assente
- \`partial_implementation\`: Funzionalita incompleta
- \`legacy_mismatch\`: Comportamento diverso dal legacy
- \`behavior_difference\`: Differenza rispetto ai requisiti
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
- Usa null per campi non applicabili`

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
