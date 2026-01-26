<script setup lang="ts">
import { refDebounced } from '@vueuse/core'

interface JiraIssue {
  key: string
  url: string
  summary: string
  description?: string
  status: string
  priority?: string
  assignee?: string | { displayName: string; name?: string; accountId?: string }
  assigneeId?: string
  reporter?: string | { displayName: string }
  labels: string[]
  updated: string
  created: string
  issueType?: string
}

interface JiraIssuesResponse {
  total: number
  issues: JiraIssue[]
}

// State
const selectedIssueKey = ref<string | null>(null)
const searchQuery = ref('')
const searchQueryDebounced = refDebounced(searchQuery, 300)
const statusFilter = ref<string>('all')
const labelFilter = ref<string>('')
const assigneeFilter = ref<string>('')
const isEditing = ref(false)
const isSaving = ref(false)
const saveError = ref<string | null>(null)

// Edit form state
const editForm = ref({
  summary: '',
  description: '',
  priority: '',
  labels: [] as string[]
})

// Fetch issues list
const { data: issuesData, pending: loadingIssues, error: issuesError, refresh: refreshIssues } = await useFetch<JiraIssuesResponse>(
  () => {
    const params = new URLSearchParams()
    if (statusFilter.value !== 'all') {
      params.set('status', statusFilter.value)
    }
    if (searchQueryDebounced.value) {
      params.set('search', searchQueryDebounced.value)
    }
    const queryString = params.toString()
    return `/api/jira/issues${queryString ? `?${queryString}` : ''}`
  },
  { watch: [searchQueryDebounced, statusFilter] }
)

// Computed: filtered issues (client-side filtering for label and assignee)
const filteredIssues = computed(() => {
  if (!issuesData.value?.issues) return []

  return issuesData.value.issues.filter(issue => {
    // Filter by label
    if (labelFilter.value && !issue.labels.includes(labelFilter.value)) {
      return false
    }
    // Filter by assignee
    if (assigneeFilter.value) {
      const assigneeName = getAssigneeName(issue.assignee)
      if (!assigneeName || !assigneeName.toLowerCase().includes(assigneeFilter.value.toLowerCase())) {
        return false
      }
    }
    return true
  })
})

// Computed: unique labels from all issues
const availableLabels = computed(() => {
  if (!issuesData.value?.issues) return []
  const labels = new Set<string>()
  issuesData.value.issues.forEach(issue => {
    issue.labels?.forEach(label => labels.add(label))
  })
  return Array.from(labels).sort()
})

// Computed: unique assignees from all issues
const availableAssignees = computed(() => {
  if (!issuesData.value?.issues) return []
  const assignees = new Set<string>()
  issuesData.value.issues.forEach(issue => {
    const name = getAssigneeName(issue.assignee)
    if (name) assignees.add(name)
  })
  return Array.from(assignees).sort()
})

// Helper to get assignee name from string or object
const getAssigneeName = (assignee: string | { displayName: string } | undefined | null): string | null => {
  if (!assignee) return null
  if (typeof assignee === 'string') return assignee
  return assignee.displayName || null
}

// Helper to get reporter name from string or object
const getReporterName = (reporter: string | { displayName: string } | undefined | null): string | null => {
  if (!reporter) return null
  if (typeof reporter === 'string') return reporter
  return reporter.displayName || null
}

// Fetch selected issue detail
const { data: selectedIssue, pending: loadingDetail, refresh: refreshDetail } = await useFetch<JiraIssue>(
  () => selectedIssueKey.value ? `/api/jira/issue/${selectedIssueKey.value}` : null,
  {
    watch: [selectedIssueKey],
    immediate: false
  }
)

// Watch for issue selection to load details
watch(selectedIssueKey, async (key) => {
  if (key) {
    isEditing.value = false
    saveError.value = null
    await refreshDetail()
  }
})

// Populate edit form when issue loads
watch(selectedIssue, (issue) => {
  if (issue) {
    editForm.value = {
      summary: issue.summary,
      description: issue.description || '',
      priority: issue.priority || '',
      labels: [...(issue.labels || [])]
    }
  }
})

// Status filter tabs
const statusTabs = [
  { id: 'all', label: 'Tutte' },
  { id: 'open', label: 'Aperte' },
  { id: 'in_progress', label: 'In Corso' },
  { id: 'done', label: 'Chiuse' }
]

// Select first issue on load
watch(filteredIssues, (issues) => {
  if (issues.length && !selectedIssueKey.value) {
    selectedIssueKey.value = issues[0].key
  }
}, { immediate: true })

const selectIssue = (key: string) => {
  selectedIssueKey.value = key
}

const startEditing = () => {
  isEditing.value = true
  saveError.value = null
}

const cancelEditing = () => {
  isEditing.value = false
  saveError.value = null
  if (selectedIssue.value) {
    editForm.value = {
      summary: selectedIssue.value.summary,
      description: selectedIssue.value.description || '',
      priority: selectedIssue.value.priority || '',
      labels: [...(selectedIssue.value.labels || [])]
    }
  }
}

const saveChanges = async () => {
  if (!selectedIssueKey.value) return

  isSaving.value = true
  saveError.value = null

  try {
    await $fetch(`/api/jira/issue/${selectedIssueKey.value}`, {
      method: 'PATCH',
      body: {
        summary: editForm.value.summary,
        description: editForm.value.description,
        priority: editForm.value.priority || undefined,
        labels: editForm.value.labels
      }
    })

    isEditing.value = false
    await refreshDetail()
    await refreshIssues()
  } catch (e: any) {
    saveError.value = e.message || 'Errore durante il salvataggio'
  } finally {
    isSaving.value = false
  }
}

const clearFilters = () => {
  labelFilter.value = ''
  assigneeFilter.value = ''
}

const getStatusColor = (status: string): string => {
  const s = status.toLowerCase()
  if (['done', 'closed', 'resolved', 'fatto', 'chiuso', 'risolto'].includes(s)) return 'success'
  if (['in progress', 'in development', 'in review', 'in corso'].includes(s)) return 'info'
  if (['open', 'to do', 'backlog', 'new', 'aperto', 'da fare'].includes(s)) return 'warning'
  return 'neutral'
}

const getPriorityIcon = (priority?: string): string => {
  if (!priority) return 'i-lucide-minus'
  const p = priority.toLowerCase()
  if (p === 'highest' || p === 'critico') return 'i-lucide-chevrons-up'
  if (p === 'high' || p === 'alta') return 'i-lucide-chevron-up'
  if (p === 'low' || p === 'bassa') return 'i-lucide-chevron-down'
  if (p === 'lowest' || p === 'minima') return 'i-lucide-chevrons-down'
  return 'i-lucide-minus'
}

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const priorityOptions = [
  { label: 'Highest', value: 'Highest' },
  { label: 'High', value: 'High' },
  { label: 'Medium', value: 'Medium' },
  { label: 'Low', value: 'Low' },
  { label: 'Lowest', value: 'Lowest' }
]

const hasActiveFilters = computed(() => labelFilter.value || assigneeFilter.value)
</script>

<template>
  <div class="animate-fade-in">
    <!-- Header -->
    <header class="mb-6">
      <div class="flex items-center gap-4">
        <div class="w-14 h-14 bg-blue-500/10 flex items-center justify-center">
          <UIcon
            name="i-simple-icons-jira"
            class="w-7 h-7 text-blue-500"
          />
        </div>
        <div>
          <h1 class="text-4xl font-display tracking-tight">
            Jira Issues
          </h1>
          <p class="text-sm text-[var(--ui-text-muted)] mt-1">
            {{ filteredIssues.length }} di {{ issuesData?.total || 0 }} issue
          </p>
        </div>
      </div>
    </header>

    <!-- Main Layout -->
    <div class="grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-6 h-[calc(100vh-220px)]">
      <!-- Sidebar: Issues List -->
      <aside class="bento-item flex flex-col h-full overflow-hidden">
        <!-- Search -->
        <div class="p-4 border-b border-[var(--ui-border)]">
          <UInput
            v-model="searchQuery"
            placeholder="Cerca issue..."
            icon="i-lucide-search"
            size="lg"
            :ui="{ base: 'w-full' }"
          />
        </div>

        <!-- Status Filter Tabs -->
        <div class="px-4 py-3 border-b border-[var(--ui-border)] flex gap-1 overflow-x-auto">
          <button
            v-for="tab in statusTabs"
            :key="tab.id"
            type="button"
            class="px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-all"
            :class="statusFilter === tab.id
              ? 'bg-[var(--ui-primary)] text-white'
              : 'bg-[var(--ui-bg-muted)] text-[var(--ui-text-muted)] hover:bg-[var(--ui-bg-accent)]'"
            @click="statusFilter = tab.id"
          >
            {{ tab.label }}
          </button>
        </div>

        <!-- Additional Filters -->
        <div class="px-4 py-3 border-b border-[var(--ui-border)] space-y-2">
          <div class="flex gap-2">
            <USelectMenu
              v-model="labelFilter"
              :items="availableLabels"
              placeholder="Label..."
              size="sm"
              class="flex-1"
              :ui="{ base: 'w-full' }"
            />
            <USelectMenu
              v-model="assigneeFilter"
              :items="availableAssignees"
              placeholder="Assegnatario..."
              size="sm"
              class="flex-1"
              :ui="{ base: 'w-full' }"
            />
          </div>
          <button
            v-if="hasActiveFilters"
            type="button"
            class="text-xs text-[var(--ui-text-muted)] hover:text-[var(--ui-text)] flex items-center gap-1"
            @click="clearFilters"
          >
            <UIcon
              name="i-lucide-x"
              class="w-3 h-3"
            />
            Rimuovi filtri
          </button>
        </div>

        <!-- Issues List -->
        <div class="flex-1 min-h-0 overflow-y-auto">
            <!-- Loading -->
            <div
              v-if="loadingIssues && !issuesData"
              class="p-4 space-y-3"
            >
              <div
                v-for="i in 5"
                :key="i"
                class="animate-pulse"
              >
                <div class="h-4 bg-[var(--ui-bg-muted)] w-24 mb-2" />
                <div class="h-3 bg-[var(--ui-bg-muted)] w-full" />
              </div>
            </div>

            <!-- Error -->
            <div
              v-else-if="issuesError"
              class="p-4"
            >
              <UAlert
                color="error"
                variant="soft"
                icon="i-lucide-alert-triangle"
                title="Errore"
                :description="issuesError.message"
              />
            </div>

            <!-- Empty -->
            <div
              v-else-if="!filteredIssues.length"
              class="p-8 text-center"
            >
              <UIcon
                name="i-lucide-inbox"
                class="w-12 h-12 text-[var(--ui-text-dimmed)] mx-auto mb-3"
              />
              <p class="text-[var(--ui-text-muted)]">
                Nessuna issue trovata
              </p>
              <button
                v-if="hasActiveFilters"
                type="button"
                class="mt-2 text-sm text-[var(--ui-primary)] hover:underline"
                @click="clearFilters"
              >
                Rimuovi filtri
              </button>
            </div>

            <!-- List -->
            <div v-else>
              <button
                v-for="issue in filteredIssues"
                :key="issue.key"
                type="button"
                class="w-full text-left px-4 py-3 border-b border-[var(--ui-border)] hover:bg-[var(--ui-bg-muted)] transition-colors"
                :class="selectedIssueKey === issue.key ? 'bg-[var(--ui-bg-muted)] border-l-2 border-l-[var(--ui-primary)]' : ''"
                @click="selectIssue(issue.key)"
              >
                <div class="flex items-start gap-3">
                  <div class="pt-0.5">
                    <UBadge
                      :color="getStatusColor(issue.status)"
                      variant="soft"
                      size="xs"
                      class="font-mono"
                    >
                      {{ issue.key }}
                    </UBadge>
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium truncate">
                      {{ issue.summary }}
                    </p>
                    <div class="flex items-center gap-2 mt-1 text-xs text-[var(--ui-text-muted)]">
                      <span>{{ issue.status }}</span>
                      <span v-if="getAssigneeName(issue.assignee)">
                        · {{ getAssigneeName(issue.assignee) }}
                      </span>
                    </div>
                    <div
                      v-if="issue.labels?.length"
                      class="flex flex-wrap gap-1 mt-2"
                    >
                      <span
                        v-for="label in issue.labels.slice(0, 3)"
                        :key="label"
                        class="px-1.5 py-0.5 text-[10px] bg-[var(--ui-bg-elevated)] text-[var(--ui-text-muted)] rounded"
                      >
                        {{ label }}
                      </span>
                      <span
                        v-if="issue.labels.length > 3"
                        class="text-[10px] text-[var(--ui-text-dimmed)]"
                      >
                        +{{ issue.labels.length - 3 }}
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            </div>
        </div>
      </aside>

      <!-- Main: Issue Detail -->
      <main class="bento-item flex flex-col h-full overflow-hidden">
        <!-- Loading Detail -->
        <div
          v-if="loadingDetail && selectedIssueKey"
          class="flex-1 flex items-center justify-center"
        >
          <UIcon
            name="i-lucide-loader-2"
            class="w-8 h-8 animate-spin text-[var(--ui-text-muted)]"
          />
        </div>

        <!-- No Selection -->
        <div
          v-else-if="!selectedIssue"
          class="flex-1 flex flex-col items-center justify-center text-center p-8"
        >
          <UIcon
            name="i-lucide-mouse-pointer-click"
            class="w-16 h-16 text-[var(--ui-text-dimmed)] mb-4"
          />
          <p class="text-lg text-[var(--ui-text-muted)]">
            Seleziona una issue dalla lista
          </p>
        </div>

        <!-- Issue Detail -->
        <template v-else>
          <!-- Header -->
          <div class="p-6 border-b border-[var(--ui-border)]">
            <div class="flex items-start justify-between gap-4">
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-3 mb-2">
                  <UBadge
                    :color="getStatusColor(selectedIssue.status)"
                    variant="soft"
                    size="sm"
                  >
                    {{ selectedIssue.status }}
                  </UBadge>
                  <span class="text-sm font-mono text-[var(--ui-text-muted)]">
                    {{ selectedIssue.key }}
                  </span>
                  <span
                    v-if="selectedIssue.issueType"
                    class="text-xs text-[var(--ui-text-dimmed)]"
                  >
                    {{ selectedIssue.issueType }}
                  </span>
                </div>

                <!-- Title (editable) -->
                <template v-if="isEditing">
                  <UInput
                    v-model="editForm.summary"
                    size="xl"
                    class="font-semibold"
                  />
                </template>
                <template v-else>
                  <h2 class="text-2xl font-semibold">
                    {{ selectedIssue.summary }}
                  </h2>
                </template>
              </div>

              <!-- Actions -->
              <div class="flex items-center gap-2 shrink-0">
                <template v-if="isEditing">
                  <UButton
                    color="neutral"
                    variant="ghost"
                    @click="cancelEditing"
                  >
                    Annulla
                  </UButton>
                  <UButton
                    color="primary"
                    :loading="isSaving"
                    @click="saveChanges"
                  >
                    Salva
                  </UButton>
                </template>
                <template v-else>
                  <UButton
                    color="neutral"
                    variant="soft"
                    icon="i-lucide-pencil"
                    @click="startEditing"
                  >
                    Modifica
                  </UButton>
                  <UButton
                    :to="selectedIssue.url"
                    target="_blank"
                    color="neutral"
                    variant="ghost"
                    icon="i-lucide-external-link"
                  >
                    Apri in Jira
                  </UButton>
                </template>
              </div>
            </div>

            <!-- Save Error -->
            <UAlert
              v-if="saveError"
              color="error"
              variant="soft"
              icon="i-lucide-alert-triangle"
              :title="saveError"
              class="mt-4"
              :close-button="{ icon: 'i-lucide-x' }"
              @close="saveError = null"
            />
          </div>

          <!-- Content -->
          <div class="flex-1 min-h-0 overflow-y-auto">
              <div class="p-6">
              <!-- Metadata Grid -->
              <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <!-- Priority -->
                <div class="p-4 bg-[var(--ui-bg-muted)] border border-[var(--ui-border)]">
                  <p class="text-xs text-[var(--ui-text-muted)] mb-1">
                    Priorità
                  </p>
                  <template v-if="isEditing">
                    <USelect
                      v-model="editForm.priority"
                      :items="priorityOptions"
                      placeholder="Seleziona..."
                      size="sm"
                    />
                  </template>
                  <template v-else>
                    <div class="flex items-center gap-2">
                      <UIcon
                        :name="getPriorityIcon(selectedIssue.priority)"
                        class="w-4 h-4"
                      />
                      <span class="font-medium">{{ selectedIssue.priority || '-' }}</span>
                    </div>
                  </template>
                </div>

                <!-- Assignee -->
                <div class="p-4 bg-[var(--ui-bg-muted)] border border-[var(--ui-border)]">
                  <p class="text-xs text-[var(--ui-text-muted)] mb-1">
                    Assegnatario
                  </p>
                  <span class="font-medium">{{ getAssigneeName(selectedIssue.assignee) || 'Non assegnato' }}</span>
                </div>

                <!-- Reporter -->
                <div class="p-4 bg-[var(--ui-bg-muted)] border border-[var(--ui-border)]">
                  <p class="text-xs text-[var(--ui-text-muted)] mb-1">
                    Reporter
                  </p>
                  <span class="font-medium">{{ getReporterName(selectedIssue.reporter) || '-' }}</span>
                </div>

                <!-- Updated -->
                <div class="p-4 bg-[var(--ui-bg-muted)] border border-[var(--ui-border)]">
                  <p class="text-xs text-[var(--ui-text-muted)] mb-1">
                    Aggiornato
                  </p>
                  <span class="font-medium text-sm">{{ formatDate(selectedIssue.updated) }}</span>
                </div>
              </div>

              <!-- Labels -->
              <div class="mb-6">
                <p class="text-xs text-[var(--ui-text-muted)] mb-2">
                  Labels
                </p>
                <template v-if="isEditing">
                  <UInputTags
                    v-model="editForm.labels"
                    placeholder="Aggiungi label..."
                  />
                </template>
                <template v-else>
                  <div class="flex flex-wrap gap-2">
                    <UBadge
                      v-for="label in selectedIssue.labels"
                      :key="label"
                      color="neutral"
                      variant="subtle"
                    >
                      {{ label }}
                    </UBadge>
                    <span
                      v-if="!selectedIssue.labels?.length"
                      class="text-[var(--ui-text-dimmed)]"
                    >
                      Nessuna label
                    </span>
                  </div>
                </template>
              </div>

              <!-- Description -->
              <div>
                <p class="text-xs text-[var(--ui-text-muted)] mb-2">
                  Descrizione
                </p>
                <template v-if="isEditing">
                  <UTextarea
                    v-model="editForm.description"
                    :rows="12"
                    placeholder="Descrizione della issue..."
                    class="font-mono text-sm"
                  />
                </template>
                <template v-else>
                  <div
                    v-if="selectedIssue.description"
                    class="p-4 bg-[var(--ui-bg-muted)] border border-[var(--ui-border)] whitespace-pre-wrap text-sm"
                  >
                    {{ selectedIssue.description }}
                  </div>
                  <p
                    v-else
                    class="text-[var(--ui-text-dimmed)]"
                  >
                    Nessuna descrizione
                  </p>
                </template>
              </div>

              <!-- Dates -->
              <div class="mt-6 pt-6 border-t border-[var(--ui-border)] text-xs text-[var(--ui-text-muted)]">
                <p>Creato: {{ formatDate(selectedIssue.created) }}</p>
              </div>
              </div>
          </div>
        </template>
      </main>
    </div>
  </div>
</template>
