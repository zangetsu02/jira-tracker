import Anthropic from '@anthropic-ai/sdk'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { prompt, stream = false } = body

  if (!prompt) {
    throw createError({
      statusCode: 400,
      message: 'Prompt is required'
    })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw createError({
      statusCode: 500,
      message: 'ANTHROPIC_API_KEY not configured'
    })
  }

  const client = new Anthropic({ apiKey })

  try {
    if (stream) {
      // Streaming response
      setHeader(event, 'Content-Type', 'text/event-stream')
      setHeader(event, 'Cache-Control', 'no-cache')
      setHeader(event, 'Connection', 'keep-alive')

      const streamResponse = await client.messages.stream({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }]
      })

      for await (const chunk of streamResponse) {
        if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
          const text = chunk.delta.text
          // Send as SSE
          event.node.res.write(`data: ${JSON.stringify({ text })}\n\n`)
        }
      }

      const finalMessage = await streamResponse.finalMessage()
      event.node.res.write(`data: ${JSON.stringify({ done: true, usage: finalMessage.usage })}\n\n`)
      event.node.res.end()
      return
    }

    // Non-streaming response
    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }]
    })

    const textContent = message.content.find(c => c.type === 'text')

    return {
      success: true,
      response: textContent?.text || '',
      usage: message.usage,
      model: message.model,
      stopReason: message.stop_reason
    }
  } catch (error) {
    console.error('Claude SDK error:', error)
    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Claude API error'
    })
  }
})
