<script setup lang="ts">
const props = withDefaults(defineProps<{
  placeholder?: string
  rows?: number
  disabled?: boolean
}>(), {
  placeholder: 'Descrizione della issue...',
  rows: 14
})

const modelValue = defineModel<string>({ default: '' })

// View mode: 'edit' or 'preview'
const viewMode = ref<'edit' | 'preview'>('edit')

// Toolbar actions
const insertFormatting = (before: string, after: string = before) => {
  const textarea = document.querySelector('.jira-description-textarea') as HTMLTextAreaElement
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
  { icon: 'i-lucide-bold', label: 'Grassetto', action: () => insertFormatting('*') },
  { icon: 'i-lucide-italic', label: 'Corsivo', action: () => insertFormatting('_') },
  { icon: 'i-lucide-underline', label: 'Sottolineato', action: () => insertFormatting('+') },
  { icon: 'i-lucide-strikethrough', label: 'Barrato', action: () => insertFormatting('-') },
  { type: 'separator' },
  { icon: 'i-lucide-heading-1', label: 'Titolo 1', action: () => insertFormatting('h1. ', '') },
  { icon: 'i-lucide-heading-2', label: 'Titolo 2', action: () => insertFormatting('h2. ', '') },
  { icon: 'i-lucide-heading-3', label: 'Titolo 3', action: () => insertFormatting('h3. ', '') },
  { type: 'separator' },
  { icon: 'i-lucide-list', label: 'Lista puntata', action: () => insertFormatting('* ', '') },
  { icon: 'i-lucide-list-ordered', label: 'Lista numerata', action: () => insertFormatting('# ', '') },
  { type: 'separator' },
  { icon: 'i-lucide-code', label: 'Codice inline', action: () => insertFormatting('{{', '}}') },
  { icon: 'i-lucide-square-code', label: 'Blocco codice', action: () => insertFormatting('{code}\n', '\n{code}') },
  { icon: 'i-lucide-quote', label: 'Citazione', action: () => insertFormatting('{quote}\n', '\n{quote}') },
  { type: 'separator' },
  { icon: 'i-lucide-link', label: 'Link', action: () => insertFormatting('[', '|https://]') },
]
</script>

<template>
  <div class="jira-description-editor border border-neutral-200 dark:border-neutral-700 rounded-xl overflow-hidden">
    <!-- Toolbar -->
    <div class="flex items-center gap-1 px-2 py-1.5 bg-neutral-50 dark:bg-neutral-800/50 border-b border-neutral-200 dark:border-neutral-700">
      <!-- Formatting buttons -->
      <template v-for="(item, index) in toolbarItems" :key="index">
        <USeparator v-if="item.type === 'separator'" orientation="vertical" class="h-5 mx-1" />
        <UTooltip v-else :text="item.label">
          <UButton
            :icon="item.icon"
            color="neutral"
            variant="ghost"
            size="xs"
            :disabled="disabled || viewMode === 'preview'"
            @click="item.action"
          />
        </UTooltip>
      </template>
      
      <!-- Spacer -->
      <div class="flex-1" />
      
      <!-- View mode toggle -->
      <div class="flex items-center bg-neutral-200 dark:bg-neutral-700 rounded-lg p-0.5">
        <button
          type="button"
          class="px-3 py-1 text-xs font-medium rounded-md transition-all"
          :class="viewMode === 'edit' 
            ? 'bg-white dark:bg-neutral-600 text-neutral-900 dark:text-neutral-100 shadow-sm' 
            : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'"
          @click="viewMode = 'edit'"
        >
          <UIcon name="i-lucide-pencil" class="w-3.5 h-3.5 mr-1 inline-block" />
          Modifica
        </button>
        <button
          type="button"
          class="px-3 py-1 text-xs font-medium rounded-md transition-all"
          :class="viewMode === 'preview' 
            ? 'bg-white dark:bg-neutral-600 text-neutral-900 dark:text-neutral-100 shadow-sm' 
            : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'"
          @click="viewMode = 'preview'"
        >
          <UIcon name="i-lucide-eye" class="w-3.5 h-3.5 mr-1 inline-block" />
          Anteprima
        </button>
      </div>
    </div>
    
    <!-- Content area -->
    <div class="relative">
      <!-- Edit mode -->
      <textarea
        v-show="viewMode === 'edit'"
        v-model="modelValue"
        :placeholder="placeholder"
        :rows="rows"
        :disabled="disabled"
        class="jira-description-textarea w-full p-4 bg-white dark:bg-neutral-900 text-sm font-mono resize-none focus:outline-none focus:ring-0 border-0"
        :class="{ 'opacity-50 cursor-not-allowed': disabled }"
      />
      
      <!-- Preview mode - using shared component -->
      <div
        v-show="viewMode === 'preview'"
        class="w-full p-4 bg-white dark:bg-neutral-900 overflow-y-auto"
        :style="{ minHeight: `${rows * 1.5}rem` }"
      >
        <JiraDescriptionPreview v-if="modelValue" :content="modelValue" />
        <p v-else class="text-sm text-neutral-400 dark:text-neutral-500 italic">Nessuna descrizione</p>
      </div>
    </div>
    
    <!-- Footer with help -->
    <div class="px-3 py-2 bg-neutral-50 dark:bg-neutral-800/50 border-t border-neutral-200 dark:border-neutral-700">
      <div class="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
        <span>
          Sintassi Jira: 
          <code class="px-1 bg-neutral-200 dark:bg-neutral-700 rounded">*grassetto*</code>
          <code class="px-1 bg-neutral-200 dark:bg-neutral-700 rounded ml-1">_corsivo_</code>
          <code class="px-1 bg-neutral-200 dark:bg-neutral-700 rounded ml-1">h2. Titolo</code>
          <code class="px-1 bg-neutral-200 dark:bg-neutral-700 rounded ml-1">{code}...{code}</code>
        </span>
        <UButton
          v-if="viewMode === 'edit'"
          size="xs"
          color="neutral"
          variant="link"
          to="https://jira.atlassian.com/secure/WikiRendererHelpAction.jspa?section=all"
          target="_blank"
          trailing-icon="i-lucide-external-link"
        >
          Guida formattazione
        </UButton>
      </div>
    </div>
  </div>
</template>

<style scoped>
.jira-description-textarea {
  font-family: var(--font-mono), ui-monospace, monospace;
  line-height: 1.6;
}
</style>
