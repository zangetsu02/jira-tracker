import { spawn } from 'child_process'
import { buildAnalysisPrompt } from '../prompts/analysis'
import {
  buildExtractUseCasesPrompt,
  type UseCaseExtractionResult,
  type ExtractedUseCase
} from '../prompts/extract-usecases'
import {
  CLAUDE_TIMEOUT_MS,
  MIN_RESPONSE_LENGTH,
  type IssuesOnlyResult
} from './analysis'
import type { UseCase } from '~~/shared/utils/types'

export type { ExtractedUseCase, UseCaseExtractionResult }

// ============================================================================
// TYPES
// ============================================================================

export type ProgressCallback = (message: string, phase: string) => void

interface ClaudeResultMessage {
  type: 'result'
  result?: string
  cost_usd?: number
}

interface ClaudeAssistantMessage {
  type: 'assistant'
  message?: {
    content?: Array<{ type: string, text?: string }>
  }
}

interface ClaudeErrorMessage {
  type: 'error'
  is_error?: boolean
}

type ClaudeMessage = ClaudeResultMessage | ClaudeAssistantMessage | ClaudeErrorMessage

// ============================================================================
// CLAUDE CLI EXECUTION
// ============================================================================

/**
 * Execute Claude CLI with stream-json output format
 * Based on GitHub issue #771 for reliable JSON parsing
 */
async function executeClaudeCli(
  prompt: string,
  files: string[],
  onProgress?: ProgressCallback
): Promise<string> {
  return new Promise((resolve, reject) => {
    // Build args: use --add-dir to allow access to file directories
    const dirs = [...new Set(files.map(f => f.substring(0, f.lastIndexOf('/'))))]
    const addDirArgs = dirs.flatMap(d => ['--add-dir', d])

    const args = [
      '-p', prompt,
      '--output-format', 'stream-json',
      '--verbose',
      '--permission-mode', 'bypassPermissions',
      '--model', 'sonnet',
      '--max-budget-usd', '5',
      ...addDirArgs
    ]

    console.log('[executeClaudeCli] Running claude with args:', args.slice(0, 5).join(' '), '...')
    console.log('[executeClaudeCli] Allowing dirs:', dirs)

    onProgress?.('Avvio analisi Claude...', 'starting')

    const proc = spawn('claude', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, ANTHROPIC_API_KEY: '', TERM: 'dumb' },
      cwd: process.env.HOME || '/home/palladinic'
    })

    let fullText = ''
    let hasReceivedData = false

    const timeout = setTimeout(() => {
      if (!hasReceivedData) {
        proc.kill()
        reject(new Error('Claude timeout - nessuna risposta dopo 10 minuti'))
      }
    }, CLAUDE_TIMEOUT_MS)

    proc.stdout.on('data', (data: Buffer) => {
      hasReceivedData = true
      const lines = data.toString().split('\n').filter(Boolean)

      for (const line of lines) {
        const message = parseClaudeMessage(line)
        if (!message) continue

        console.log('[Claude] Message type:', message.type)

        if (message.type === 'result') {
          const resultMsg = message as ClaudeResultMessage
          console.log('[Claude] Result message, result length:', resultMsg.result?.length ?? 0)
          // Always use result if present - it's the final response
          if (resultMsg.result) {
            // Only use result if it contains JSON or is longer than accumulated text
            if (resultMsg.result.includes('{') || resultMsg.result.length > fullText.length) {
              fullText = resultMsg.result
              console.log('[Claude] Using result as fullText, length:', fullText.length)
            } else {
              console.log('[Claude] Ignoring short result, keeping accumulated text, length:', fullText.length)
            }
            if (resultMsg.cost_usd) {
              onProgress?.(`Costo: $${resultMsg.cost_usd.toFixed(4)}`, 'cost')
            }
          }
        } else if (message.type === 'assistant') {
          const assistantMsg = message as ClaudeAssistantMessage
          const text = extractAssistantText(assistantMsg)
          if (text) {
            fullText += text
            console.log('[Claude] Appending assistant text, total length:', fullText.length)
            console.log('[Claude] Text preview:', text.substring(0, 200))
            onProgress?.(text.substring(0, 100), 'analyzing')
          } else {
            // Log what content types we're seeing
            const contentTypes = assistantMsg.message?.content?.map(c => c.type) || []
            console.log('[Claude] Assistant message without text, content types:', contentTypes)
          }
        }
      }
    })

    proc.stderr.on('data', (data: Buffer) => {
      // Log stderr for debugging
      console.log('[Claude stderr]', data.toString().substring(0, 200))
    })

    proc.on('close', (code) => {
      clearTimeout(timeout)
      console.log('[Claude] Process closed with code:', code, 'fullText length:', fullText.length)
      if (fullText.length > 0) {
        onProgress?.('Analisi completata', 'complete')
        resolve(fullText)
      } else {
        reject(new Error(`Claude exited with code ${code} and no output`))
      }
    })

    proc.on('error', (err) => {
      clearTimeout(timeout)
      reject(err)
    })
  })
}

function parseClaudeMessage(line: string): ClaudeMessage | null {
  try {
    return JSON.parse(line) as ClaudeMessage
  } catch {
    return null
  }
}

function extractAssistantText(message: ClaudeAssistantMessage): string | null {
  const content = message.message?.content
  if (!Array.isArray(content)) return null

  for (const block of content) {
    if (block.type === 'text' && block.text) {
      return block.text
    }
  }
  return null
}

// ============================================================================
// JSON PARSING
// ============================================================================

/**
 * Extract JSON object from text response
 */
function extractJson(text: string): string {
  console.log('[extractJson] Input length:', text.length)
  console.log('[extractJson] First 500 chars:', text.substring(0, 500))
  console.log('[extractJson] Last 500 chars:', text.substring(Math.max(0, text.length - 500)))

  // Try to find JSON block in markdown code fence first
  const codeBlockMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/)
  if (codeBlockMatch) {
    console.log('[extractJson] Found JSON in code block')
    return codeBlockMatch[1]
  }

  // Find the outermost { } pair that contains "usecases" or "issues"
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')

  if (start === -1 || end === -1 || end < start) {
    console.error('[extractJson] No JSON found in response')
    console.error('[extractJson] Full text:', text)
    throw new Error('Nessun JSON trovato nella risposta')
  }

  const jsonStr = text.slice(start, end + 1)
  console.log('[extractJson] Extracted JSON length:', jsonStr.length)

  return jsonStr
}

/**
 * Parse issues from Claude response
 */
function parseIssuesJson(text: string): IssuesOnlyResult {
  const jsonStr = extractJson(text)
  const parsed = JSON.parse(jsonStr)
  return {
    issues: Array.isArray(parsed.issues) ? parsed.issues : []
  }
}

/**
 * Parse use cases from Claude response
 */
function parseUseCasesJson(text: string): UseCaseExtractionResult {
  const jsonStr = extractJson(text)
  const parsed = JSON.parse(jsonStr)
  return {
    usecases: Array.isArray(parsed.usecases) ? parsed.usecases : []
  }
}

// ============================================================================
// PUBLIC API
// ============================================================================

export interface AnalyzeMicroserviceOptions {
  microservicePath: string
  legacyPath: string | null
  pdfPath: string | null
  usecases?: UseCase[]
  onProgress?: ProgressCallback
}

/**
 * Analyze microservice and return JIRA issues
 */
export async function analyzeMicroservice(
  microservicePath: string,
  legacyPath: string | null,
  pdfPath: string | null,
  onProgressOrOptions?: ProgressCallback | AnalyzeMicroserviceOptions,
  usecases?: UseCase[]
): Promise<IssuesOnlyResult> {
  // Handle both old and new call signatures
  let onProgress: ProgressCallback | undefined
  let ucList: UseCase[] | undefined

  if (typeof onProgressOrOptions === 'function') {
    onProgress = onProgressOrOptions
    ucList = usecases
  } else if (onProgressOrOptions) {
    onProgress = onProgressOrOptions.onProgress
    ucList = onProgressOrOptions.usecases
  }

  const prompt = buildAnalysisPrompt({
    microservicePath,
    legacyPath,
    pdfPath,
    usecases: ucList
  })

  onProgress?.('Preparazione prompt...', 'preparing')
  onProgress?.(`Prompt length: ${prompt.length} chars`, 'info')

  // Include all paths Claude needs to read
  const files: string[] = []
  files.push(microservicePath) // microservice directory
  if (legacyPath) files.push(legacyPath)
  if (pdfPath) files.push(pdfPath)

  const response = await executeClaudeCli(prompt, files, onProgress)

  onProgress?.('Parsing risposta...', 'parsing')

  return parseIssuesJson(response)
}

/**
 * Extract use cases from PDF document
 */
export async function extractUseCasesFromPdf(
  pdfPath: string,
  onProgress?: ProgressCallback
): Promise<UseCaseExtractionResult> {
  const prompt = buildExtractUseCasesPrompt({ pdfPath })

  console.log('[extractUseCasesFromPdf] Starting extraction')
  console.log('[extractUseCasesFromPdf] PDF path:', pdfPath)
  console.log('[extractUseCasesFromPdf] Prompt length:', prompt.length)

  onProgress?.('Preparazione estrazione use case...', 'preparing')
  onProgress?.(`PDF: ${pdfPath}`, 'info')

  const response = await executeClaudeCli(prompt, [pdfPath], onProgress)

  console.log('[extractUseCasesFromPdf] Response length:', response.length)
  console.log('[extractUseCasesFromPdf] Response preview:', response.substring(0, 300))

  onProgress?.('Parsing use case...', 'parsing')

  return parseUseCasesJson(response)
}
