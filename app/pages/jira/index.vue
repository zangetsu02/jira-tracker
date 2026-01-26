<script setup lang="ts">
import { refDebounced } from '@vueuse/core'

const route = useRoute()
const router = useRouter()

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

interface JiraComment {
  id: string
  body: string
  author: {
    displayName: string
    avatarUrl?: string
  }
  created: string
  updated: string
}

interface JiraCommentsResponse {
  total: number
  comments: JiraComment[]
}

// State - initialize from query params
const selectedIssueKey = ref<string | null>((route.query.issue as string) || null)
const searchQuery = ref((route.query.search as string) || '')
const searchQueryDebounced = refDebounced(searchQuery, 300)
const statusFilter = ref<string>((route.query.status as string) || 'all')
const labelFilter = ref<string>((route.query.label as string) || '')
const assigneeFilter = ref<string>((route.query.assignee as string) || '')
const isEditing = ref(false)
const isSaving = ref(false)
const saveError = ref<string | null>(null)

// Comments state
const comments = ref<JiraComment[]>([])
const loadingComments = ref(false)
const newComment = ref('')
const addingComment = ref(false)

// Sync state to query params
const updateQueryParams = () => {
  const query: Record<string, string> = {}
  
  if (selectedIssueKey.value) query.issue = selectedIssueKey.value
  if (searchQuery.value) query.search = searchQuery.value
  if (statusFilter.value && statusFilter.value !== 'all') query.status = statusFilter.value
  if (labelFilter.value) query.label = labelFilter.value
  if (assigneeFilter.value) query.assignee = assigneeFilter.value
  
  router.replace({ query })
}

// Watch all filter changes and sync to URL
watch([selectedIssueKey, searchQueryDebounced, statusFilter, labelFilter, assigneeFilter], () => {
  updateQueryParams()
}, { deep: true })

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
    if (labelFilter.value && !issue.labels.includes(labelFilter.value)) {
      return false
    }
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
const selectedIssue = ref<JiraIssue | null>(null)
const loadingDetail = ref(false)

const refreshDetail = async () => {
  if (!selectedIssueKey.value) {
    selectedIssue.value = null
    comments.value = []
    return
  }
  
  loadingDetail.value = true
  try {
    selectedIssue.value = await $fetch<JiraIssue>(`/api/jira/issue/${selectedIssueKey.value}`)
    // Load comments in parallel
    await refreshComments()
  } catch (e) {
    console.error('Error fetching issue detail:', e)
    selectedIssue.value = null
  } finally {
    loadingDetail.value = false
  }
}

const refreshComments = async () => {
  if (!selectedIssueKey.value) {
    comments.value = []
    return
  }
  
  loadingComments.value = true
  try {
    const result = await $fetch<JiraCommentsResponse>(`/api/jira/issue/${selectedIssueKey.value}/comments`)
    comments.value = result.comments
  } catch (e) {
    console.error('Error fetching comments:', e)
    comments.value = []
  } finally {
    loadingComments.value = false
  }
}

const addComment = async () => {
  if (!selectedIssueKey.value || !newComment.value.trim()) return
  
  addingComment.value = true
  try {
    const comment = await $fetch<JiraComment>(`/api/jira/issue/${selectedIssueKey.value}/comments`, {
      method: 'POST',
      body: { body: newComment.value.trim() }
    })
    comments.value.unshift(comment)
    newComment.value = ''
  } catch (e) {
    console.error('Error adding comment:', e)
  } finally {
    addingComment.value = false
  }
}

// Watch for issue selection to load details
watch(selectedIssueKey, async (key) => {
  if (key) {
    isEditing.value = false
    saveError.value = null
    await refreshDetail()
  }
}, { immediate: true })

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
}, { deep: true })

// Status filter tabs
const statusTabs = [
  { value: 'all', label: 'Tutte' },
  { value: 'open', label: 'Aperte' },
  { value: 'in_progress', label: 'In Corso' },
  { value: 'done', label: 'Chiuse' }
]

// Select first issue on load (only if no issue selected from URL)
watch(filteredIssues, (issues) => {
  if (issues.length && !selectedIssueKey.value) {
    selectedIssueKey.value = issues[0].key
  }
  // If selected issue is not in filtered list, clear selection
  if (selectedIssueKey.value && issues.length && !issues.find(i => i.key === selectedIssueKey.value)) {
    // Keep selection but don't auto-change - user might have deep-linked
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

const getStatusColor = (status: string): 'success' | 'info' | 'warning' | 'neutral' => {
  const s = status.toLowerCase()
  if (['done', 'closed', 'resolved', 'fatto', 'chiuso', 'risolto'].includes(s)) return 'success'
  if (['in progress', 'in development', 'in review', 'in corso'].includes(s)) return 'info'
  if (['open', 'to do', 'backlog', 'new', 'aperto', 'da fare'].includes(s)) return 'warning'
  return 'neutral'
}

const getStatusDotClass = (status: string): string => {
  const color = getStatusColor(status)
  const classes: Record<string, string> = {
    success: 'bg-green-500 dark:bg-green-400',
    info: 'bg-blue-500 dark:bg-blue-400',
    warning: 'bg-amber-500 dark:bg-amber-400',
    neutral: 'bg-gray-400 dark:bg-gray-500'
  }
  return classes[color] || classes.neutral
}

const getPriorityColor = (priority?: string): 'error' | 'warning' | 'info' | 'success' | 'neutral' => {
  if (!priority) return 'neutral'
  const p = priority.toLowerCase()
  if (p === 'highest' || p === 'critico') return 'error'
  if (p === 'high' || p === 'alta') return 'warning'
  if (p === 'medium' || p === 'media') return 'info'
  if (p === 'low' || p === 'bassa') return 'success'
  if (p === 'lowest' || p === 'minima') return 'neutral'
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

const formatRelativeDate = (dateString: string) => {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 60) return `${diffMins}m fa`
  if (diffHours < 24) return `${diffHours}h fa`
  if (diffDays < 7) return `${diffDays}g fa`
  return formatDate(dateString)
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
  <div class="h-full flex flex-col">
    <!-- Header -->
    <header class="shrink-0 mb-6">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-4">
          <div class="w-12 h-12 rounded-xl bg-blue-500 dark:bg-blue-600 flex items-center justify-center">
            <UIcon name="i-simple-icons-jira" class="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 class="text-2xl font-semibold">Jira Issues</h1>
            <p class="text-sm text-neutral-500 dark:text-neutral-400">
              <span class="font-medium text-neutral-900 dark:text-neutral-100">{{ filteredIssues.length }}</span>
              di {{ issuesData?.total || 0 }} issue
            </p>
          </div>
        </div>
        <UButton
          icon="i-lucide-refresh-cw"
          color="neutral"
          variant="ghost"
          :loading="loadingIssues"
          @click="refreshIssues()"
        >
          Aggiorna
        </UButton>
      </div>
    </header>

    <!-- Main Layout -->
    <div class="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-6">
      <!-- Sidebar -->
      <UCard class="flex flex-col overflow-hidden" :ui="{ body: 'p-0 flex-1 flex flex-col overflow-hidden' }">
        <!-- Search & Filters -->
        <div class="shrink-0 p-4 space-y-4 border-b border-neutral-200 dark:border-neutral-800">
          <UInput
            v-model="searchQuery"
            placeholder="Cerca per chiave, titolo..."
            icon="i-lucide-search"
            size="lg"
            :loading="loadingIssues"
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
              :items="availableLabels"
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
              :items="availableAssignees"
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
              @click="clearFilters"
            >
              Rimuovi
            </UButton>
          </div>
        </div>

        <!-- Issues List -->
        <div class="flex-1 min-h-0 overflow-y-auto">
          <!-- Loading Skeleton -->
          <div v-if="loadingIssues && !issuesData" class="p-4 space-y-3">
            <USkeleton v-for="i in 6" :key="i" class="h-20 w-full" />
          </div>

          <!-- Error -->
          <div v-else-if="issuesError" class="p-4">
            <UAlert
              color="error"
              variant="subtle"
              icon="i-lucide-alert-circle"
              title="Errore nel caricamento"
              :description="issuesError.message"
            />
          </div>

          <!-- Empty State -->
          <div v-else-if="!filteredIssues.length" class="flex flex-col items-center justify-center h-full p-8 text-center">
            <div class="w-16 h-16 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mb-4">
              <UIcon name="i-lucide-inbox" class="w-8 h-8 text-neutral-400 dark:text-neutral-500" />
            </div>
            <p class="text-neutral-600 dark:text-neutral-400 font-medium">Nessuna issue trovata</p>
            <p class="text-sm text-neutral-500 dark:text-neutral-500 mt-1">
              {{ hasActiveFilters ? 'Prova a modificare i filtri' : 'Non ci sono issue da mostrare' }}
            </p>
            <UButton
              v-if="hasActiveFilters"
              size="sm"
              color="neutral"
              variant="soft"
              class="mt-4"
              @click="clearFilters"
            >
              Rimuovi filtri
            </UButton>
          </div>

          <!-- Issues List -->
          <div v-else class="divide-y divide-neutral-200 dark:divide-neutral-800">
            <button
              v-for="issue in filteredIssues"
              :key="issue.key"
              type="button"
              class="w-full text-left p-4 transition-all hover:bg-neutral-50 dark:hover:bg-neutral-800/50 focus:outline-none focus:bg-neutral-50 dark:focus:bg-neutral-800/50"
              :class="[
                selectedIssueKey === issue.key
                  ? 'bg-neutral-100 dark:bg-neutral-800 ring-2 ring-inset ring-blue-500'
                  : ''
              ]"
              @click="selectIssue(issue.key)"
            >
              <div class="flex items-start gap-3">
                <!-- Status Indicator -->
                <div class="shrink-0 mt-1">
                  <UTooltip :text="issue.status">
                    <span
                      class="block w-2.5 h-2.5 rounded-full"
                      :class="getStatusDotClass(issue.status)"
                    />
                  </UTooltip>
                </div>

                <!-- Content -->
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 mb-1">
                    <span class="text-xs font-mono font-medium text-blue-600 dark:text-blue-400">
                      {{ issue.key }}
                    </span>
                    <UBadge
                      v-if="issue.priority"
                      :color="getPriorityColor(issue.priority)"
                      variant="subtle"
                      size="xs"
                    >
                      <UIcon :name="getPriorityIcon(issue.priority)" class="w-3 h-3" />
                    </UBadge>
                  </div>

                  <p class="text-sm font-medium line-clamp-2 mb-2">
                    {{ issue.summary }}
                  </p>

                  <div class="flex items-center gap-3 text-xs text-neutral-500 dark:text-neutral-400">
                    <span v-if="getAssigneeName(issue.assignee)" class="flex items-center gap-1">
                      <UIcon name="i-lucide-user" class="w-3 h-3" />
                      {{ getAssigneeName(issue.assignee) }}
                    </span>
                    <span class="flex items-center gap-1">
                      <UIcon name="i-lucide-clock" class="w-3 h-3" />
                      {{ formatRelativeDate(issue.updated) }}
                    </span>
                  </div>

                  <!-- Labels -->
                  <div v-if="issue.labels?.length" class="flex flex-wrap gap-1 mt-2">
                    <UBadge
                      v-for="label in issue.labels.slice(0, 2)"
                      :key="label"
                      color="neutral"
                      variant="subtle"
                      size="xs"
                    >
                      {{ label }}
                    </UBadge>
                    <UBadge
                      v-if="issue.labels.length > 2"
                      color="neutral"
                      variant="subtle"
                      size="xs"
                    >
                      +{{ issue.labels.length - 2 }}
                    </UBadge>
                  </div>
                </div>
              </div>
            </button>
          </div>
        </div>
      </UCard>

      <!-- Detail Panel -->
      <UCard class="flex flex-col overflow-hidden" :ui="{ body: 'p-0 flex-1 flex flex-col overflow-hidden' }">
        <!-- Loading -->
        <div v-if="loadingDetail && selectedIssueKey" class="flex-1 flex items-center justify-center">
          <div class="text-center">
            <UIcon name="i-lucide-loader-2" class="w-8 h-8 animate-spin text-blue-500 mb-2" />
            <p class="text-sm text-neutral-500 dark:text-neutral-400">Caricamento...</p>
          </div>
        </div>

        <!-- Empty State -->
        <div v-else-if="!selectedIssue" class="flex-1 flex flex-col items-center justify-center p-8">
          <div class="w-20 h-20 rounded-2xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mb-4">
            <UIcon name="i-lucide-file-text" class="w-10 h-10 text-neutral-400 dark:text-neutral-500" />
          </div>
          <p class="text-lg font-medium text-neutral-600 dark:text-neutral-400">Seleziona una issue</p>
          <p class="text-sm text-neutral-500 dark:text-neutral-500 mt-1">
            Clicca su una issue dalla lista per vedere i dettagli
          </p>
        </div>

        <!-- Issue Detail -->
        <template v-else>
          <!-- Header -->
          <div class="shrink-0 p-6 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50">
            <div class="flex items-start justify-between gap-4">
              <div class="flex-1 min-w-0">
                <!-- Meta Info -->
                <div class="flex items-center gap-2 mb-3">
                  <UBadge :color="getStatusColor(selectedIssue.status)" variant="solid" size="sm">
                    {{ selectedIssue.status }}
                  </UBadge>
                  <UTooltip text="Chiave issue">
                    <code class="px-2 py-0.5 text-xs font-mono bg-neutral-200 dark:bg-neutral-700 rounded">
                      {{ selectedIssue.key }}
                    </code>
                  </UTooltip>
                  <UBadge v-if="selectedIssue.issueType" color="neutral" variant="subtle" size="xs">
                    {{ selectedIssue.issueType }}
                  </UBadge>
                </div>

                <!-- Title -->
                <UInput
                  v-if="isEditing"
                  v-model="editForm.summary"
                  size="xl"
                  placeholder="Titolo issue"
                  :ui="{ base: 'font-semibold text-xl' }"
                />
                <h2 v-else class="text-xl font-semibold leading-tight">
                  {{ selectedIssue.summary }}
                </h2>
              </div>

              <!-- Actions -->
              <div class="flex items-center gap-2 shrink-0">
                <template v-if="isEditing">
                  <UButton color="neutral" variant="ghost" @click="cancelEditing">
                    Annulla
                  </UButton>
                  <UButton color="primary" :loading="isSaving" icon="i-lucide-save" @click="saveChanges">
                    Salva
                  </UButton>
                </template>
                <template v-else>
                  <UTooltip text="Modifica issue">
                    <UButton
                      color="neutral"
                      variant="soft"
                      icon="i-lucide-pencil"
                      @click="startEditing"
                    />
                  </UTooltip>
                  <UTooltip text="Apri in Jira">
                    <UButton
                      :to="selectedIssue.url"
                      target="_blank"
                      color="neutral"
                      variant="soft"
                      icon="i-lucide-external-link"
                    />
                  </UTooltip>
                </template>
              </div>
            </div>

            <!-- Save Error -->
            <UAlert
              v-if="saveError"
              color="error"
              variant="subtle"
              icon="i-lucide-alert-circle"
              class="mt-4"
              :close-button="{ icon: 'i-lucide-x', color: 'error', variant: 'ghost', size: 'xs' }"
              @close="saveError = null"
            >
              <template #title>Errore nel salvataggio</template>
              <template #description>{{ saveError }}</template>
            </UAlert>
          </div>

          <!-- Content -->
          <div class="flex-1 min-h-0 overflow-y-auto p-6 space-y-6">
            <!-- Metadata Cards -->
            <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <!-- Priority -->
              <div class="p-4 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
                <p class="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-2 flex items-center gap-1">
                  <UIcon name="i-lucide-signal" class="w-3 h-3" />
                  Priorità
                </p>
                <USelect
                  v-if="isEditing"
                  v-model="editForm.priority"
                  :items="priorityOptions"
                  placeholder="Seleziona..."
                  size="sm"
                />
                <div v-else class="flex items-center gap-2">
                  <UBadge :color="getPriorityColor(selectedIssue.priority)" variant="subtle" size="sm">
                    <UIcon :name="getPriorityIcon(selectedIssue.priority)" class="w-3.5 h-3.5 mr-1" />
                    {{ selectedIssue.priority || 'Nessuna' }}
                  </UBadge>
                </div>
              </div>

              <!-- Assignee -->
              <div class="p-4 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
                <p class="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-2 flex items-center gap-1">
                  <UIcon name="i-lucide-user-check" class="w-3 h-3" />
                  Assegnatario
                </p>
                <div class="flex items-center gap-2">
                  <UAvatar
                    :alt="getAssigneeName(selectedIssue.assignee) || 'N/A'"
                    size="xs"
                  />
                  <span class="text-sm font-medium truncate">
                    {{ getAssigneeName(selectedIssue.assignee) || 'Non assegnato' }}
                  </span>
                </div>
              </div>

              <!-- Reporter -->
              <div class="p-4 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
                <p class="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-2 flex items-center gap-1">
                  <UIcon name="i-lucide-user" class="w-3 h-3" />
                  Reporter
                </p>
                <div class="flex items-center gap-2">
                  <UAvatar
                    :alt="getReporterName(selectedIssue.reporter) || 'N/A'"
                    size="xs"
                  />
                  <span class="text-sm font-medium truncate">
                    {{ getReporterName(selectedIssue.reporter) || '-' }}
                  </span>
                </div>
              </div>

              <!-- Updated -->
              <div class="p-4 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
                <p class="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-2 flex items-center gap-1">
                  <UIcon name="i-lucide-clock" class="w-3 h-3" />
                  Aggiornato
                </p>
                <UTooltip :text="formatDate(selectedIssue.updated)">
                  <span class="text-sm font-medium">
                    {{ formatRelativeDate(selectedIssue.updated) }}
                  </span>
                </UTooltip>
              </div>
            </div>

            <!-- Labels Section -->
            <div>
              <p class="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-3 flex items-center gap-1">
                <UIcon name="i-lucide-tags" class="w-3 h-3" />
                Labels
              </p>
              <UInputTags
                v-if="isEditing"
                v-model="editForm.labels"
                placeholder="Aggiungi label e premi Invio..."
              />
              <div v-else class="flex flex-wrap gap-2">
                <UBadge
                  v-for="label in selectedIssue.labels"
                  :key="label"
                  color="info"
                  variant="subtle"
                  size="sm"
                >
                  <UIcon name="i-lucide-tag" class="w-3 h-3 mr-1" />
                  {{ label }}
                </UBadge>
                <span v-if="!selectedIssue.labels?.length" class="text-sm text-neutral-400 dark:text-neutral-500">
                  Nessuna label assegnata
                </span>
              </div>
            </div>

            <!-- Description Section -->
            <div>
              <p class="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-3 flex items-center gap-1">
                <UIcon name="i-lucide-align-left" class="w-3 h-3" />
                Descrizione
              </p>
              <UTextarea
                v-if="isEditing"
                v-model="editForm.description"
                :rows="10"
                placeholder="Descrizione della issue..."
                :ui="{ base: 'font-mono text-sm' }"
              />
              <UCard v-else-if="selectedIssue.description" :ui="{ body: 'p-4' }">
                <pre class="whitespace-pre-wrap text-sm font-sans leading-relaxed">{{ selectedIssue.description }}</pre>
              </UCard>
              <p v-else class="text-sm text-neutral-400 dark:text-neutral-500 italic">
                Nessuna descrizione disponibile
              </p>
            </div>

            <!-- Comments Section -->
            <div>
              <div class="flex items-center justify-between mb-3">
                <p class="text-xs font-medium text-neutral-500 dark:text-neutral-400 flex items-center gap-1">
                  <UIcon name="i-lucide-message-square" class="w-3 h-3" />
                  Commenti ({{ comments.length }})
                </p>
                <UButton
                  v-if="comments.length > 0"
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  icon="i-lucide-refresh-cw"
                  :loading="loadingComments"
                  @click="refreshComments"
                />
              </div>

              <!-- Add Comment -->
              <div class="mb-4">
                <div class="flex gap-2">
                  <UTextarea
                    v-model="newComment"
                    placeholder="Scrivi un commento..."
                    :rows="2"
                    class="flex-1"
                    :disabled="addingComment"
                  />
                  <UButton
                    color="primary"
                    icon="i-lucide-send"
                    :loading="addingComment"
                    :disabled="!newComment.trim()"
                    @click="addComment"
                  />
                </div>
              </div>

              <!-- Comments List -->
              <div v-if="loadingComments && comments.length === 0" class="space-y-3">
                <USkeleton v-for="i in 2" :key="i" class="h-20 w-full" />
              </div>

              <div v-else-if="comments.length === 0" class="text-center py-6">
                <UIcon name="i-lucide-message-square-dashed" class="w-8 h-8 text-neutral-300 dark:text-neutral-600 mx-auto mb-2" />
                <p class="text-sm text-neutral-400 dark:text-neutral-500">Nessun commento</p>
              </div>

              <div v-else class="space-y-3">
                <div
                  v-for="comment in comments"
                  :key="comment.id"
                  class="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700"
                >
                  <div class="flex items-start gap-3">
                    <UAvatar
                      :src="comment.author.avatarUrl"
                      :alt="comment.author.displayName"
                      size="sm"
                    />
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2 mb-1">
                        <span class="text-sm font-medium">{{ comment.author.displayName }}</span>
                        <span class="text-xs text-neutral-400 dark:text-neutral-500">
                          {{ formatRelativeDate(comment.created) }}
                        </span>
                      </div>
                      <p class="text-sm whitespace-pre-wrap">{{ comment.body }}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Footer Info -->
            <USeparator />
            <div class="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
              <div class="flex items-center gap-1">
                <UIcon name="i-lucide-calendar-plus" class="w-3 h-3" />
                Creato: {{ formatDate(selectedIssue.created) }}
              </div>
              <UButton
                :to="selectedIssue.url"
                target="_blank"
                size="xs"
                color="neutral"
                variant="link"
                trailing-icon="i-lucide-external-link"
              >
                Vedi su Jira
              </UButton>
            </div>
          </div>
        </template>
      </UCard>
    </div>
  </div>
</template>
