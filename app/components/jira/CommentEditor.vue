<script setup lang="ts">
const props = withDefaults(defineProps<{
  placeholder?: string
  rows?: number
  disabled?: boolean
  attachments?: Array<{
    filename: string
    content: string
    thumbnail?: string
    mimeType: string
  }>
}>(), {
  placeholder: 'Scrivi un commento... Usa @ per menzionare utenti',
  rows: 4
})

const modelValue = defineModel<string>({ default: '' })

// View mode: 'edit' or 'preview'
const viewMode = ref<'edit' | 'preview'>('edit')

// Reference to textarea for inserting formatting
const textareaRef = ref<HTMLTextAreaElement | null>(null)

// Toolbar actions
const insertFormatting = (before: string, after: string = before) => {
  const textarea = textareaRef.value
  if (!textarea) return
  
  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const text = modelValue.value
  const selectedText = text.substring(start, end) || 'testo'
  
  const newText = text.substring(0, start) + before + selectedText + after + text.substring(end)
  modelValue.value = newText
  
  // Restore focus and selection
  nextTick(() => {
    textarea.focus()
    textarea.setSelectionRange(start + before.length, start + before.length + selectedText.length)
  })
}

const toolbarItems = [
  { icon: 'i-lucide-bold', label: 'Grassetto (*)', action: () => insertFormatting('*') },
  { icon: 'i-lucide-italic', label: 'Corsivo (_)', action: () => insertFormatting('_') },
  { icon: 'i-lucide-strikethrough', label: 'Barrato (-)', action: () => insertFormatting('-') },
  { type: 'separator' },
  { icon: 'i-lucide-code', label: 'Codice ({{}})', action: () => insertFormatting('{{', '}}') },
  { icon: 'i-lucide-square-code', label: 'Blocco codice', action: () => insertFormatting('{code}\n', '\n{code}') },
  { icon: 'i-lucide-quote', label: 'Citazione', action: () => insertFormatting('{quote}\n', '\n{quote}') },
  { type: 'separator' },
  { icon: 'i-lucide-list', label: 'Lista puntata', action: () => insertFormatting('* ', '') },
  { icon: 'i-lucide-link', label: 'Link', action: () => insertFormatting('[', '|https://]') },
  { icon: 'i-lucide-at-sign', label: 'Menzione (@)', action: () => insertFormatting('[~', ']') },
]

// Expose textarea ref for MentionTextarea
const setTextareaRef = (el: HTMLTextAreaElement | null) => {
  textareaRef.value = el
}

defineExpose({ setTextareaRef })
</script>

<template>
  <div class="comment-editor border border-[var(--ui-border)] overflow-hidden">
    <!-- Toolbar -->
    <div class="flex items-center gap-0.5 px-2 py-1.5 bg-[var(--ui-bg-muted)] border-b border-[var(--ui-border)]">
      <!-- Formatting buttons -->
      <template v-for="(item, index) in toolbarItems" :key="index">
        <USeparator v-if="item.type === 'separator'" orientation="vertical" class="h-4 mx-1" />
        <UTooltip v-else :text="item.label">
          <UButton
            :icon="item.icon"
            color="neutral"
            variant="ghost"
            size="xs"
            :disabled="disabled || viewMode === 'preview'"
            :ui="{ base: 'p-1' }"
            @click="item.action"
          />
        </UTooltip>
      </template>
      
      <!-- Spacer -->
      <div class="flex-1" />
      
      <!-- View mode toggle -->
      <div class="flex items-center bg-[var(--ui-bg-accent)] p-0.5">
        <button
          type="button"
          class="px-2 py-0.5 text-xs font-medium transition-all"
          :class="viewMode === 'edit' 
            ? 'bg-[var(--ui-bg-elevated)] text-[var(--ui-text)] shadow-sm' 
            : 'text-[var(--ui-text-muted)]'"
          @click="viewMode = 'edit'"
        >
          Scrivi
        </button>
        <button
          type="button"
          class="px-2 py-0.5 text-xs font-medium transition-all"
          :class="viewMode === 'preview' 
            ? 'bg-[var(--ui-bg-elevated)] text-[var(--ui-text)] shadow-sm' 
            : 'text-[var(--ui-text-muted)]'"
          :disabled="!modelValue.trim()"
          @click="viewMode = 'preview'"
        >
          Anteprima
        </button>
      </div>
    </div>
    
    <!-- Content area -->
    <div class="relative">
      <!-- Edit mode with mentions -->
      <div v-show="viewMode === 'edit'">
        <JiraMentionTextarea
          v-model="modelValue"
          :placeholder="placeholder"
          :rows="rows"
          :disabled="disabled"
          @textarea-ref="setTextareaRef"
        />
      </div>
      
      <!-- Preview mode -->
      <div
        v-show="viewMode === 'preview'"
        class="p-3 bg-[var(--ui-bg-elevated)] overflow-y-auto"
        :style="{ minHeight: `${rows * 1.5 + 1}rem` }"
      >
        <JiraDescriptionPreview 
          v-if="modelValue.trim()" 
          :content="modelValue" 
          :attachments="attachments"
        />
        <p v-else class="text-sm text-[var(--ui-text-dimmed)] italic">
          Nessun contenuto da visualizzare
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.comment-editor :deep(.mention-container textarea) {
  border: none;
  border-radius: 0;
}
</style>
