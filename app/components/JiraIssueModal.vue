<script setup lang="ts">
import type { AnalysisResult, UseCase, JiraConfig } from '~~/shared/utils/types'
import type { IssueFormData } from './jira/IssueForm.vue'

interface Props {
  result: (AnalysisResult & { usecase?: UseCase }) | null
  microserviceName: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  created: [issueKey: string]
}>()

const open = defineModel<boolean>('open', { default: false })

// Fetch Jira config for baseLabel and titlePrefix
const { data: jiraConfig } = await useFetch<JiraConfig | null>('/api/jira/config')

const { getStatusColor, getStatusLabel, getConfidenceColor } = useAnalysisStatus()

// Form state
const creatingIssue = ref(false)
const jiraError = ref<string | null>(null)

// Build description from result
const buildDescription = (result: AnalysisResult & { usecase?: UseCase }, msName: string): string => {
  const uc = result.usecase
  const lines: string[] = []

  lines.push(`*Microservizio:* ${msName}`)
  lines.push(`*Status:* ${getStatusLabel(result.status)}`)
  lines.push(`*Confidence:* ${result.confidence || 'N/A'}`)
  lines.push('')

  if (uc) {
    if (uc.description) {
      lines.push('h2. Descrizione Use Case')
      lines.push(uc.description)
      lines.push('')
    }
    if (uc.actors) {
      lines.push('h2. Attori')
      lines.push(uc.actors)
      lines.push('')
    }
    if (uc.mainFlow) {
      lines.push('h2. Flusso Principale')
      lines.push(uc.mainFlow)
      lines.push('')
    }
  }

  if (result.notes) {
    lines.push('h2. Note Analisi')
    lines.push(result.notes)
    lines.push('')
  }

  if (result.evidence) {
    lines.push('h2. Evidenze')
    lines.push(result.evidence)
  }

  return lines.join('\n').trim()
}

// Build title with prefix if configured
const buildTitle = (result: AnalysisResult & { usecase?: UseCase }, msName: string): string => {
  const uc = result.usecase
  const baseTitle = uc
    ? `${result.status === 'missing' ? 'Implementare' : 'Completare'} UC ${uc.code}: ${uc.title}`
    : result.evidence || 'Issue da risolvere'

  const titlePrefix = jiraConfig.value?.titlePrefix
  if (titlePrefix) {
    return titlePrefix
      .replace(/\$NomeMicroservizio/gi, msName)
      .replace(/\$TitoloIssue/gi, baseTitle)
  }

  return `[${msName}] ${baseTitle}`
}

// Build labels with baseLabel if configured
const buildLabels = (msName: string): string[] => {
  const baseLabel = jiraConfig.value?.baseLabel
  if (baseLabel) {
    return [baseLabel, msName]
  }
  return [msName]
}

// Compute initial form data
const initialFormData = computed<Partial<IssueFormData>>(() => {
  if (!props.result) return {}
  
  const msName = props.microserviceName
  return {
    summary: buildTitle(props.result, msName),
    description: buildDescription(props.result, msName),
    priority: props.result.confidence === 'high' ? 'High' : props.result.confidence === 'low' ? 'Low' : 'Medium',
    assignee: '',
    labels: buildLabels(msName)
  }
})

// Reset error when modal opens
watch(open, (isOpen) => {
  if (isOpen) {
    jiraError.value = null
  }
})

// Submit handler
const handleSubmit = async (data: IssueFormData) => {
  if (!props.result) return

  creatingIssue.value = true
  jiraError.value = null

  try {
    const response = await $fetch<{ key: string, url: string }>('/api/jira/issue', {
      method: 'POST',
      body: {
        analysisResultId: props.result.id,
        summary: data.summary,
        description: data.description,
        priority: data.priority,
        assignee: data.assignee || undefined,
        labels: data.labels
      }
    })

    open.value = false
    emit('created', response.key)
  } catch (e) {
    jiraError.value = e instanceof Error ? e.message : 'Errore durante creazione issue'
  } finally {
    creatingIssue.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    class="sm:max-w-2xl"
  >
    <template #header>
      <div class="flex items-center gap-4">
        <div class="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center shrink-0">
          <UIcon
            name="i-simple-icons-jira"
            class="w-5 h-5 text-blue-500"
          />
        </div>
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <h2 class="text-lg font-semibold">
              Crea Issue Jira
            </h2>
            <UBadge
              v-if="result?.usecase?.code"
              size="xs"
              variant="subtle"
              color="neutral"
            >
              {{ result.usecase.code }}
            </UBadge>
          </div>
          <p class="text-sm text-[var(--ui-text-muted)] truncate mt-0.5">
            {{ result?.usecase?.title }}
          </p>
        </div>
      </div>
    </template>

    <template #body>
      <div
        v-if="result"
        class="space-y-5"
      >
        <!-- Error Alert -->
        <UAlert
          v-if="jiraError"
          color="error"
          variant="soft"
          icon="i-lucide-alert-triangle"
          title="Errore"
          :description="jiraError"
          :close-button="{ icon: 'i-lucide-x', color: 'error', variant: 'link' }"
          @close="jiraError = null"
        />

        <!-- Status Info -->
        <div class="flex flex-wrap items-center gap-2 p-3 bg-[var(--ui-bg-elevated)] rounded-lg">
          <UBadge
            :color="getStatusColor(result.status)"
            variant="subtle"
            size="sm"
          >
            {{ getStatusLabel(result.status) }}
          </UBadge>
          <UBadge
            v-if="result.confidence"
            :color="getConfidenceColor(result.confidence)"
            variant="subtle"
            size="sm"
          >
            {{ result.confidence }}
          </UBadge>
          <span class="ml-auto text-xs font-mono text-[var(--ui-text-muted)]">
            {{ result.usecase?.code }}
          </span>
        </div>

        <!-- Shared Form -->
        <JiraIssueForm
          :key="result.id"
          :initial-data="initialFormData"
          :loading="creatingIssue"
          submit-label="Crea Issue"
          submit-icon="i-lucide-send"
          mode="create"
          @submit="handleSubmit"
          @cancel="open = false"
        />
      </div>
    </template>
  </UModal>
</template>
