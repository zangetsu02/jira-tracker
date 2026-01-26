<script setup lang="ts">
const props = defineProps<{
  content: string | null | undefined
}>()

// Convert Jira markup to HTML for preview
const convertJiraToHtml = (text: string): string => {
  if (!text) return ''
  
  let html = text
    // Escape HTML first
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  
  // Code block: {code}...{code} - process first to avoid inner replacements
  html = html.replace(/\{code(?::([^}]*))?\}([\s\S]*?)\{code\}/g, (_match, lang, code) => {
    const langLabel = lang ? `<span class="code-lang">${lang}</span>` : ''
    return `<div class="code-block">${langLabel}<pre><code>${code.trim()}</code></pre></div>`
  })
  
  // Blockquote: {quote}...{quote}
  html = html.replace(/\{quote\}([\s\S]*?)\{quote\}/g, '<blockquote class="jira-quote">$1</blockquote>')
  
  // Panel: {panel}...{panel}
  html = html.replace(/\{panel(?::([^}]*))?\}([\s\S]*?)\{panel\}/g, (_match, title, content) => {
    const titleHtml = title ? `<div class="panel-title">${title}</div>` : ''
    return `<div class="jira-panel">${titleHtml}<div class="panel-content">${content.trim()}</div></div>`
  })
  
  // Note: {note}...{note}
  html = html.replace(/\{note(?::([^}]*))?\}([\s\S]*?)\{note\}/g, (_match, title, content) => {
    const titleHtml = title ? `<div class="note-title">${title}</div>` : ''
    return `<div class="jira-note">${titleHtml}<div class="note-content">${content.trim()}</div></div>`
  })
  
  // Headers: h1. h2. h3. etc (must be at start of line)
  html = html.replace(/^h1\.\s*(.+)$/gm, '<h1>$1</h1>')
  html = html.replace(/^h2\.\s*(.+)$/gm, '<h2>$1</h2>')
  html = html.replace(/^h3\.\s*(.+)$/gm, '<h3>$1</h3>')
  html = html.replace(/^h4\.\s*(.+)$/gm, '<h4>$1</h4>')
  html = html.replace(/^h5\.\s*(.+)$/gm, '<h5>$1</h5>')
  html = html.replace(/^h6\.\s*(.+)$/gm, '<h6>$1</h6>')
  
  // Bold: *text*
  html = html.replace(/\*([^*\n]+)\*/g, '<strong>$1</strong>')
  
  // Italic: _text_
  html = html.replace(/_([^_\n]+)_/g, '<em>$1</em>')
  
  // Strikethrough: -text- (but not ----)
  html = html.replace(/(?<!-)-([^-\n]+)-(?!-)/g, '<del>$1</del>')
  
  // Underline: +text+
  html = html.replace(/\+([^+\n]+)\+/g, '<u>$1</u>')
  
  // Monospace: {{text}}
  html = html.replace(/\{\{([^}]+)\}\}/g, '<code class="inline-code">$1</code>')
  
  // Color: {color:red}text{color}
  html = html.replace(/\{color:([^}]+)\}([\s\S]*?)\{color\}/g, '<span style="color: $1">$2</span>')
  
  // Links: [text|url] or [url]
  html = html.replace(/\[([^\]|]+)\|([^\]]+)\]/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
  html = html.replace(/\[((https?:\/\/|www\.)[^\]]+)\]/g, '<a href="$1" target="_blank" rel="noopener">$1</a>')
  
  // Bullet list: * item (at start of line)
  html = html.replace(/^\*\s+(.+)$/gm, '<li class="bullet">$1</li>')
  
  // Numbered list: # item
  html = html.replace(/^#\s+(.+)$/gm, '<li class="numbered">$1</li>')
  
  // Horizontal rule: ----
  html = html.replace(/^-{4,}$/gm, '<hr />')
  
  // Wrap consecutive bullet items in <ul>
  html = html.replace(/(<li class="bullet">.*?<\/li>\n?)+/g, (match) => {
    return `<ul>${match}</ul>`
  })
  
  // Wrap consecutive numbered items in <ol>
  html = html.replace(/(<li class="numbered">.*?<\/li>\n?)+/g, (match) => {
    return `<ol>${match}</ol>`
  })
  
  // Convert double line breaks to paragraph breaks
  html = html.replace(/\n\n+/g, '</p><p>')
  
  // Convert single line breaks to <br>
  html = html.replace(/\n/g, '<br>')
  
  // Wrap in paragraph if not starting with block element
  if (!html.match(/^<(h[1-6]|ul|ol|div|blockquote|pre|hr)/)) {
    html = `<p>${html}</p>`
  }
  
  // Clean up empty paragraphs
  html = html.replace(/<p><\/p>/g, '')
  html = html.replace(/<p>(<(h[1-6]|ul|ol|div|blockquote|pre|hr))/g, '$1')
  html = html.replace(/(<\/(h[1-6]|ul|ol|div|blockquote|pre)>)<\/p>/g, '$1')
  
  return html
}

const previewHtml = computed(() => {
  return convertJiraToHtml(props.content || '')
})
</script>

<template>
  <div 
    v-if="content"
    class="jira-preview"
    v-html="previewHtml"
  />
  <p v-else class="empty-text">
    Nessuna descrizione
  </p>
</template>

<style scoped>
.empty-text {
  font-size: 0.875rem;
  color: var(--ui-text-dimmed);
  font-style: italic;
}

.jira-preview {
  font-family: var(--font-sans), system-ui, sans-serif;
  font-size: 0.875rem;
  line-height: 1.7;
  color: var(--ui-text);
}

.jira-preview :deep(h1) {
  font-size: 1.5rem;
  font-weight: 700;
  margin-top: 1.5rem;
  margin-bottom: 0.75rem;
  color: var(--ui-text);
}

.jira-preview :deep(h1:first-child) {
  margin-top: 0;
}

.jira-preview :deep(h2) {
  font-size: 1.25rem;
  font-weight: 600;
  margin-top: 1.5rem;
  margin-bottom: 0.5rem;
  color: var(--ui-text);
}

.jira-preview :deep(h2:first-child) {
  margin-top: 0;
}

.jira-preview :deep(h3) {
  font-size: 1.1rem;
  font-weight: 600;
  margin-top: 1.25rem;
  margin-bottom: 0.5rem;
  color: var(--ui-text);
}

.jira-preview :deep(h3:first-child) {
  margin-top: 0;
}

.jira-preview :deep(h4),
.jira-preview :deep(h5),
.jira-preview :deep(h6) {
  font-size: 1rem;
  font-weight: 600;
  margin-top: 1rem;
  margin-bottom: 0.375rem;
  color: var(--ui-text);
}

.jira-preview :deep(p) {
  margin-top: 0.5rem;
  margin-bottom: 0.5rem;
}

.jira-preview :deep(p:first-child) {
  margin-top: 0;
}

.jira-preview :deep(p:last-child) {
  margin-bottom: 0;
}

.jira-preview :deep(strong) {
  font-weight: 600;
}

.jira-preview :deep(em) {
  font-style: italic;
}

.jira-preview :deep(del) {
  text-decoration: line-through;
  opacity: 0.7;
}

.jira-preview :deep(u) {
  text-decoration: underline;
}

.jira-preview :deep(a) {
  color: #2563eb;
  text-decoration: none;
}

.jira-preview :deep(a:hover) {
  text-decoration: underline;
}

.dark .jira-preview :deep(a) {
  color: #60a5fa;
}

.jira-preview :deep(.inline-code) {
  padding: 0.125rem 0.375rem;
  background: var(--ui-bg-muted);
  border-radius: 0.25rem;
  font-family: var(--font-mono), monospace;
  font-size: 0.8125rem;
  color: #db2777;
}

.dark .jira-preview :deep(.inline-code) {
  color: #f472b6;
}

.jira-preview :deep(.code-block) {
  position: relative;
  margin: 0.75rem 0;
}

.jira-preview :deep(.code-block pre) {
  padding: 1rem;
  background: var(--ui-bg-muted);
  border-radius: 0.5rem;
  overflow-x: auto;
}

.jira-preview :deep(.code-block code) {
  font-family: var(--font-mono), monospace;
  font-size: 0.8125rem;
  color: var(--ui-text);
}

.jira-preview :deep(.code-block .code-lang) {
  position: absolute;
  top: 0.5rem;
  right: 0.75rem;
  font-size: 0.6875rem;
  color: var(--ui-text-dimmed);
  text-transform: uppercase;
}

.jira-preview :deep(.jira-quote) {
  margin: 0.75rem 0;
  padding: 0.75rem 1rem;
  border-left: 4px solid #3b82f6;
  background: rgba(59, 130, 246, 0.08);
  border-radius: 0 0.375rem 0.375rem 0;
  font-style: italic;
  color: var(--ui-text-muted);
}

.jira-preview :deep(.jira-panel) {
  margin: 0.75rem 0;
  padding: 1rem;
  background: rgba(59, 130, 246, 0.08);
  border: 1px solid rgba(59, 130, 246, 0.2);
  border-radius: 0.5rem;
}

.jira-preview :deep(.jira-panel .panel-title) {
  font-weight: 600;
  font-size: 0.875rem;
  margin-bottom: 0.5rem;
  color: #2563eb;
}

.dark .jira-preview :deep(.jira-panel .panel-title) {
  color: #60a5fa;
}

.jira-preview :deep(.jira-note) {
  margin: 0.75rem 0;
  padding: 1rem;
  background: rgba(245, 158, 11, 0.08);
  border: 1px solid rgba(245, 158, 11, 0.2);
  border-radius: 0.5rem;
}

.jira-preview :deep(.jira-note .note-title) {
  font-weight: 600;
  font-size: 0.875rem;
  margin-bottom: 0.5rem;
  color: #d97706;
}

.dark .jira-preview :deep(.jira-note .note-title) {
  color: #fbbf24;
}

.jira-preview :deep(ul) {
  margin: 0.5rem 0;
  padding-left: 1.5rem;
  list-style-type: disc;
}

.jira-preview :deep(ol) {
  margin: 0.5rem 0;
  padding-left: 1.5rem;
  list-style-type: decimal;
}

.jira-preview :deep(li) {
  margin: 0.25rem 0;
}

.jira-preview :deep(hr) {
  margin: 1rem 0;
  border: none;
  border-top: 1px solid var(--ui-border);
}

.jira-preview :deep(br) {
  display: block;
  content: "";
}
</style>
