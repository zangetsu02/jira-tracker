<script setup lang="ts">
const props = defineProps<{
  labels: string[]
  assignees: string[]
  priorities: string[]
  issueTypes: string[]
  totalCount: number
  filteredCount: number
  loading?: boolean
}>()

const searchQuery = defineModel<string>('search', { default: '' })
const statusFilter = defineModel<string>('status', { default: 'all' })
const labelFilter = defineModel<string>('label', { default: '' })
const assigneeFilter = defineModel<string>('assignee', { default: '' })
const priorityFilter = defineModel<string>('priority', { default: '' })
const issueTypeFilter = defineModel<string>('issueType', { default: '' })
const sortBy = defineModel<string>('sortBy', { default: 'updated' })
const sortOrder = defineModel<string>('sortOrder', { default: 'desc' })

defineEmits<{
  clearFilters: []
}>()

const statusTabs = [
  { value: 'all', label: 'Tutte', icon: 'i-lucide-layers' },
  { value: 'open', label: 'Aperte', icon: 'i-lucide-circle-dot' },
  { value: 'in_progress', label: 'In Corso', icon: 'i-lucide-loader' },
  { value: 'done', label: 'Chiuse', icon: 'i-lucide-check-circle' }
]

const sortOptions = [
  { label: 'Ultima modifica', value: 'updated', icon: 'i-lucide-clock' },
  { label: 'Data creazione', value: 'created', icon: 'i-lucide-calendar-plus' },
  { label: 'Priorità', value: 'priority', icon: 'i-lucide-signal' },
  { label: 'Chiave', value: 'key', icon: 'i-lucide-hash' }
]

const hasActiveFilters = computed(() => 
  labelFilter.value || 
  assigneeFilter.value || 
  priorityFilter.value || 
  issueTypeFilter.value
)

const activeFiltersCount = computed(() => {
  let count = 0
  if (labelFilter.value) count++
  if (assigneeFilter.value) count++
  if (priorityFilter.value) count++
  if (issueTypeFilter.value) count++
  return count
})

// Expanded state for collapsible filters
const filtersExpanded = ref(true)

// Toggle sort order
const toggleSortOrder = () => {
  sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
}

// Priority items with icons
const priorityItems = computed(() => {
  return props.priorities.map(p => ({
    label: p,
    value: p,
    icon: getPriorityIcon(p)
  }))
})

// Priority icon helper
const getPriorityIcon = (priority: string): string => {
  const p = priority.toLowerCase()
  if (p === 'highest' || p === 'critico') return 'i-lucide-chevrons-up'
  if (p === 'high' || p === 'alta') return 'i-lucide-chevron-up'
  if (p === 'low' || p === 'bassa') return 'i-lucide-chevron-down'
  if (p === 'lowest' || p === 'minima') return 'i-lucide-chevrons-down'
  return 'i-lucide-minus'
}
</script>

<template>
  <div 
    class="shrink-0 border-b border-[var(--ui-border)]"
    role="search"
    aria-label="Filtri issue"
  >
    <!-- Search Header -->
    <div class="p-4 space-y-4">
      <!-- Search Input -->
      <div class="relative">
        <UInput
          v-model="searchQuery"
          placeholder="Cerca per chiave, titolo..."
          icon="i-lucide-search"
          size="lg"
          :loading="loading"
          aria-label="Cerca issue"
          :ui="{ 
            base: 'w-full',
            icon: { leading: { wrapper: 'text-[var(--ui-text-muted)]' } }
          }"
        >
          <template v-if="searchQuery" #trailing>
            <UButton
              color="neutral"
              variant="ghost"
              size="xs"
              icon="i-lucide-x"
              aria-label="Cancella ricerca"
              @click="searchQuery = ''"
            />
          </template>
        </UInput>
      </div>

      <!-- Results Count -->
      <div class="flex items-center justify-between text-sm">
        <span class="text-[var(--ui-text-muted)]">
          <span class="font-semibold text-[var(--ui-text)]">{{ filteredCount }}</span>
          di {{ totalCount }} issue
        </span>
        <UButton
          v-if="hasActiveFilters"
          size="xs"
          color="neutral"
          variant="ghost"
          icon="i-lucide-filter-x"
          aria-label="Rimuovi tutti i filtri"
          @click="$emit('clearFilters')"
        >
          Rimuovi filtri
          <UBadge 
            color="neutral" 
            variant="solid" 
            size="xs"
            class="ml-1"
          >
            {{ activeFiltersCount }}
          </UBadge>
        </UButton>
      </div>

      <!-- Status Tabs -->
      <UTabs
        :items="statusTabs"
        :model-value="statusFilter"
        color="neutral"
        variant="pill"
        :ui="{
          list: 'gap-1',
          trigger: 'px-3 py-1.5 text-sm'
        }"
        aria-label="Filtra per stato"
        @update:model-value="statusFilter = $event as string"
      />
    </div>

    <!-- Collapsible Advanced Filters -->
    <UCollapsible v-model:open="filtersExpanded" class="flex flex-col">
      <!-- Trigger button - this is the default slot -->
      <div class="px-4 pb-2">
        <UButton
          color="neutral"
          variant="ghost"
          size="sm"
          class="w-full justify-between"
          :trailing-icon="filtersExpanded ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
        >
          <span class="flex items-center gap-2">
            <UIcon name="i-lucide-sliders-horizontal" class="w-4 h-4" />
            Filtri avanzati
          </span>
        </UButton>
      </div>

      <template #content>
        <div 
          id="advanced-filters"
          class="px-4 pb-4 space-y-4"
        >
          <!-- Filter Grid -->
          <div class="grid grid-cols-2 gap-3">
            <!-- Priority Filter -->
            <UFormField label="Priorità" class="space-y-1.5">
              <USelectMenu
                v-model="priorityFilter"
                :items="priorityItems"
                placeholder="Tutte"
                size="sm"
                value-key="value"
                aria-label="Filtra per priorità"
                :ui="{ base: 'w-full' }"
              >
                <template #leading>
                  <UIcon name="i-lucide-signal" class="w-4 h-4 text-[var(--ui-text-muted)]" />
                </template>
                <template #empty>
                  <span class="text-[var(--ui-text-muted)] text-sm">Nessuna priorità</span>
                </template>
              </USelectMenu>
            </UFormField>

            <!-- Issue Type Filter -->
            <UFormField label="Tipo" class="space-y-1.5">
              <USelectMenu
                v-model="issueTypeFilter"
                :items="issueTypes"
                placeholder="Tutti"
                size="sm"
                aria-label="Filtra per tipo issue"
                :ui="{ base: 'w-full' }"
              >
                <template #leading>
                  <UIcon name="i-lucide-layout-list" class="w-4 h-4 text-[var(--ui-text-muted)]" />
                </template>
                <template #empty>
                  <span class="text-[var(--ui-text-muted)] text-sm">Nessun tipo</span>
                </template>
              </USelectMenu>
            </UFormField>

            <!-- Label Filter -->
            <UFormField label="Label" class="space-y-1.5">
              <USelectMenu
                v-model="labelFilter"
                :items="labels"
                placeholder="Tutte"
                size="sm"
                searchable
                searchable-placeholder="Cerca label..."
                aria-label="Filtra per label"
                :ui="{ base: 'w-full' }"
              >
                <template #leading>
                  <UIcon name="i-lucide-tag" class="w-4 h-4 text-[var(--ui-text-muted)]" />
                </template>
                <template #empty>
                  <span class="text-[var(--ui-text-muted)] text-sm">Nessuna label</span>
                </template>
              </USelectMenu>
            </UFormField>

            <!-- Assignee Filter -->
            <UFormField label="Assegnatario" class="space-y-1.5">
              <USelectMenu
                v-model="assigneeFilter"
                :items="assignees"
                placeholder="Tutti"
                size="sm"
                searchable
                searchable-placeholder="Cerca assegnatario..."
                aria-label="Filtra per assegnatario"
                :ui="{ base: 'w-full' }"
              >
                <template #leading>
                  <UIcon name="i-lucide-user" class="w-4 h-4 text-[var(--ui-text-muted)]" />
                </template>
                <template #empty>
                  <span class="text-[var(--ui-text-muted)] text-sm">Nessun assegnatario</span>
                </template>
              </USelectMenu>
            </UFormField>
          </div>

          <!-- Sort Options -->
          <div class="pt-2 border-t border-[var(--ui-border)]">
            <UFormField label="Ordina per" class="space-y-1.5">
              <div class="flex gap-2">
                <USelectMenu
                  v-model="sortBy"
                  :items="sortOptions"
                  value-key="value"
                  size="sm"
                  aria-label="Campo ordinamento"
                  class="flex-1"
                >
                  <template #leading>
                    <UIcon name="i-lucide-arrow-up-down" class="w-4 h-4 text-[var(--ui-text-muted)]" />
                  </template>
                </USelectMenu>
                <UTooltip :text="sortOrder === 'asc' ? 'Ordine crescente' : 'Ordine decrescente'">
                  <UButton
                    color="neutral"
                    variant="soft"
                    size="sm"
                    :icon="sortOrder === 'asc' ? 'i-lucide-arrow-up-narrow-wide' : 'i-lucide-arrow-down-wide-narrow'"
                    :aria-label="sortOrder === 'asc' ? 'Ordine crescente' : 'Ordine decrescente'"
                    @click="toggleSortOrder"
                  />
                </UTooltip>
              </div>
            </UFormField>
          </div>

          <!-- Active Filters Pills -->
          <div v-if="hasActiveFilters" class="flex flex-wrap gap-2 pt-2">
            <UBadge 
              v-if="priorityFilter" 
              color="neutral" 
              variant="subtle" 
              class="gap-1 pr-1"
            >
              <UIcon :name="getPriorityIcon(priorityFilter)" class="w-3 h-3" />
              {{ priorityFilter }}
              <UButton
                color="neutral"
                variant="ghost"
                size="xs"
                icon="i-lucide-x"
                class="ml-1 -mr-1"
                aria-label="Rimuovi filtro priorità"
                @click="priorityFilter = ''"
              />
            </UBadge>
            <UBadge 
              v-if="issueTypeFilter" 
              color="neutral" 
              variant="subtle" 
              class="gap-1 pr-1"
            >
              <UIcon name="i-lucide-layout-list" class="w-3 h-3" />
              {{ issueTypeFilter }}
              <UButton
                color="neutral"
                variant="ghost"
                size="xs"
                icon="i-lucide-x"
                class="ml-1 -mr-1"
                aria-label="Rimuovi filtro tipo"
                @click="issueTypeFilter = ''"
              />
            </UBadge>
            <UBadge 
              v-if="labelFilter" 
              color="neutral" 
              variant="subtle" 
              class="gap-1 pr-1"
            >
              <UIcon name="i-lucide-tag" class="w-3 h-3" />
              {{ labelFilter }}
              <UButton
                color="neutral"
                variant="ghost"
                size="xs"
                icon="i-lucide-x"
                class="ml-1 -mr-1"
                aria-label="Rimuovi filtro label"
                @click="labelFilter = ''"
              />
            </UBadge>
            <UBadge 
              v-if="assigneeFilter" 
              color="neutral" 
              variant="subtle" 
              class="gap-1 pr-1"
            >
              <UIcon name="i-lucide-user" class="w-3 h-3" />
              {{ assigneeFilter }}
              <UButton
                color="neutral"
                variant="ghost"
                size="xs"
                icon="i-lucide-x"
                class="ml-1 -mr-1"
                aria-label="Rimuovi filtro assegnatario"
                @click="assigneeFilter = ''"
              />
            </UBadge>
          </div>
        </div>
      </template>
    </UCollapsible>
  </div>
</template>
