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

watch([selectedIssueKey, searchQueryDebounced, statusFilter, labelFilter, assigneeFilter], () => {
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

// Filtered issues (client-side filtering for label and assignee)
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

// Unique labels from all issues
const availableLabels = computed(() => {
  if (!issuesData.value?.issues) return []
  const labels = new Set<string>()
  issuesData.value.issues.forEach(issue => {
    issue.labels?.forEach(label => labels.add(label))
  })
  return Array.from(labels).sort()
})

// Unique assignees from all issues
const availableAssignees = computed(() => {
  if (!issuesData.value?.issues) return []
  const assignees = new Set<string>()
  issuesData.value.issues.forEach(issue => {
    const name = getAssigneeName(issue.assignee)
    if (name) assignees.add(name)
  })
  return Array.from(assignees).sort()
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
}

const handleRefresh = async () => {
  await refreshDetail()
  await refreshIssues()
}

const hasActiveFilters = computed(() => labelFilter.value || assigneeFilter.value)
</script>

<template>
  <div class="h-full flex flex-col">
    <!-- Header -->
    <header class="shrink-0 mb-6">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-4">
          <div class="w-12 h-12 bg-[var(--ui-bg-accented)] flex items-center justify-center">
            <UIcon name="i-simple-icons-jira" class="w-6 h-6 text-[var(--ui-text)]" />
          </div>
          <div>
            <h1 class="text-2xl font-semibold">Jira Issues</h1>
            <p class="text-sm text-[var(--ui-text-muted)]">
              <span class="font-medium text-[var(--ui-text)]">{{ filteredIssues.length }}</span>
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
    <div class="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-6">
      <!-- Sidebar -->
      <UCard class="flex flex-col overflow-hidden" :ui="{ body: 'p-0 flex-1 flex flex-col overflow-hidden' }">
        <!-- Filters -->
        <JiraIssueFilters
          v-model:search="searchQuery"
          v-model:status="statusFilter"
          v-model:label="labelFilter"
          v-model:assignee="assigneeFilter"
          :labels="availableLabels"
          :assignees="availableAssignees"
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
      </UCard>

      <!-- Detail Panel -->
      <UCard class="flex flex-col overflow-hidden" :ui="{ body: 'p-0 flex-1 flex flex-col overflow-hidden' }">
        <JiraIssueDetail
          :issue="selectedIssue"
          :loading="loadingDetail && !!selectedIssueKey"
          @refresh="handleRefresh"
        />
      </UCard>
    </div>
  </div>
</template>
