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
const statusFilter = defineModel<string[]>('status', { default: () => [] })
const labelFilter = defineModel<string[]>('label', { default: () => [] })
const assigneeFilter = defineModel<string[]>('assignee', { default: () => [] })
const priorityFilter = defineModel<string>('priority', { default: '' })
const issueTypeFilter = defineModel<string>('issueType', { default: '' })
const sortBy = defineModel<string>('sortBy', { default: 'updated' })
const sortOrder = defineModel<string>('sortOrder', { default: 'desc' })

defineEmits<{
  clearFilters: []
}>()

const statusOptions = [
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
  labelFilter.value.length > 0
  || assigneeFilter.value.length > 0
  || priorityFilter.value
  || issueTypeFilter.value
  || statusFilter.value.length > 0
)

// Popover open states
const statusOpen = ref(false)
const priorityOpen = ref(false)
const typeOpen = ref(false)
const assigneeOpen = ref(false)
const labelOpen = ref(false)
const sortOpen = ref(false)

// Toggle sort order
const toggleSortOrder = () => {
  sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
}

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
  return statusOptions.find(o => o.value === value)?.label || value
}

// Get display label for sort
const getSortLabel = (value: string) => {
  return sortOptions.find(o => o.value === value)?.label || 'Ultima modifica'
}

// Select handlers
const toggleStatus = (value: string) => {
  const index = statusFilter.value.indexOf(value)
  if (index === -1) {
    statusFilter.value = [...statusFilter.value, value]
  } else {
    statusFilter.value = statusFilter.value.filter(s => s !== value)
  }
}

const clearStatuses = () => {
  statusFilter.value = []
  statusOpen.value = false
}

const selectPriority = (value: string) => {
  priorityFilter.value = value
  priorityOpen.value = false
}

const selectType = (value: string) => {
  issueTypeFilter.value = value
  typeOpen.value = false
}

const toggleAssignee = (value: string) => {
  const index = assigneeFilter.value.indexOf(value)
  if (index === -1) {
    assigneeFilter.value = [...assigneeFilter.value, value]
  } else {
    assigneeFilter.value = assigneeFilter.value.filter(a => a !== value)
  }
}

const clearAssignees = () => {
  assigneeFilter.value = []
  assigneeOpen.value = false
}

const toggleLabel = (value: string) => {
  const index = labelFilter.value.indexOf(value)
  if (index === -1) {
    labelFilter.value = [...labelFilter.value, value]
  } else {
    labelFilter.value = labelFilter.value.filter(l => l !== value)
  }
}

const clearLabels = () => {
  labelFilter.value = []
  labelOpen.value = false
}

const selectSort = (value: string) => {
  sortBy.value = value
  sortOpen.value = false
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

      <!-- Status Filter (Multi-select) -->
      <UPopover v-model:open="statusOpen">
        <UButton
          color="neutral"
          variant="ghost"
          size="sm"
          trailing-icon="i-lucide-chevron-down"
          :class="{ 'bg-[var(--ui-bg-elevated)] ring-1 ring-[var(--ui-border-accented)]': statusFilter.length > 0 }"
        >
          <template v-if="statusFilter.length === 0">
            Stato
          </template>
          <template v-else-if="statusFilter.length === 1">
            {{ getStatusLabel(statusFilter[0]) }}
          </template>
          <template v-else>
            {{ statusFilter.length }} stati
          </template>
        </UButton>
        <template #content>
          <div class="min-w-[160px]">
            <div class="p-2 border-b border-[var(--ui-border)] flex items-center justify-between">
              <span class="text-xs font-medium text-[var(--ui-text-muted)]">Stati</span>
              <button
                v-if="statusFilter.length > 0"
                class="text-xs text-primary-500 hover:underline"
                @click="clearStatuses"
              >
                Rimuovi tutti
              </button>
            </div>
            <div class="p-1">
              <label
                v-for="o in statusOptions"
                :key="o.value"
                class="flex items-center gap-2 px-3 py-2 text-sm rounded hover:bg-[var(--ui-bg-elevated)] cursor-pointer"
              >
                <UCheckbox
                  :model-value="statusFilter.includes(o.value)"
                  @update:model-value="toggleStatus(o.value)"
                />
                {{ o.label }}
              </label>
            </div>
          </div>
        </template>
      </UPopover>

      <!-- Priority Filter -->
      <UPopover
        v-if="priorities.length"
        v-model:open="priorityOpen"
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
        <template #content>
          <div class="p-1 min-w-[140px]">
            <button
              class="w-full flex items-center gap-2 px-3 py-2 text-sm text-left rounded hover:bg-[var(--ui-bg-elevated)]"
              :class="{ 'bg-[var(--ui-bg-elevated)]': !priorityFilter }"
              @click="selectPriority('')"
            >
              Tutte
            </button>
            <button
              v-for="p in priorities"
              :key="p"
              class="w-full flex items-center gap-2 px-3 py-2 text-sm text-left rounded hover:bg-[var(--ui-bg-elevated)]"
              :class="{ 'bg-[var(--ui-bg-elevated)]': priorityFilter === p }"
              @click="selectPriority(p)"
            >
              <UIcon
                :name="getPriorityIcon(p)"
                class="w-4 h-4"
              />
              {{ p }}
            </button>
          </div>
        </template>
      </UPopover>

      <!-- Issue Type Filter -->
      <UPopover
        v-if="issueTypes.length"
        v-model:open="typeOpen"
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
        <template #content>
          <div class="p-1 min-w-[140px]">
            <button
              class="w-full flex items-center gap-2 px-3 py-2 text-sm text-left rounded hover:bg-[var(--ui-bg-elevated)]"
              :class="{ 'bg-[var(--ui-bg-elevated)]': !issueTypeFilter }"
              @click="selectType('')"
            >
              Tutti
            </button>
            <button
              v-for="t in issueTypes"
              :key="t"
              class="w-full flex items-center gap-2 px-3 py-2 text-sm text-left rounded hover:bg-[var(--ui-bg-elevated)]"
              :class="{ 'bg-[var(--ui-bg-elevated)]': issueTypeFilter === t }"
              @click="selectType(t)"
            >
              {{ t }}
            </button>
          </div>
        </template>
      </UPopover>

      <!-- Assignee Filter (Multi-select) -->
      <UPopover v-model:open="assigneeOpen">
        <UButton
          color="neutral"
          variant="ghost"
          size="sm"
          trailing-icon="i-lucide-chevron-down"
          :class="{ 'bg-[var(--ui-bg-elevated)] ring-1 ring-[var(--ui-border-accented)]': assigneeFilter.length > 0 }"
        >
          <template v-if="assigneeFilter.length === 0">
            Assegnatario
          </template>
          <template v-else-if="assigneeFilter.length === 1">
            {{ assigneeFilter[0] === '__unassigned__' ? 'Non assegnato' : assigneeFilter[0] }}
          </template>
          <template v-else>
            {{ assigneeFilter.length }} assegnatari
          </template>
        </UButton>
        <template #content>
          <div class="min-w-[200px]">
            <div class="p-2 border-b border-[var(--ui-border)] flex items-center justify-between">
              <span class="text-xs font-medium text-[var(--ui-text-muted)]">Assegnatari</span>
              <button
                v-if="assigneeFilter.length > 0"
                class="text-xs text-primary-500 hover:underline"
                @click="clearAssignees"
              >
                Rimuovi tutti
              </button>
            </div>
            <div class="p-1 max-h-[300px] overflow-y-auto">
              <!-- Non assegnato option -->
              <label class="flex items-center gap-2 px-3 py-2 text-sm rounded hover:bg-[var(--ui-bg-elevated)] cursor-pointer">
                <UCheckbox
                  :model-value="assigneeFilter.includes('__unassigned__')"
                  @update:model-value="toggleAssignee('__unassigned__')"
                />
                <UIcon
                  name="i-lucide-user-x"
                  class="w-4 h-4 text-[var(--ui-text-muted)]"
                />
                <span class="italic text-[var(--ui-text-muted)]">Non assegnato</span>
              </label>
              <div
                v-if="assignees.length"
                class="border-t border-[var(--ui-border)] my-1"
              />
              <label
                v-for="a in assignees"
                :key="a"
                class="flex items-center gap-2 px-3 py-2 text-sm rounded hover:bg-[var(--ui-bg-elevated)] cursor-pointer"
              >
                <UCheckbox
                  :model-value="assigneeFilter.includes(a)"
                  @update:model-value="toggleAssignee(a)"
                />
                {{ a }}
              </label>
            </div>
          </div>
        </template>
      </UPopover>

      <!-- Label Filter (Multi-select) -->
      <UPopover
        v-if="labels.length"
        v-model:open="labelOpen"
      >
        <UButton
          color="neutral"
          variant="ghost"
          size="sm"
          trailing-icon="i-lucide-chevron-down"
          :class="{ 'bg-[var(--ui-bg-elevated)] ring-1 ring-[var(--ui-border-accented)]': labelFilter.length > 0 }"
        >
          <UIcon
            v-if="labelFilter.length > 0"
            name="i-lucide-tag"
            class="w-3.5 h-3.5"
          />
          <template v-if="labelFilter.length === 0">
            Label
          </template>
          <template v-else-if="labelFilter.length === 1">
            {{ labelFilter[0] }}
          </template>
          <template v-else>
            {{ labelFilter.length }} label
          </template>
        </UButton>
        <template #content>
          <div class="min-w-[200px]">
            <div class="p-2 border-b border-[var(--ui-border)] flex items-center justify-between">
              <span class="text-xs font-medium text-[var(--ui-text-muted)]">Labels</span>
              <button
                v-if="labelFilter.length > 0"
                class="text-xs text-primary-500 hover:underline"
                @click="clearLabels"
              >
                Rimuovi tutte
              </button>
            </div>
            <div class="p-1 max-h-[300px] overflow-y-auto">
              <label
                v-for="l in labels"
                :key="l"
                class="flex items-center gap-2 px-3 py-2 text-sm rounded hover:bg-[var(--ui-bg-elevated)] cursor-pointer"
              >
                <UCheckbox
                  :model-value="labelFilter.includes(l)"
                  @update:model-value="toggleLabel(l)"
                />
                <UIcon
                  name="i-lucide-tag"
                  class="w-3.5 h-3.5 text-[var(--ui-text-muted)]"
                />
                {{ l }}
              </label>
            </div>
          </div>
        </template>
      </UPopover>

      <!-- Divider -->
      <div class="h-5 w-px bg-[var(--ui-border)]" />

      <!-- Sort -->
      <UPopover v-model:open="sortOpen">
        <UButton
          color="neutral"
          variant="ghost"
          size="sm"
          trailing-icon="i-lucide-chevron-down"
        >
          {{ getSortLabel(sortBy) }}
        </UButton>
        <template #content>
          <div class="p-1 min-w-[160px]">
            <button
              v-for="o in sortOptions"
              :key="o.value"
              class="w-full flex items-center gap-2 px-3 py-2 text-sm text-left rounded hover:bg-[var(--ui-bg-elevated)]"
              :class="{ 'bg-[var(--ui-bg-elevated)]': sortBy === o.value }"
              @click="selectSort(o.value)"
            >
              {{ o.label }}
            </button>
          </div>
        </template>
      </UPopover>

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
        v-for="s in statusFilter"
        :key="`status-${s}`"
        color="primary"
        variant="subtle"
        size="sm"
        class="gap-1 pr-1"
      >
        {{ getStatusLabel(s) }}
        <UButton
          color="primary"
          variant="ghost"
          size="xs"
          icon="i-lucide-x"
          class="-mr-1"
          aria-label="Rimuovi filtro stato"
          @click="toggleStatus(s)"
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
        v-for="a in assigneeFilter"
        :key="`assignee-${a}`"
        color="primary"
        variant="subtle"
        size="sm"
        class="gap-1 pr-1"
      >
        <UIcon
          :name="a === '__unassigned__' ? 'i-lucide-user-x' : 'i-lucide-user'"
          class="w-3 h-3"
        />
        {{ a === '__unassigned__' ? 'Non assegnato' : a }}
        <UButton
          color="primary"
          variant="ghost"
          size="xs"
          icon="i-lucide-x"
          class="-mr-1"
          aria-label="Rimuovi filtro assegnatario"
          @click="toggleAssignee(a)"
        />
      </UBadge>

      <UBadge
        v-for="l in labelFilter"
        :key="`label-${l}`"
        color="primary"
        variant="subtle"
        size="sm"
        class="gap-1 pr-1"
      >
        <UIcon
          name="i-lucide-tag"
          class="w-3 h-3"
        />
        {{ l }}
        <UButton
          color="primary"
          variant="ghost"
          size="xs"
          icon="i-lucide-x"
          class="-mr-1"
          aria-label="Rimuovi filtro label"
          @click="toggleLabel(l)"
        />
      </UBadge>
    </div>
  </div>
</template>
