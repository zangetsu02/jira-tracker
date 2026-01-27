<script setup lang="ts">
import type { JiraIssue } from '~/composables/useJiraHelpers'

const props = defineProps<{
  issues: JiraIssue[]
  selectedKey: string | null
  loading?: boolean
  error?: Error | null
  hasActiveFilters?: boolean
}>()

const emit = defineEmits<{
  select: [key: string]
  clearFilters: []
}>()

// Keyboard navigation
const listRef = ref<HTMLElement | null>(null)
const focusedIndex = ref(-1)

const handleKeyDown = (event: KeyboardEvent) => {
  if (!props.issues.length) return

  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault()
      focusedIndex.value = Math.min(focusedIndex.value + 1, props.issues.length - 1)
      focusItem(focusedIndex.value)
      break
    case 'ArrowUp':
      event.preventDefault()
      focusedIndex.value = Math.max(focusedIndex.value - 1, 0)
      focusItem(focusedIndex.value)
      break
    case 'Enter':
    case ' ':
      event.preventDefault()
      if (focusedIndex.value >= 0 && focusedIndex.value < props.issues.length) {
        emit('select', props.issues[focusedIndex.value].key)
      }
      break
    case 'Home':
      event.preventDefault()
      focusedIndex.value = 0
      focusItem(0)
      break
    case 'End':
      event.preventDefault()
      focusedIndex.value = props.issues.length - 1
      focusItem(focusedIndex.value)
      break
  }
}

const focusItem = (index: number) => {
  const items = listRef.value?.querySelectorAll('[role="option"]')
  if (items && items[index]) {
    (items[index] as HTMLElement).focus()
    // Scroll into view
    ;(items[index] as HTMLElement).scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }
}

// Update focused index when selection changes
watch(() => props.selectedKey, (key) => {
  if (key) {
    const index = props.issues.findIndex(issue => issue.key === key)
    if (index >= 0) {
      focusedIndex.value = index
    }
  }
})
</script>

<template>
  <div class="flex-1 min-h-0 flex flex-col overflow-hidden">
    <!-- Loading Skeleton -->
    <div
      v-if="loading && !issues.length"
      class="p-4 space-y-3 overflow-y-auto"
    >
      <USkeleton
        v-for="i in 6"
        :key="i"
        class="h-20 w-full"
      />
    </div>

    <!-- Error -->
    <div
      v-else-if="error"
      class="p-4"
    >
      <UAlert
        color="error"
        variant="subtle"
        icon="i-lucide-alert-circle"
        title="Errore nel caricamento"
        :description="error.message"
      />
    </div>

    <!-- Empty State -->
    <div
      v-else-if="!issues.length"
      class="flex flex-col items-center justify-center flex-1 p-8 text-center"
      role="status"
      aria-live="polite"
    >
      <div class="w-16 h-16 bg-[var(--ui-bg-muted)] flex items-center justify-center mb-4">
        <UIcon
          name="i-lucide-inbox"
          class="w-8 h-8 text-[var(--ui-text-dimmed)]"
        />
      </div>
      <p class="text-[var(--ui-text-muted)] font-medium">
        Nessuna issue trovata
      </p>
      <p class="text-sm text-[var(--ui-text-dimmed)] mt-1">
        {{ hasActiveFilters ? 'Prova a modificare i filtri' : 'Non ci sono issue da mostrare' }}
      </p>
      <UButton
        v-if="hasActiveFilters"
        size="sm"
        color="neutral"
        variant="soft"
        class="mt-4"
        @click="$emit('clearFilters')"
      >
        Rimuovi filtri
      </UButton>
    </div>

    <!-- Issues List with custom scroll -->
    <div
      v-else
      ref="listRef"
      role="listbox"
      :aria-label="`Lista issue, ${issues.length} risultati`"
      tabindex="0"
      class="issue-list-scroll flex-1 overflow-y-auto focus:outline-none"
      @keydown="handleKeyDown"
    >
      <div class="divide-y divide-[var(--ui-border)]">
        <JiraIssueListItem
          v-for="(issue, index) in issues"
          :id="`issue-${issue.key}`"
          :key="issue.key"
          :issue="issue"
          :selected="selectedKey === issue.key"
          :focused="focusedIndex === index"
          role="option"
          :aria-selected="selectedKey === issue.key"
          :tabindex="focusedIndex === index ? 0 : -1"
          @select="$emit('select', $event)"
        />
      </div>
    </div>

    <!-- Screen reader announcement -->
    <div
      class="sr-only"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {{ issues.length }} issue trovate
    </div>
  </div>
</template>

<style scoped>
/* Custom scrollbar styling */
.issue-list-scroll {
  scrollbar-width: thin;
  scrollbar-color: var(--ui-border) transparent;
}

.issue-list-scroll::-webkit-scrollbar {
  width: 6px;
}

.issue-list-scroll::-webkit-scrollbar-track {
  background: transparent;
}

.issue-list-scroll::-webkit-scrollbar-thumb {
  background-color: var(--ui-border);
  border-radius: 3px;
}

.issue-list-scroll::-webkit-scrollbar-thumb:hover {
  background-color: var(--ui-border-accented);
}

/* Screen reader only utility */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
