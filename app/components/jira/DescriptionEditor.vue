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

// Convert Jira markup to HTML for preview
const convertJiraToHtml = (text: string): string => {
  if (!text) return '<p class="text-neutral-400 italic">Nessuna descrizione</p>'
  
  let html = text
    // Escape HTML first
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    
    // Headers: h1. h2. h3. etc
    .replace(/^h1\.\s*(.+)$/gm, '<h1 class="text-2xl font-bold mt-4 mb-2">$1</h1>')
    .replace(/^h2\.\s*(.+)$/gm, '<h2 class="text-xl font-semibold mt-4 mb-2">$1</h2>')
    .replace(/^h3\.\s*(.+)$/gm, '<h3 class="text-lg font-semibold mt-3 mb-2">$1</h3>')
    .replace(/^h4\.\s*(.+)$/gm, '<h4 class="text-base font-semibold mt-3 mb-1">$1</h4>')
    .replace(/^h5\.\s*(.+)$/gm, '<h5 class="text-sm font-semibold mt-2 mb-1">$1</h5>')
    .replace(/^h6\.\s*(.+)$/gm, '<h6 class="text-sm font-medium mt-2 mb-1">$1</h6>')
    
    // Bold: *text*
    .replace(/\*([^*\n]+)\*/g, '<strong class="font-semibold">$1</strong>')
    
    // Italic: _text_
    .replace(/_([^_\n]+)_/g, '<em class="italic">$1</em>')
    
    // Strikethrough: -text-
    .replace(/-([^-\n]+)-/g, '<del class="line-through">$1</del>')
    
    // Underline: +text+
    .replace(/\+([^+\n]+)\+/g, '<u class="underline">$1</u>')
    
    // Monospace: {{text}}
    .replace(/\{\{([^}]+)\}\}/g, '<code class="px-1.5 py-0.5 bg-neutral-100 dark:bg-neutral-800 rounded text-sm font-mono">$1</code>')
    
    // Code block: {code}...{code}
    .replace(/\{code(?::([^}]*))?\}([\s\S]*?)\{code\}/g, (_match, _lang, code) => {
      return `<pre class="p-3 bg-neutral-100 dark:bg-neutral-800 rounded-lg overflow-x-auto my-2"><code class="text-sm font-mono">${code.trim()}</code></pre>`
    })
    
    // Blockquote: {quote}...{quote}
    .replace(/\{quote\}([\s\S]*?)\{quote\}/g, '<blockquote class="border-l-4 border-neutral-300 dark:border-neutral-600 pl-4 my-2 italic text-neutral-600 dark:text-neutral-400">$1</blockquote>')
    
    // Panel/Note: {panel}...{panel} or {note}...{note}
    .replace(/\{(panel|note)(?::([^}]*))?\}([\s\S]*?)\{\1\}/g, (_match, _type, title, content) => {
      const titleHtml = title ? `<div class="font-semibold mb-1">${title}</div>` : ''
      return `<div class="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg my-2">${titleHtml}${content.trim()}</div>`
    })
    
    // Color: {color:red}text{color}
    .replace(/\{color:([^}]+)\}([\s\S]*?)\{color\}/g, '<span style="color: $1">$2</span>')
    
    // Links: [text|url] or [url]
    .replace(/\[([^\]|]+)\|([^\]]+)\]/g, '<a href="$2" class="text-blue-600 dark:text-blue-400 hover:underline" target="_blank" rel="noopener">$1</a>')
    .replace(/\[([^\]]+)\]/g, '<a href="$1" class="text-blue-600 dark:text-blue-400 hover:underline" target="_blank" rel="noopener">$1</a>')
    
    // Bullet list: * item or - item
    .replace(/^[\*\-]\s+(.+)$/gm, '<li class="ml-4">$1</li>')
    
    // Numbered list: # item
    .replace(/^#\s+(.+)$/gm, '<li class="ml-4 list-decimal">$1</li>')
    
    // Horizontal rule: ----
    .replace(/^-{4,}$/gm, '<hr class="my-4 border-neutral-300 dark:border-neutral-600" />')
    
    // Line breaks
    .replace(/\n\n/g, '</p><p class="my-2">')
    .replace(/\n/g, '<br />')
  
  // Wrap in paragraph if not already wrapped
  if (!html.startsWith('<')) {
    html = `<p class="my-2">${html}</p>`
  }
  
  // Wrap consecutive <li> in <ul>
  html = html.replace(/(<li[^>]*>.*?<\/li>\s*)+/g, (match) => {
    if (match.includes('list-decimal')) {
      return `<ol class="list-decimal my-2">${match}</ol>`
    }
    return `<ul class="list-disc my-2">${match}</ul>`
  })
  
  return html
}

const previewHtml = computed(() => convertJiraToHtml(modelValue.value))

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
      
      <!-- Preview mode -->
      <div
        v-show="viewMode === 'preview'"
        class="w-full p-4 bg-white dark:bg-neutral-900 overflow-y-auto prose prose-sm dark:prose-invert max-w-none"
        :style="{ minHeight: `${rows * 1.5}rem` }"
        v-html="previewHtml"
      />
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

.jira-description-editor :deep(.prose) {
  font-family: var(--font-sans), system-ui, sans-serif;
}

.jira-description-editor :deep(.prose h1),
.jira-description-editor :deep(.prose h2),
.jira-description-editor :deep(.prose h3),
.jira-description-editor :deep(.prose h4) {
  color: var(--ui-text);
}

.jira-description-editor :deep(.prose p) {
  margin-top: 0.5rem;
  margin-bottom: 0.5rem;
}

.jira-description-editor :deep(.prose ul),
.jira-description-editor :deep(.prose ol) {
  padding-left: 1.5rem;
}

.jira-description-editor :deep(.prose li) {
  margin-top: 0.25rem;
  margin-bottom: 0.25rem;
}

.jira-description-editor :deep(.prose code) {
  font-size: 0.875em;
}

.jira-description-editor :deep(.prose pre) {
  margin-top: 0.75rem;
  margin-bottom: 0.75rem;
}

.jira-description-editor :deep(.prose blockquote) {
  font-style: italic;
  border-left-width: 4px;
}
</style>
