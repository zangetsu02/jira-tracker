<script setup lang="ts">
import { z } from 'zod'
import { refDebounced } from '@vueuse/core'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { AnalysisResult, UseCase, JiraConfig } from '~~/shared/utils/types'

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

interface JiraUser {
  id: string
  name: string
  displayName: string
  email?: string
  avatar?: string
}

// Jira users with search
const userSearchQuery = ref('')
const userSearchQueryDebounced = refDebounced(userSearchQuery, 500)
const jiraUsers = ref<JiraUser[]>([])
const loadingUsers = ref(false)

// Fetch users when search query changes
watch(userSearchQueryDebounced, async (query) => {
  // Only search with at least 2 characters
  if (!query || query.length < 2) {
    jiraUsers.value = []
    return
  }

  loadingUsers.value = true
  try {
    jiraUsers.value = await $fetch<JiraUser[]>(`/api/jira/users?q=${encodeURIComponent(query)}`)
  } catch {
    jiraUsers.value = []
  } finally {
    loadingUsers.value = false
  }
})

// Form state
const creatingIssue = ref(false)
const jiraError = ref<string | null>(null)

// Zod schema for validation
const schema = z.object({
  summary: z.string().min(1, 'Il titolo e obbligatorio'),
  description: z.string().optional(),
  priority: z.string(),
  assignee: z.string().optional(),
  labels: z.array(z.string())
})

type Schema = z.output<typeof schema>

const state = reactive<Schema>({
  summary: '',
  description: '',
  priority: 'Medium',
  assignee: '',
  labels: []
})

const priorityOptions = [
  { label: 'Highest - Critico', value: 'Highest', icon: 'i-lucide-chevrons-up' },
  { label: 'High - Alta', value: 'High', icon: 'i-lucide-chevron-up' },
  { label: 'Medium - Media', value: 'Medium', icon: 'i-lucide-minus' },
  { label: 'Low - Bassa', value: 'Low', icon: 'i-lucide-chevron-down' },
  { label: 'Lowest - Minima', value: 'Lowest', icon: 'i-lucide-chevrons-down' }
]

const userOptions = computed(() => {
  return (jiraUsers.value || [])
    .filter(u => u.name && u.displayName)
    .map(u => ({
      label: u.displayName,
      value: u.name,
      avatar: u.avatar ? { src: u.avatar } : undefined
    }))
})

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

// Initialize form when result changes
watch(() => props.result, (result) => {
  if (result) {
    const msName = props.microserviceName

    state.summary = buildTitle(result, msName)
    state.description = buildDescription(result, msName)
    state.priority = result.confidence === 'high' ? 'High' : result.confidence === 'low' ? 'Low' : 'Medium'
    state.assignee = ''
    state.labels = buildLabels(msName)

    jiraError.value = null
  }
}, { immediate: true })

// Submit handler
const onSubmit = async (event: FormSubmitEvent<Schema>) => {
  if (!props.result) return

  creatingIssue.value = true
  jiraError.value = null

  try {
    const response = await $fetch<{ key: string, url: string }>('/api/jira/issue', {
      method: 'POST',
      body: {
        analysisResultId: props.result.id,
        summary: event.data.summary,
        description: event.data.description,
        priority: event.data.priority,
        assignee: event.data.assignee || undefined,
        labels: event.data.labels
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
    class="sm:max-w-xl"
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

        <!-- Form with validation -->
        <UForm
          :schema="schema"
          :state="state"
          class="space-y-5"
          @submit="onSubmit"
        >
          <!-- Titolo - Full width -->
          <UFormField
            label="Titolo Issue"
            name="summary"
            required
            class="w-full"
          >
            <UInput
              v-model="state.summary"
              placeholder="Titolo della issue"
              size="lg"
              autofocus
              class="w-full"
            />
          </UFormField>

          <!-- Priority & Assignee -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormField
              label="Priorita"
              name="priority"
            >
              <USelect
                v-model="state.priority"
                :items="priorityOptions"
                size="lg"
                class="w-full"
              />
            </UFormField>

            <UFormField
              label="Assegnatario"
              name="assignee"
            >
              <USelectMenu
                v-model="state.assignee"
                :search-term="userSearchQuery"
                :items="userOptions"
                value-key="value"
                placeholder="Non assegnato"
                :loading="loadingUsers"
                size="lg"
                searchable
                searchable-placeholder="Cerca utente..."
                ignore-filter
                class="w-full"
                @update:search-term="userSearchQuery = $event"
              />
            </UFormField>
          </div>

          <!-- Labels con InputTags -->
          <UFormField
            label="Labels"
            name="labels"
            class="w-full"
          >
            <UInputTags
              v-model="state.labels"
              placeholder="Aggiungi label..."
              size="lg"
              class="w-full"
            />
          </UFormField>

          <!-- Description - Full width -->
          <UFormField
            label="Descrizione"
            name="description"
            hint="Formato Jira: *bold*, _italic_, h2. Header"
            class="w-full"
          >
            <UTextarea
              v-model="state.description"
              placeholder="Descrizione della issue..."
              :rows="10"
              size="lg"
              class="w-full font-mono text-sm"
            />
          </UFormField>

          <!-- Submit buttons -->
          <div class="flex items-center justify-end gap-3 pt-2">
            <UButton
              color="neutral"
              variant="ghost"
              size="lg"
              type="button"
              @click="open = false"
            >
              Annulla
            </UButton>
            <UButton
              icon="i-lucide-send"
              color="primary"
              size="lg"
              type="submit"
              :loading="creatingIssue"
            >
              Crea Issue
            </UButton>
          </div>
        </UForm>
      </div>
    </template>
  </UModal>
</template>
