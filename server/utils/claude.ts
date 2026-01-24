import { spawn } from 'child_process'
import { buildAnalysisPrompt } from '../prompts/analysis'
import {
  CLAUDE_TIMEOUT_MS,
  MIN_RESPONSE_LENGTH,
  type IssuesOnlyResult
} from './analysis'

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
    const args = ['-p', prompt, '--output-format', 'stream-json', '--verbose', ...files]

    onProgress?.('Avvio analisi Claude...', 'starting')

    const proc = spawn('claude', args, {
      stdio: ['inherit', 'pipe', 'pipe'],
      env: { ...process.env, ANTHROPIC_API_KEY: '', TERM: 'dumb' },
      cwd: process.env.HOME || '/home/zangetsu'
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

        if (message.type === 'result' && message.result && message.result.length > MIN_RESPONSE_LENGTH) {
          fullText = message.result
          if (message.cost_usd) {
            onProgress?.(`Costo: $${message.cost_usd.toFixed(4)}`, 'cost')
          }
        } else if (message.type === 'assistant') {
          const text = extractAssistantText(message)
          if (text) {
            fullText += text
            onProgress?.(text.substring(0, 100), 'analyzing')
          }
        }
      }
    })

    proc.stderr.on('data', () => {
      // Ignore stderr - Claude outputs progress there
    })

    proc.on('close', (code) => {
      clearTimeout(timeout)
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
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end === -1 || end < start) {
    throw new Error('Nessun JSON trovato nella risposta')
  }
  return text.slice(start, end + 1)
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

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Analyze microservice and return JIRA issues
 */
export async function analyzeMicroservice(
  microservicePath: string,
  legacyPath: string | null,
  pdfPath: string | null,
  onProgress?: ProgressCallback
): Promise<IssuesOnlyResult> {
  const prompt = buildAnalysisPrompt({ microservicePath, legacyPath, pdfPath })

  onProgress?.('Preparazione prompt...', 'preparing')
  onProgress?.(`Prompt length: ${prompt.length} chars`, 'info')

  const files = pdfPath ? [pdfPath] : []
  const response = await executeClaudeCli(prompt, files, onProgress)

  onProgress?.('Parsing risposta...', 'parsing')

  return parseIssuesJson(response)
}
