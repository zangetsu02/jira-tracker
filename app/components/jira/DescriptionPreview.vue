<script setup lang="ts">
import type { JiraAttachmentInfo } from '~/composables/useJiraMarkup'

const props = defineProps<{
  content: string | null | undefined
  attachments?: Array<{
    filename: string
    content: string
    thumbnail?: string
    mimeType: string
  }>
}>()

const { convertToHtml } = useJiraMarkup()

// Lightbox state
const lightboxOpen = ref(false)
const lightboxSrc = ref('')
const lightboxAlt = ref('')

// Build attachments map for lookup
const attachmentsMap = computed(() => {
  if (!props.attachments) return undefined
  const map = new Map<string, JiraAttachmentInfo>()
  for (const a of props.attachments) {
    map.set(a.filename, a)
  }
  return map
})

const previewHtml = computed(() => convertToHtml(props.content || '', attachmentsMap.value))

// Handle click on images to open lightbox
const handleClick = (event: MouseEvent) => {
  const target = event.target as HTMLElement
  if (target.tagName === 'IMG' && target.classList.contains('jira-image')) {
    const img = target as HTMLImageElement
    // Get the full-size URL (content) instead of thumbnail
    const filename = img.alt
    const attachment = attachmentsMap.value?.get(filename)
    
    lightboxSrc.value = attachment?.content || img.src
    lightboxAlt.value = filename || 'Image'
    lightboxOpen.value = true
  }
}
</script>

<template>
  <div 
    v-if="content"
    class="jira-preview"
    v-html="previewHtml"
    @click="handleClick"
  />
  <p v-else class="empty-text">
    Nessuna descrizione
  </p>

  <!-- Image Lightbox -->
  <JiraImageLightbox
    v-model:open="lightboxOpen"
    :src="lightboxSrc"
    :alt="lightboxAlt"
  />
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
  color: var(--accent);
  text-decoration: none;
  transition: opacity 0.15s ease;
}

.jira-preview :deep(a:hover) {
  opacity: 0.8;
}

.jira-preview :deep(.inline-code) {
  padding: 0.125rem 0.375rem;
  background: var(--ui-bg-muted);
  font-family: var(--font-mono), monospace;
  font-size: 0.8125rem;
  color: var(--accent);
}

.jira-preview :deep(.code-block) {
  position: relative;
  margin: 0.75rem 0;
}

.jira-preview :deep(.code-block pre) {
  padding: 1rem;
  background: var(--ui-bg-muted);
  border: 1px solid var(--ui-border);
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
  border-left: 3px solid var(--accent);
  background: var(--accent-soft);
  font-style: italic;
  color: var(--ui-text-muted);
}

.jira-preview :deep(.jira-panel) {
  margin: 0.75rem 0;
  padding: 1rem;
  background: var(--accent-soft);
  border: 1px solid var(--ui-border);
}

.jira-preview :deep(.jira-panel .panel-title) {
  font-weight: 600;
  font-size: 0.875rem;
  margin-bottom: 0.5rem;
  color: var(--accent);
}

.jira-preview :deep(.jira-note) {
  margin: 0.75rem 0;
  padding: 1rem;
  background: var(--ui-warning-soft);
  border: 1px solid var(--ui-border);
}

.jira-preview :deep(.jira-note .note-title) {
  font-weight: 600;
  font-size: 0.875rem;
  margin-bottom: 0.5rem;
  color: var(--ui-warning);
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

.jira-preview :deep(.user-mention) {
  display: inline-flex;
  align-items: center;
  padding: 0.125rem 0.5rem;
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 0.8125rem;
  font-weight: 500;
}

/* Images */
.jira-preview :deep(.jira-image) {
  display: block;
  max-width: 100%;
  height: auto;
  margin: 0.75rem 0;
  border-radius: 0.5rem;
  border: 1px solid var(--ui-border);
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.jira-preview :deep(.jira-image:hover) {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.jira-preview :deep(.jira-image.thumbnail) {
  max-width: 200px;
  max-height: 150px;
  object-fit: cover;
}

/* Inline images (within text) */
.jira-preview :deep(p > .jira-image) {
  display: inline-block;
  vertical-align: middle;
  margin: 0.25rem 0.5rem 0.25rem 0;
  max-height: 1.5em;
  border-radius: 0.25rem;
}

/* Unresolved attachment placeholder */
.jira-preview :deep(.jira-image[data-attachment]) {
  min-height: 60px;
  min-width: 120px;
  background: linear-gradient(135deg, var(--ui-bg-muted) 0%, var(--ui-bg) 100%);
  border: 2px dashed var(--ui-border);
  border-radius: 0.5rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 1rem;
  color: var(--ui-text-dimmed);
  font-size: 0.75rem;
}

.jira-preview :deep(.jira-image[data-attachment])::before {
  content: "Allegato: " attr(data-attachment);
}
</style>
