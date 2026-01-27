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

const statusOptions = [
  { label: 'Tutte', value: 'all' },
  { label: 'Aperte', value: 'open' },
  { label: 'In Corso', value: 'in_progress' },
  { label: 'Chiuse', value: 'done' }
]

const sortOptions = [
  { label: 'Ultima modifica', value: 'updated' },
  { label: 'Data creazione', value: 'created' },
  { label: 'Priorità', value: 'priority' },
  { label: 'Chiave', value: 'key' }
]

const hasActiveFilters = computed(() =>
  labelFilter.value
  || assigneeFilter.value
  || priorityFilter.value
  || issueTypeFilter.value
  || (statusFilter.value && statusFilter.value !== 'all')
)

const activeFiltersCount = computed(() => {
  let count = 0
  if (labelFilter.value) count++
  if (assigneeFilter.value) count++
  if (priorityFilter.value) count++
  if (issueTypeFilter.value) count++
  if (statusFilter.value && statusFilter.value !== 'all') count++
  return count
})

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

// Get display label for status
const getStatusLabel = (value: string) => {
  return statusOptions.find(o => o.value === value)?.label || 'Tutte'
}

// Get display label for sort
const getSortLabel = (value: string) => {
  return sortOptions.find(o => o.value === value)?.label || 'Ultima modifica'
}
</script>

<template>
  <div
    class="shrink-0 border border-[var(--ui-border)] bg-[var(--ui-bg)] rounded-lg"
    role="search"
    aria-label="Filtri issue"
  >
    <!-- Single Row: Search + Filters + Sort -->
    <div class="p-3 flex flex-wrap items-center gap-2">
      <!-- Search Input -->
      <UInput
        v-model="searchQuery"
        placeholder="Cerca..."
        icon="i-lucide-search"
        size="sm"
        :loading="loading"
        aria-label="Cerca issue"
        class="w-48"
      >
        <template
          v-if="searchQuery"
          #trailing
        >
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

      <!-- Divider -->
      <div class="h-5 w-px bg-[var(--ui-border)]" />

      <!-- Status Filter -->
      <UDropdownMenu :items="statusOptions.map(o => ({ label: o.label, click: () => statusFilter = o.value }))">
        <UButton
          color="neutral"
          variant="ghost"
          size="sm"
          trailing-icon="i-lucide-chevron-down"
          :class="{ 'bg-[var(--ui-bg-elevated)] ring-1 ring-[var(--ui-border-accented)]': statusFilter !== 'all' }"
        >
          Stato: {{ getStatusLabel(statusFilter) }}
        </UButton>
      </UDropdownMenu>

      <!-- Priority Filter -->
      <UDropdownMenu
        v-if="priorities.length"
        :items="[
          { label: 'Tutte', click: () => priorityFilter = '' },
          ...priorityItems.map(p => ({ label: p.label, icon: p.icon, click: () => priorityFilter = p.value }))
        ]"
      >
        <UButton
          color="neutral"
          variant="ghost"
          size="sm"
          trailing-icon="i-lucide-chevron-down"
          :class="{ 'bg-[var(--ui-bg-elevated)] ring-1 ring-[var(--ui-border-accented)]': priorityFilter }"
        >
          <template v-if="priorityFilter">
            <UIcon
              :name="getPriorityIcon(priorityFilter)"
              class="w-4 h-4"
            />
            {{ priorityFilter }}
          </template>
          <template v-else>
            Priorità
          </template>
        </UButton>
      </UDropdownMenu>

      <!-- Issue Type Filter -->
      <UDropdownMenu
        v-if="issueTypes.length"
        :items="[
          { label: 'Tutti', click: () => issueTypeFilter = '' },
          ...issueTypes.map(t => ({ label: t, click: () => issueTypeFilter = t }))
        ]"
      >
        <UButton
          color="neutral"
          variant="ghost"
          size="sm"
          trailing-icon="i-lucide-chevron-down"
          :class="{ 'bg-[var(--ui-bg-elevated)] ring-1 ring-[var(--ui-border-accented)]': issueTypeFilter }"
        >
          {{ issueTypeFilter || 'Tipo' }}
        </UButton>
      </UDropdownMenu>

      <!-- Assignee Filter -->
      <UDropdownMenu
        v-if="assignees.length"
        :items="[
          { label: 'Tutti', click: () => assigneeFilter = '' },
          ...assignees.map(a => ({ label: a, click: () => assigneeFilter = a }))
        ]"
      >
        <UButton
          color="neutral"
          variant="ghost"
          size="sm"
          trailing-icon="i-lucide-chevron-down"
          :class="{ 'bg-[var(--ui-bg-elevated)] ring-1 ring-[var(--ui-border-accented)]': assigneeFilter }"
        >
          {{ assigneeFilter || 'Assegnatario' }}
        </UButton>
      </UDropdownMenu>

      <!-- Label Filter -->
      <UDropdownMenu
        v-if="labels.length"
        :items="[
          { label: 'Tutte', click: () => labelFilter = '' },
          ...labels.map(l => ({ label: l, click: () => labelFilter = l }))
        ]"
      >
        <UButton
          color="neutral"
          variant="ghost"
          size="sm"
          trailing-icon="i-lucide-chevron-down"
          :class="{ 'bg-[var(--ui-bg-elevated)] ring-1 ring-[var(--ui-border-accented)]': labelFilter }"
        >
          <UIcon
            v-if="labelFilter"
            name="i-lucide-tag"
            class="w-3.5 h-3.5"
          />
          {{ labelFilter || 'Label' }}
        </UButton>
      </UDropdownMenu>

      <!-- Divider -->
      <div class="h-5 w-px bg-[var(--ui-border)]" />

      <!-- Sort -->
      <UDropdownMenu :items="sortOptions.map(o => ({ label: o.label, click: () => sortBy = o.value }))">
        <UButton
          color="neutral"
          variant="ghost"
          size="sm"
          trailing-icon="i-lucide-chevron-down"
        >
          {{ getSortLabel(sortBy) }}
        </UButton>
      </UDropdownMenu>

      <UTooltip :text="sortOrder === 'asc' ? 'Crescente' : 'Decrescente'">
        <UButton
          color="neutral"
          variant="ghost"
          size="sm"
          :icon="sortOrder === 'asc' ? 'i-lucide-arrow-up' : 'i-lucide-arrow-down'"
          :aria-label="sortOrder === 'asc' ? 'Ordine crescente' : 'Ordine decrescente'"
          @click="toggleSortOrder"
        />
      </UTooltip>

      <!-- Spacer -->
      <div class="flex-1" />

      <!-- Results Count -->
      <span class="text-sm text-[var(--ui-text-muted)]">
        <span class="font-medium text-[var(--ui-text)]">{{ filteredCount }}</span>
        di {{ totalCount }}
      </span>

      <!-- Clear Filters -->
      <UButton
        v-if="hasActiveFilters"
        color="neutral"
        variant="ghost"
        size="sm"
        icon="i-lucide-x"
        @click="$emit('clearFilters')"
      >
        Rimuovi filtri
      </UButton>
    </div>

    <!-- Active Filters Pills (only show if filters are active) -->
    <div
      v-if="hasActiveFilters"
      class="px-3 pb-3 flex flex-wrap items-center gap-2 border-t border-[var(--ui-border)] pt-3"
    >
      <span class="text-xs text-[var(--ui-text-muted)]">Filtri:</span>

      <UBadge
        v-if="statusFilter && statusFilter !== 'all'"
        color="primary"
        variant="subtle"
        size="sm"
        class="gap-1 pr-1"
      >
        Stato: {{ getStatusLabel(statusFilter) }}
        <UButton
          color="primary"
          variant="ghost"
          size="xs"
          icon="i-lucide-x"
          class="-mr-1"
          aria-label="Rimuovi filtro stato"
          @click="statusFilter = 'all'"
        />
      </UBadge>

      <UBadge
        v-if="priorityFilter"
        color="primary"
        variant="subtle"
        size="sm"
        class="gap-1 pr-1"
      >
        <UIcon
          :name="getPriorityIcon(priorityFilter)"
          class="w-3 h-3"
        />
        {{ priorityFilter }}
        <UButton
          color="primary"
          variant="ghost"
          size="xs"
          icon="i-lucide-x"
          class="-mr-1"
          aria-label="Rimuovi filtro priorità"
          @click="priorityFilter = ''"
        />
      </UBadge>

      <UBadge
        v-if="issueTypeFilter"
        color="primary"
        variant="subtle"
        size="sm"
        class="gap-1 pr-1"
      >
        {{ issueTypeFilter }}
        <UButton
          color="primary"
          variant="ghost"
          size="xs"
          icon="i-lucide-x"
          class="-mr-1"
          aria-label="Rimuovi filtro tipo"
          @click="issueTypeFilter = ''"
        />
      </UBadge>

      <UBadge
        v-if="assigneeFilter"
        color="primary"
        variant="subtle"
        size="sm"
        class="gap-1 pr-1"
      >
        <UIcon
          name="i-lucide-user"
          class="w-3 h-3"
        />
        {{ assigneeFilter }}
        <UButton
          color="primary"
          variant="ghost"
          size="xs"
          icon="i-lucide-x"
          class="-mr-1"
          aria-label="Rimuovi filtro assegnatario"
          @click="assigneeFilter = ''"
        />
      </UBadge>

      <UBadge
        v-if="labelFilter"
        color="primary"
        variant="subtle"
        size="sm"
        class="gap-1 pr-1"
      >
        <UIcon
          name="i-lucide-tag"
          class="w-3 h-3"
        />
        {{ labelFilter }}
        <UButton
          color="primary"
          variant="ghost"
          size="xs"
          icon="i-lucide-x"
          class="-mr-1"
          aria-label="Rimuovi filtro label"
          @click="labelFilter = ''"
        />
      </UBadge>
    </div>
  </div>
</template>
