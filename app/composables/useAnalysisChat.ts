import type { AnalysisResult, UseCase } from '~~/shared/utils/types'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: Date
}

export function useAnalysisChat() {
  const messages = ref<ChatMessage[]>([])
  const isStreaming = ref(false)
  const error = ref<string | null>(null)
  const currentResult = ref<(AnalysisResult & { usecase?: UseCase }) | null>(null)
  const microserviceName = ref<string>('')

  const generateId = () => Math.random().toString(36).substring(2, 9)

  const initChat = (result: AnalysisResult & { usecase?: UseCase }, msName: string) => {
    currentResult.value = result
    microserviceName.value = msName
    messages.value = []
    error.value = null
  }

  const clearChat = () => {
    messages.value = []
    error.value = null
  }

  const sendMessage = async (content: string) => {
    if (!content.trim() || !currentResult.value || isStreaming.value) return

    error.value = null

    // Add user message
    const userMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: content.trim(),
      createdAt: new Date()
    }
    messages.value.push(userMessage)

    // Add placeholder for assistant response
    const assistantMessage: ChatMessage = {
      id: generateId(),
      role: 'assistant',
      content: '',
      createdAt: new Date()
    }
    messages.value.push(assistantMessage)

    isStreaming.value = true

    try {
      const response = await fetch('/api/chat/analysis-result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resultId: currentResult.value.id,
          microserviceName: microserviceName.value,
          messages: messages.value
            .filter(m => m.content) // Exclude empty assistant placeholder
            .map(m => ({ role: m.role, content: m.content }))
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`)
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No response body')

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))

              if (data.error) {
                throw new Error(data.error)
              }

              if (data.text) {
                // Update assistant message content
                const lastMessage = messages.value[messages.value.length - 1]
                if (lastMessage?.role === 'assistant') {
                  lastMessage.content += data.text
                }
              }

              if (data.done) {
                // Streaming complete
                break
              }
            } catch (e) {
              // Ignore JSON parse errors for incomplete chunks
              if (e instanceof SyntaxError) continue
              throw e
            }
          }
        }
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Errore durante la chat'
      // Remove empty assistant message on error
      if (messages.value[messages.value.length - 1]?.role === 'assistant'
        && !messages.value[messages.value.length - 1]?.content) {
        messages.value.pop()
      }
    } finally {
      isStreaming.value = false
    }
  }

  return {
    messages,
    isStreaming,
    error,
    currentResult,
    microserviceName,
    initChat,
    clearChat,
    sendMessage
  }
}
