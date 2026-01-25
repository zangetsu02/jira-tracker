export interface ExtractUseCasesParams {
  pdfPath: string
}

export interface ExtractedUseCase {
  code: string
  title: string
  description: string
  actors: string
  preconditions: string
  mainFlow: string
  alternativeFlows: string
}

export interface UseCaseExtractionResult {
  usecases: ExtractedUseCase[]
}

/**
 * Build prompt for use case extraction from PDF
 */
export function buildExtractUseCasesPrompt(params: ExtractUseCasesParams): string {
  return `# Estrazione Use Case da Documento PDF

Sei un analista di business specializzato nell'estrazione di use case da documenti di requisiti.

## Istruzioni

1. PRIMA leggi il file PDF usando il tool Read: ${params.pdfPath}
2. Analizza il contenuto ed estrai tutti gli use case

## Cosa cercare

1. **Codice Use Case**: Identificatori come UC-001, UC-002, UseCase1, etc.
2. **Titolo**: Nome descrittivo dello use case
3. **Descrizione**: Scopo e obiettivo dello use case
4. **Attori**: Chi interagisce con il sistema (utente, admin, sistema esterno, etc.)
5. **Precondizioni**: Condizioni che devono essere vere prima dell'esecuzione
6. **Flusso Principale**: Sequenza di passi del caso normale
7. **Flussi Alternativi**: Varianti, eccezioni, gestione errori

## Output

Dopo aver letto il PDF, restituisci ESCLUSIVAMENTE un oggetto JSON valido con questa struttura:

{"usecases":[{"code":"UC-001","title":"Titolo Use Case","description":"Descrizione completa dello use case","actors":"Attore1, Attore2","preconditions":"Precondizione 1. Precondizione 2.","mainFlow":"1. Passo 1\\n2. Passo 2\\n3. Passo 3","alternativeFlows":"A1: Flusso alternativo 1\\nA2: Flusso alternativo 2"}]}

## Regole

- PRIMA leggi il file PDF al path indicato
- Output SOLO JSON, nessun testo prima o dopo
- Nessun markdown, nessun code fence, nessun commento
- JSON deve iniziare con { e terminare con }
- Se un campo non e' presente nel documento, usa stringa vuota ""
- Estrai TUTTI gli use case, non solo alcuni
- Mantieni i numeri/codici originali degli use case
- Se il documento non contiene use case riconoscibili, restituisci {"usecases":[]}`
}
