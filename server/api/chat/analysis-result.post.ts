import { spawn } from 'child_process'
import { eq } from 'drizzle-orm'
import { useDB } from '~~/server/utils/db'
import { analysisResults, usecases } from '~~/server/database/schema'
import { buildChatSystemPrompt } from '~~/server/prompts/chat'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface ChatRequest {
  resultId: number
  microserviceName: string
  messages: ChatMessage[]
}

interface ClaudeMessage {
  type: 'result' | 'assistant' | 'error'
  result?: string
  message?: {
    content?: Array<{ type: string, text?: string }>
  }
  is_error?: boolean
}

export default defineEventHandler(async (event) => {
  const body = await readBody<ChatRequest>(event)
  const { resultId, microserviceName, messages } = body

  if (!resultId || !microserviceName || !messages?.length) {
    throw createError({
      statusCode: 400,
      message: 'resultId, microserviceName and messages are required'
    })
  }

  const db = await useDB(event)

  // Fetch analysis result with usecase
  const result = await db
    .select()
    .from(analysisResults)
    .where(eq(analysisResults.id, resultId))
    .limit(1)

  if (!result[0]) {
    throw createError({
      statusCode: 404,
      message: 'Analysis result not found'
    })
  }

  let usecase = null
  if (result[0].usecaseId) {
    const usecaseResult = await db
      .select()
      .from(usecases)
      .where(eq(usecases.id, result[0].usecaseId))
      .limit(1)
    usecase = usecaseResult[0] || null
  }

  // Build system prompt with context
  const systemPrompt = buildChatSystemPrompt({
    microserviceName,
    result: result[0],
    usecase
  })

  // Build conversation for Claude CLI
  // Format: system prompt + conversation history
  const conversationParts: string[] = [
    '## System Instructions\n',
    systemPrompt,
    '\n\n## Conversation\n'
  ]

  for (const msg of messages) {
    if (msg.role === 'user') {
      conversationParts.push(`\nUser: ${msg.content}\n`)
    } else {
      conversationParts.push(`\nAssistant: ${msg.content}\n`)
    }
  }

  conversationParts.push('\nRispondi all\'ultima domanda dell\'utente:')

  const fullPrompt = conversationParts.join('')

  // Set SSE headers
  setHeader(event, 'Content-Type', 'text/event-stream')
  setHeader(event, 'Cache-Control', 'no-cache')
  setHeader(event, 'Connection', 'keep-alive')

  const res = event.node.res

  try {
    await new Promise<void>((resolve, reject) => {
      const args = ['-p', fullPrompt, '--output-format', 'stream-json', '--verbose']

      const proc = spawn('claude', args, {
        stdio: ['inherit', 'pipe', 'pipe'],
        env: { ...process.env, ANTHROPIC_API_KEY: '', TERM: 'dumb' },
        cwd: process.env.HOME || '/home/zangetsu'
      })

      const timeout = setTimeout(() => {
        proc.kill()
        reject(new Error('Claude timeout'))
      }, 300000) // 5 minutes timeout for chat

      proc.stdout.on('data', (data: Buffer) => {
        const lines = data.toString().split('\n').filter(Boolean)

        for (const line of lines) {
          try {
            const message = JSON.parse(line) as ClaudeMessage

            if (message.type === 'assistant') {
              const content = message.message?.content
              if (Array.isArray(content)) {
                for (const block of content) {
                  if (block.type === 'text' && block.text) {
                    res.write(`data: ${JSON.stringify({ text: block.text })}\n\n`)
                  }
                }
              }
            } else if (message.type === 'result' && message.result) {
              // Final result - send any remaining text
              res.write(`data: ${JSON.stringify({ text: message.result })}\n\n`)
            }
          } catch {
            // Ignore parse errors
          }
        }
      })

      let stderrOutput = ''
      proc.stderr.on('data', (data: Buffer) => {
        stderrOutput += data.toString()
        console.log('[Claude stderr]', data.toString())
      })

      proc.on('close', (code) => {
        clearTimeout(timeout)
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`)
        if (code === 0) {
          resolve()
        } else {
          console.error('[Claude] Exit code:', code, 'stderr:', stderrOutput)
          reject(new Error(`Claude exited with code ${code}: ${stderrOutput}`))
        }
      })

      proc.on('error', (err) => {
        clearTimeout(timeout)
        reject(err)
      })
    })
  } catch (error) {
    console.error('Chat error:', error)
    res.write(`data: ${JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' })}\n\n`)
  } finally {
    res.end()
  }
})
