import type { AnalysisResult, UseCase } from '~~/shared/utils/types'

interface ChatContext {
  microserviceName: string
  result: AnalysisResult
  usecase?: UseCase
}

const STATUS_LABELS: Record<string, string> = {
  implemented: 'Implementato',
  partial: 'Parzialmente implementato',
  missing: 'Non implementato',
  unclear: 'Non chiaro'
}

const CONFIDENCE_LABELS: Record<string, string> = {
  high: 'alta',
  medium: 'media',
  low: 'bassa'
}

export function buildChatSystemPrompt(context: ChatContext): string {
  const { microserviceName, result, usecase } = context

  const statusLabel = STATUS_LABELS[result.status] || result.status
  const confidenceLabel = result.confidence ? CONFIDENCE_LABELS[result.confidence] || result.confidence : 'non specificata'

  let prompt = `Sei un esperto software engineer che aiuta ad analizzare issue di microservizi Java/Spring Boot.

## Contesto dell'Issue

**Microservizio**: ${microserviceName}
**Status**: ${statusLabel} (confidenza: ${confidenceLabel})
`

  if (usecase) {
    prompt += `
### Use Case: ${usecase.code} - ${usecase.title}

**Descrizione**: ${usecase.description || 'Non disponibile'}
`
    if (usecase.actors) {
      prompt += `**Attori**: ${usecase.actors}\n`
    }
    if (usecase.preconditions) {
      prompt += `**Precondizioni**: ${usecase.preconditions}\n`
    }
    if (usecase.mainFlow) {
      prompt += `**Flusso Principale**:\n${usecase.mainFlow}\n`
    }
    if (usecase.alternativeFlows) {
      prompt += `**Flussi Alternativi**:\n${usecase.alternativeFlows}\n`
    }
  }

  if (result.evidence) {
    prompt += `
### Evidenze nel Codice
\`\`\`
${result.evidence}
\`\`\`
`
  }

  if (result.notes) {
    prompt += `
### Note dell'Analisi
${result.notes}
`
  }

  prompt += `
## Il tuo ruolo

- Rispondi a domande specifiche su questa issue
- Suggerisci approcci per l'implementazione o la correzione
- Spiega il contesto tecnico e le implicazioni
- Aiuta a identificare dipendenze e rischi
- Proponi acceptance criteria se richiesto
- Suggerisci test case se appropriato

## Linee guida

- Rispondi in italiano
- Sii conciso ma completo
- Usa terminologia tecnica appropriata
- Se non hai abbastanza informazioni, chiedi chiarimenti
- Basa le risposte sul contesto fornito sopra`

  return prompt
}
