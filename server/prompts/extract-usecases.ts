export interface ExtractUseCasesParams {
  textPaths: string[]
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
 * Build prompt for use case extraction from text file(s) (converted from PDF)
 */
export function buildExtractUseCasesPrompt(params: ExtractUseCasesParams): string {
  const fileList = params.textPaths.map((p, i) => `${i + 1}. ${p}`).join('\n')
  const isSingle = params.textPaths.length === 1

  return `# Estrazione Use Case da Document${isSingle ? 'o' : 'i'}

Sei un analista di business specializzato nell'estrazione di use case da documenti di requisiti.

## Istruzioni

1. PRIMA leggi ${isSingle ? 'il file' : 'TUTTI i file'} usando il tool Read:
${fileList}
2. Analizza il contenuto ed estrai tutti gli use case${isSingle ? '' : ' da TUTTI i documenti'}

## Cosa cercare

1. **Codice Use Case**: Identificatori come UC-001, UC-002, UseCase1, etc.
2. **Titolo**: Nome descrittivo dello use case
3. **Descrizione**: Scopo e obiettivo dello use case
4. **Attori**: Chi interagisce con il sistema (utente, admin, sistema esterno, etc.)
5. **Precondizioni**: Condizioni che devono essere vere prima dell'esecuzione
6. **Flusso Principale**: Sequenza di passi del caso normale
7. **Flussi Alternativi**: Varianti, eccezioni, gestione errori

## Output

Dopo aver letto ${isSingle ? 'il file' : 'TUTTI i file'}, restituisci ESCLUSIVAMENTE un oggetto JSON valido con questa struttura:

{"usecases":[{"code":"UC-001","title":"Titolo Use Case","description":"Descrizione completa dello use case","actors":"Attore1, Attore2","preconditions":"Precondizione 1. Precondizione 2.","mainFlow":"1. Passo 1\\n2. Passo 2\\n3. Passo 3","alternativeFlows":"A1: Flusso alternativo 1\\nA2: Flusso alternativo 2"}]}

## Regole

- PRIMA leggi ${isSingle ? 'il file al path indicato' : 'TUTTI i file ai path indicati, uno dopo l\'altro'}
- Output SOLO JSON, nessun testo prima o dopo
- Nessun markdown, nessun code fence, nessun commento
- JSON deve iniziare con { e terminare con }
- Se un campo non e' presente nel documento, usa stringa vuota ""
- Estrai TUTTI gli use case${isSingle ? '' : ' da TUTTI i documenti'}, non solo alcuni
- Mantieni i numeri/codici originali degli use case
${isSingle ? '' : '- Se ci sono use case duplicati tra i documenti, includili una sola volta\n'}
- Se ${isSingle ? 'il documento non contiene' : 'i documenti non contengono'} use case riconoscibili, restituisci {"usecases":[]}`
}
