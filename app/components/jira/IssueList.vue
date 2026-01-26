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
</script>

<template>
  <div class="flex-1 min-h-0 overflow-y-auto">
    <!-- Loading Skeleton -->
    <div v-if="loading && !issues.length" class="p-4 space-y-3">
      <USkeleton v-for="i in 6" :key="i" class="h-20 w-full" />
    </div>

    <!-- Error -->
    <div v-else-if="error" class="p-4">
      <UAlert
        color="error"
        variant="subtle"
        icon="i-lucide-alert-circle"
        title="Errore nel caricamento"
        :description="error.message"
      />
    </div>

    <!-- Empty State -->
    <div v-else-if="!issues.length" class="flex flex-col items-center justify-center h-full p-8 text-center">
      <div class="w-16 h-16 bg-[var(--ui-bg-muted)] flex items-center justify-center mb-4">
        <UIcon name="i-lucide-inbox" class="w-8 h-8 text-[var(--ui-text-dimmed)]" />
      </div>
      <p class="text-[var(--ui-text-muted)] font-medium">Nessuna issue trovata</p>
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

    <!-- Issues List -->
    <div v-else class="divide-y divide-[var(--ui-border)]">
      <JiraIssueListItem
        v-for="issue in issues"
        :key="issue.key"
        :issue="issue"
        :selected="selectedKey === issue.key"
        @select="$emit('select', $event)"
      />
    </div>
  </div>
</template>
