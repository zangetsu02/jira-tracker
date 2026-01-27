<script setup lang="ts">
import { marked } from 'marked'
import type { AnalysisResult, UseCase } from '~~/shared/utils/types'

// Configure marked for safe rendering
marked.setOptions({
  breaks: true,
  gfm: true
})

const parseMarkdown = (content: string): string => {
  return marked.parse(content, { async: false }) as string
}

interface Props {
  result: (AnalysisResult & { usecase?: UseCase }) | null
  microserviceName: string
}

const props = defineProps<Props>()

const open = defineModel<boolean>('open', { default: false })

const { getStatusLabel, getStatusColor } = useAnalysisStatus()
const {
  messages,
  isStreaming,
  error,
  initChat,
  clearChat,
  sendMessage
} = useAnalysisChat()

const input = ref('')
const messagesContainer = ref<HTMLElement | null>(null)

// Initialize chat when result changes
watch(() => props.result, (result) => {
  if (result && props.microserviceName) {
    initChat(result, props.microserviceName)
  }
}, { immediate: true })

// Clear chat when slideover closes
watch(open, (isOpen) => {
  if (!isOpen) {
    clearChat()
    input.value = ''
  }
})

// Auto-scroll to bottom when new messages arrive
watch(() => messages.value.length, () => {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  })
})

// Also scroll during streaming
watch(() => messages.value[messages.value.length - 1]?.content, () => {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  })
})

const handleSubmit = () => {
  if (!input.value.trim() || isStreaming.value) return
  sendMessage(input.value)
  input.value = ''
}

const suggestedQuestions = [
  'Come posso implementare questo use case?',
  'Quali sono i rischi principali?',
  'Suggerisci degli acceptance criteria'
]
</script>

<template>
  <USlideover
    v-model:open="open"
    side="right"
    :ui="{
      width: 'sm:max-w-3xl'
    }"
  >
    <template #header>
      <div class="flex items-center gap-4">
        <div class="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shrink-0 shadow-lg shadow-violet-500/20">
          <UIcon
            name="i-lucide-sparkles"
            class="w-6 h-6 text-white"
          />
        </div>
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <h2 class="text-xl font-semibold tracking-tight">
              Claude AI
            </h2>
          </div>
          <p class="text-sm text-[var(--ui-text-muted)] truncate mt-0.5">
            {{ result?.usecase?.code ? `${result.usecase.code}: ` : '' }}{{ result?.usecase?.title || result?.evidence?.substring(0, 40) || 'Assistente Issue' }}
          </p>
        </div>
      </div>
    </template>

    <template #body>
      <div class="flex flex-col h-full -mx-4 -my-4">
        <!-- Context Card -->
        <div
          v-if="result"
          class="mx-4 mt-4 mb-2"
        >
          <div class="p-4 rounded-xl bg-gradient-to-r from-[var(--ui-bg-elevated)] to-[var(--ui-bg-muted)] border border-[var(--ui-border)]">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <UBadge
                  :color="getStatusColor(result.status)"
                  variant="soft"
                  size="sm"
                >
                  {{ getStatusLabel(result.status) }}
                </UBadge>
                <UBadge
                  v-if="result.confidence"
                  color="neutral"
                  variant="soft"
                  size="sm"
                >
                  {{ result.confidence }}
                </UBadge>
              </div>
              <span class="text-xs text-[var(--ui-text-dimmed)] font-mono">
                {{ microserviceName }}
              </span>
            </div>
          </div>
        </div>

        <!-- Error Alert -->
        <div
          v-if="error"
          class="mx-4 mb-2"
        >
          <UAlert
            color="error"
            variant="soft"
            icon="i-lucide-alert-triangle"
            :title="error"
            :close-button="{ icon: 'i-lucide-x', color: 'error', variant: 'link' }"
            @close="error = null"
          />
        </div>

        <!-- Messages Area -->
        <div
          ref="messagesContainer"
          class="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0"
        >
          <!-- Empty State -->
          <div
            v-if="messages.length === 0"
            class="flex flex-col items-center justify-center h-full text-center"
          >
            <div class="w-20 h-20 rounded-full bg-gradient-to-br from-violet-500/10 to-purple-600/10 flex items-center justify-center mb-6">
              <UIcon
                name="i-lucide-message-circle-question"
                class="w-10 h-10 text-violet-500"
              />
            </div>
            <h3 class="text-lg font-medium mb-2">
              Come posso aiutarti?
            </h3>
            <p class="text-sm text-[var(--ui-text-muted)] mb-8 max-w-xs">
              Chiedimi qualsiasi cosa su questa issue. Posso aiutarti con implementazione, rischi, test e altro.
            </p>

            <!-- Suggested Questions -->
            <div class="space-y-2 w-full max-w-md">
              <button
                v-for="question in suggestedQuestions"
                :key="question"
                type="button"
                class="w-full text-left px-4 py-3 text-sm rounded-xl bg-[var(--ui-bg-muted)] hover:bg-[var(--ui-bg-accent)] border border-[var(--ui-border)] hover:border-violet-500/30 transition-all duration-200 group"
                @click="input = question"
              >
                <span class="flex items-center gap-3">
                  <UIcon
                    name="i-lucide-corner-down-right"
                    class="w-4 h-4 text-[var(--ui-text-dimmed)] group-hover:text-violet-500 transition-colors"
                  />
                  {{ question }}
                </span>
              </button>
            </div>
          </div>

          <!-- Messages -->
          <template v-else>
            <div
              v-for="message in messages"
              :key="message.id"
              class="flex gap-3"
              :class="message.role === 'user' ? 'justify-end' : 'justify-start'"
            >
              <!-- Assistant Avatar -->
              <div
                v-if="message.role === 'assistant'"
                class="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shrink-0 shadow-md shadow-violet-500/20"
              >
                <UIcon
                  name="i-lucide-sparkles"
                  class="w-4 h-4 text-white"
                />
              </div>

              <!-- Message Bubble -->
              <div
                class="max-w-[80%] px-4 py-3 rounded-2xl"
                :class="message.role === 'user'
                  ? 'bg-[var(--ui-primary)] text-white rounded-br-md'
                  : 'bg-[var(--ui-bg-muted)] border border-[var(--ui-border)] rounded-bl-md'"
              >
                <div
                  v-if="message.role === 'assistant' && !message.content && isStreaming"
                  class="flex items-center gap-2"
                >
                  <span class="flex gap-1">
                    <span
                      class="w-2 h-2 rounded-full bg-violet-500 animate-bounce"
                      style="animation-delay: 0ms"
                    />
                    <span
                      class="w-2 h-2 rounded-full bg-violet-500 animate-bounce"
                      style="animation-delay: 150ms"
                    />
                    <span
                      class="w-2 h-2 rounded-full bg-violet-500 animate-bounce"
                      style="animation-delay: 300ms"
                    />
                  </span>
                </div>
                <div
                  v-else
                  class="text-sm chat-content"
                  v-html="message.role === 'assistant' ? parseMarkdown(message.content) : message.content"
                />
              </div>

              <!-- User Avatar -->
              <div
                v-if="message.role === 'user'"
                class="w-8 h-8 rounded-xl bg-[var(--ui-primary)] flex items-center justify-center shrink-0"
              >
                <UIcon
                  name="i-lucide-user"
                  class="w-4 h-4 text-white"
                />
              </div>
            </div>
          </template>
        </div>

        <!-- Input Area -->
        <div class="px-4 py-4 border-t border-[var(--ui-border)] bg-[var(--ui-bg)]">
          <form
            class="flex gap-3"
            @submit.prevent="handleSubmit"
          >
            <UInput
              v-model="input"
              placeholder="Scrivi un messaggio..."
              size="xl"
              class="flex-1"
              :disabled="isStreaming"
              :ui="{
                base: 'rounded-xl'
              }"
              autofocus
            />
            <UButton
              type="submit"
              icon="i-lucide-arrow-up"
              size="xl"
              :loading="isStreaming"
              :disabled="!input.trim() || isStreaming"
              :ui="{
                base: 'rounded-xl'
              }"
            />
          </form>
        </div>
      </div>
    </template>

    <template #footer>
      <span />
    </template>
  </USlideover>
</template>

<style scoped>
.chat-content :deep(p) {
  margin-bottom: 0.75rem;
}

.chat-content :deep(p:last-child) {
  margin-bottom: 0;
}

.chat-content :deep(ul),
.chat-content :deep(ol) {
  margin: 0.5rem 0;
  padding-left: 1.25rem;
}

.chat-content :deep(li) {
  margin-bottom: 0.25rem;
}

.chat-content :deep(code) {
  background-color: var(--ui-bg-elevated);
  padding: 0.125rem 0.5rem;
  border-radius: 0.375rem;
  font-size: 0.8em;
  font-family: ui-monospace, monospace;
}

.chat-content :deep(pre) {
  background-color: var(--ui-bg-elevated);
  padding: 1rem;
  border-radius: 0.75rem;
  overflow-x: auto;
  margin: 0.75rem 0;
  font-size: 0.85em;
}

.chat-content :deep(pre code) {
  background: none;
  padding: 0;
}

.chat-content :deep(strong) {
  font-weight: 600;
}

.chat-content :deep(h1),
.chat-content :deep(h2),
.chat-content :deep(h3),
.chat-content :deep(h4) {
  font-weight: 600;
  margin-top: 1rem;
  margin-bottom: 0.5rem;
}

.chat-content :deep(h1) {
  font-size: 1.25rem;
}

.chat-content :deep(h2) {
  font-size: 1.125rem;
}

.chat-content :deep(h3),
.chat-content :deep(h4) {
  font-size: 1rem;
}

.chat-content :deep(blockquote) {
  border-left: 3px solid var(--ui-border);
  padding-left: 1rem;
  margin: 0.75rem 0;
  color: var(--ui-text-muted);
  font-style: italic;
}

.chat-content :deep(a) {
  color: var(--ui-primary);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.chat-content :deep(hr) {
  border: none;
  border-top: 1px solid var(--ui-border);
  margin: 1rem 0;
}

@keyframes bounce {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-4px);
  }
}
</style>
