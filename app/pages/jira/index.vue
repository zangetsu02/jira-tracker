<script setup lang="ts">
import { refDebounced } from '@vueuse/core'
import type { JiraIssue, JiraIssuesResponse } from '~/composables/useJiraHelpers'

const route = useRoute()
const router = useRouter()
const { getAssigneeName } = useJiraHelpers()

// State - initialize from query params
const selectedIssueKey = ref<string | null>((route.query.issue as string) || null)
const searchQuery = ref((route.query.search as string) || '')
const searchQueryDebounced = refDebounced(searchQuery, 300)
const statusFilter = ref<string>((route.query.status as string) || 'all')
const labelFilter = ref<string>((route.query.label as string) || '')
const assigneeFilter = ref<string>((route.query.assignee as string) || '')
const priorityFilter = ref<string>((route.query.priority as string) || '')
const issueTypeFilter = ref<string>((route.query.type as string) || '')
const sortBy = ref<string>((route.query.sort as string) || 'updated')
const sortOrder = ref<string>((route.query.order as string) || 'desc')

// Sync state to query params
const updateQueryParams = () => {
  const query: Record<string, string> = {}

  if (selectedIssueKey.value) query.issue = selectedIssueKey.value
  if (searchQuery.value) query.search = searchQuery.value
  if (statusFilter.value && statusFilter.value !== 'all') query.status = statusFilter.value
  if (labelFilter.value) query.label = labelFilter.value
  if (assigneeFilter.value) query.assignee = assigneeFilter.value
  if (priorityFilter.value) query.priority = priorityFilter.value
  if (issueTypeFilter.value) query.type = issueTypeFilter.value
  if (sortBy.value && sortBy.value !== 'updated') query.sort = sortBy.value
  if (sortOrder.value && sortOrder.value !== 'desc') query.order = sortOrder.value

  router.replace({ query })
}

watch([
  selectedIssueKey,
  searchQueryDebounced,
  statusFilter,
  labelFilter,
  assigneeFilter,
  priorityFilter,
  issueTypeFilter,
  sortBy,
  sortOrder
], () => {
  updateQueryParams()
}, { deep: true })

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

// Filtered and sorted issues (client-side filtering for additional filters)
const filteredIssues = computed(() => {
  if (!issuesData.value?.issues) return []

  let issues = issuesData.value.issues.filter((issue) => {
    // Label filter
    if (labelFilter.value && !issue.labels.includes(labelFilter.value)) {
      return false
    }
    // Assignee filter
    if (assigneeFilter.value) {
      const assigneeName = getAssigneeName(issue.assignee)
      if (!assigneeName || !assigneeName.toLowerCase().includes(assigneeFilter.value.toLowerCase())) {
        return false
      }
    }
    // Priority filter
    if (priorityFilter.value && issue.priority !== priorityFilter.value) {
      return false
    }
    // Issue type filter
    if (issueTypeFilter.value && issue.issueType !== issueTypeFilter.value) {
      return false
    }
    return true
  })

  // Sort issues
  issues = [...issues].sort((a, b) => {
    let comparison = 0

    switch (sortBy.value) {
      case 'updated':
        comparison = new Date(b.updated).getTime() - new Date(a.updated).getTime()
        break
      case 'created':
        comparison = new Date(b.created).getTime() - new Date(a.created).getTime()
        break
      case 'priority':
        const priorityOrder = ['Highest', 'High', 'Medium', 'Low', 'Lowest']
        const aPriority = priorityOrder.indexOf(a.priority || 'Medium')
        const bPriority = priorityOrder.indexOf(b.priority || 'Medium')
        comparison = aPriority - bPriority
        break
      case 'key':
        comparison = a.key.localeCompare(b.key)
        break
      default:
        comparison = 0
    }

    return sortOrder.value === 'asc' ? comparison : -comparison
  })

  return issues
})

// Unique labels from all issues
const availableLabels = computed(() => {
  if (!issuesData.value?.issues) return []
  const labels = new Set<string>()
  issuesData.value.issues.forEach((issue) => {
    issue.labels?.forEach(label => labels.add(label))
  })
  return Array.from(labels).sort()
})

// Unique assignees from all issues
const availableAssignees = computed(() => {
  if (!issuesData.value?.issues) return []
  const assignees = new Set<string>()
  issuesData.value.issues.forEach((issue) => {
    const name = getAssigneeName(issue.assignee)
    if (name) assignees.add(name)
  })
  return Array.from(assignees).sort()
})

// Unique priorities from all issues
const availablePriorities = computed(() => {
  if (!issuesData.value?.issues) return []
  const priorities = new Set<string>()
  issuesData.value.issues.forEach((issue) => {
    if (issue.priority) priorities.add(issue.priority)
  })
  // Sort by priority order
  const priorityOrder = ['Highest', 'High', 'Medium', 'Low', 'Lowest']
  return Array.from(priorities).sort((a, b) =>
    priorityOrder.indexOf(a) - priorityOrder.indexOf(b)
  )
})

// Unique issue types from all issues
const availableIssueTypes = computed(() => {
  if (!issuesData.value?.issues) return []
  const types = new Set<string>()
  issuesData.value.issues.forEach((issue) => {
    if (issue.issueType) types.add(issue.issueType)
  })
  return Array.from(types).sort()
})

// Selected issue detail
const selectedIssue = ref<JiraIssue | null>(null)
const loadingDetail = ref(false)

const refreshDetail = async () => {
  if (!selectedIssueKey.value) {
    selectedIssue.value = null
    return
  }

  loadingDetail.value = true
  try {
    selectedIssue.value = await $fetch<JiraIssue>(`/api/jira/issue/${selectedIssueKey.value}`)
  } catch (e) {
    console.error('Error fetching issue detail:', e)
    selectedIssue.value = null
  } finally {
    loadingDetail.value = false
  }
}

// Watch for issue selection
watch(selectedIssueKey, async (key) => {
  if (key) {
    await refreshDetail()
  }
}, { immediate: true })

// Select first issue on load
watch(filteredIssues, (issues) => {
  if (issues.length && !selectedIssueKey.value) {
    selectedIssueKey.value = issues[0].key
  }
}, { immediate: true })

// Actions
const selectIssue = (key: string) => {
  selectedIssueKey.value = key
}

const clearFilters = () => {
  labelFilter.value = ''
  assigneeFilter.value = ''
  priorityFilter.value = ''
  issueTypeFilter.value = ''
}

const handleRefresh = async () => {
  await refreshDetail()
  await refreshIssues()
}

const hasActiveFilters = computed(() =>
  labelFilter.value
  || assigneeFilter.value
  || priorityFilter.value
  || issueTypeFilter.value
)
</script>

<template>
  <div class="flex-1 min-h-0 flex flex-col">
    <!-- Header -->
    <header class="shrink-0 mb-6">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-4">
          <div class="jira-page-logo">
            <UIcon
              name="i-simple-icons-jira"
              class="w-6 h-6"
            />
          </div>
          <div>
            <h1 class="text-2xl font-display tracking-tight">
              Jira Issues
            </h1>
            <p class="text-sm text-[var(--ui-text-muted)]">
              {{ issuesData?.total || 0 }} issue totali
            </p>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <div class="hidden sm:flex items-center gap-1.5 text-xs text-[var(--ui-text-dimmed)]">
            <UKbd size="sm">
              ⌘
            </UKbd>
            <UKbd size="sm">
              K
            </UKbd>
            <span class="ml-1">per cercare</span>
          </div>
          <button
            class="jira-card__refresh-btn"
            :class="{ 'jira-card__refresh-btn--loading': loadingIssues }"
            :disabled="loadingIssues"
            aria-label="Aggiorna lista issue"
            @click="refreshIssues()"
          >
            <UIcon
              name="i-lucide-refresh-cw"
              class="w-4 h-4"
            />
          </button>
        </div>
      </div>
    </header>

    <!-- Main Layout -->
    <div class="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-6">
      <!-- Sidebar -->
      <aside
        class="flex flex-col min-h-0 overflow-hidden border border-[var(--ui-border)] bg-[var(--ui-bg)]"
        aria-label="Lista issue"
      >
        <!-- Filters -->
        <JiraIssueFilters
          v-model:search="searchQuery"
          v-model:status="statusFilter"
          v-model:label="labelFilter"
          v-model:assignee="assigneeFilter"
          v-model:priority="priorityFilter"
          v-model:issue-type="issueTypeFilter"
          v-model:sort-by="sortBy"
          v-model:sort-order="sortOrder"
          :labels="availableLabels"
          :assignees="availableAssignees"
          :priorities="availablePriorities"
          :issue-types="availableIssueTypes"
          :total-count="issuesData?.total || 0"
          :filtered-count="filteredIssues.length"
          :loading="loadingIssues"
          @clear-filters="clearFilters"
        />

        <!-- Issues List -->
        <JiraIssueList
          :issues="filteredIssues"
          :selected-key="selectedIssueKey"
          :loading="loadingIssues && !issuesData"
          :error="issuesError"
          :has-active-filters="hasActiveFilters"
          @select="selectIssue"
          @clear-filters="clearFilters"
        />
      </aside>

      <!-- Detail Panel -->
      <main
        class="flex flex-col overflow-hidden border border-[var(--ui-border)] bg-[var(--ui-bg)]"
        aria-label="Dettaglio issue"
      >
        <JiraIssueDetail
          :issue="selectedIssue"
          :loading="loadingDetail && !!selectedIssueKey"
          @refresh="handleRefresh"
        />
      </main>
    </div>
  </div>
</template>
