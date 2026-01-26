<script setup lang="ts">
const props = defineProps<{
  labels: string[]
  assignees: string[]
  loading?: boolean
}>()

const searchQuery = defineModel<string>('search', { default: '' })
const statusFilter = defineModel<string>('status', { default: 'all' })
const labelFilter = defineModel<string>('label', { default: '' })
const assigneeFilter = defineModel<string>('assignee', { default: '' })

defineEmits<{
  clearFilters: []
}>()

const statusTabs = [
  { value: 'all', label: 'Tutte' },
  { value: 'open', label: 'Aperte' },
  { value: 'in_progress', label: 'In Corso' },
  { value: 'done', label: 'Chiuse' }
]

const hasActiveFilters = computed(() => labelFilter.value || assigneeFilter.value)
</script>

<template>
  <div class="shrink-0 p-4 space-y-4 border-b border-neutral-200 dark:border-neutral-800">
    <UInput
      v-model="searchQuery"
      placeholder="Cerca per chiave, titolo..."
      icon="i-lucide-search"
      size="lg"
      :loading="loading"
    />

    <!-- Status Tabs -->
    <UTabs
      :items="statusTabs"
      :model-value="statusFilter"
      @update:model-value="statusFilter = $event as string"
      color="neutral"
      variant="pill"
    />

    <!-- Additional Filters -->
    <div class="flex gap-2">
      <USelectMenu
        v-model="labelFilter"
        :items="labels"
        placeholder="Filtra per label"
        icon="i-lucide-tag"
        size="sm"
        class="flex-1"
      >
        <template #empty>
          <span class="text-neutral-500 dark:text-neutral-400">Nessuna label</span>
        </template>
      </USelectMenu>
      <USelectMenu
        v-model="assigneeFilter"
        :items="assignees"
        placeholder="Filtra per assegnatario"
        icon="i-lucide-user"
        size="sm"
        class="flex-1"
      >
        <template #empty>
          <span class="text-neutral-500 dark:text-neutral-400">Nessun assegnatario</span>
        </template>
      </USelectMenu>
    </div>

    <!-- Active Filters Indicator -->
    <div v-if="hasActiveFilters" class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <UBadge v-if="labelFilter" color="info" variant="subtle" class="gap-1">
          <UIcon name="i-lucide-tag" class="w-3 h-3" />
          {{ labelFilter }}
        </UBadge>
        <UBadge v-if="assigneeFilter" color="info" variant="subtle" class="gap-1">
          <UIcon name="i-lucide-user" class="w-3 h-3" />
          {{ assigneeFilter }}
        </UBadge>
      </div>
      <UButton
        size="xs"
        color="neutral"
        variant="ghost"
        icon="i-lucide-x"
        @click="$emit('clearFilters')"
      >
        Rimuovi
      </UButton>
    </div>
  </div>
</template>
