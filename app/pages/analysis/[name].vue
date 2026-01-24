<script setup lang="ts">
import type { Microservice, UseCase, AnalysisResult } from '~~/shared/utils/types'

const route = useRoute()
const name = computed(() => route.params.name as string)
const highlightId = computed(() => route.query.highlight ? Number(route.query.highlight) : null)
const { getStatusColor, getStatusLabel, getConfidenceColor } = useAnalysisStatus()

interface AnalysisData {
  microservice: Microservice
  results: (AnalysisResult & { usecase?: UseCase })[]
  summary: {
    total: number
    implemented: number
    partial: number
    missing: number
    unclear: number
  }
}

interface JiraUser {
  id: string
  name: string
  displayName: string
  email?: string
  avatar?: string
}

const { data, pending, error, refresh } = await useFetch<AnalysisData>(
  () => `/api/analysis/${name.value}`
)

const selectedResult = ref<(AnalysisResult & { usecase?: UseCase }) | null>(null)
const showJiraModal = ref(false)
const creatingIssue = ref(false)
const jiraError = ref<string | null>(null)
const filterStatus = ref<string>('all')

// Jira users
const { data: jiraUsers, pending: loadingUsers } = useFetch<JiraUser[]>('/api/jira/users', {
  default: () => []
})

// Form state for Jira issue
const issueForm = ref({
  summary: '',
  description: '',
  priority: 'Medium',
  assignee: '',
  labels: [] as string[]
})

const newLabel = ref('')

const priorityOptions = [
  { label: 'Highest', value: 'Highest', icon: 'i-lucide-chevrons-up' },
  { label: 'High', value: 'High', icon: 'i-lucide-chevron-up' },
  { label: 'Medium', value: 'Medium', icon: 'i-lucide-minus' },
  { label: 'Low', value: 'Low', icon: 'i-lucide-chevron-down' },
  { label: 'Lowest', value: 'Lowest', icon: 'i-lucide-chevrons-down' }
]

const userOptions = computed(() => {
  return (jiraUsers.value || []).map(u => ({
    label: u.displayName,
    value: u.name,
    avatar: u.avatar
  }))
})

const filteredResults = computed(() => {
  if (!data.value?.results) return []
  if (filterStatus.value === 'all') return data.value.results
  return data.value.results.filter(r => r.status === filterStatus.value)
})

const openJiraModal = (result: AnalysisResult & { usecase?: UseCase }) => {
  selectedResult.value = result
  jiraError.value = null

  const msName = data.value?.microservice.name || 'Unknown'
  const uc = result.usecase

  issueForm.value = {
    summary: uc
      ? `[${msName}] ${result.status === 'missing' ? 'Implementare' : 'Completare'} UC ${uc.code}: ${uc.title}`
      : `[${msName}] ${result.evidence || 'Issue da risolvere'}`,
    description: buildDescription(result, msName),
    priority: result.confidence === 'high' ? 'High' : result.confidence === 'low' ? 'Low' : 'Medium',
    assignee: '',
    labels: [msName]
  }
  newLabel.value = ''

  showJiraModal.value = true
}

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

const addLabel = () => {
  const label = newLabel.value.trim()
  if (label && !issueForm.value.labels.includes(label)) {
    issueForm.value.labels.push(label)
    newLabel.value = ''
  }
}

const removeLabel = (label: string) => {
  issueForm.value.labels = issueForm.value.labels.filter(l => l !== label)
}

const handleLabelKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault()
    addLabel()
  }
}

const createJiraIssue = async () => {
  if (!selectedResult.value) return

  creatingIssue.value = true
  jiraError.value = null

  try {
    const response = await $fetch<{ key: string, url: string }>('/api/jira/issue', {
      method: 'POST',
      body: {
        analysisResultId: selectedResult.value.id,
        summary: issueForm.value.summary,
        description: issueForm.value.description,
        priority: issueForm.value.priority,
        assignee: issueForm.value.assignee || undefined,
        labels: issueForm.value.labels
      }
    })
    showJiraModal.value = false
    await refresh()
    alert(`Issue creata: ${response.key}`)
  } catch (e) {
    jiraError.value = e instanceof Error ? e.message : 'Errore durante creazione issue'
  } finally {
    creatingIssue.value = false
  }
}
</script>

<template>
  <div>
    <!-- Header -->
    <div class="mb-8">
      <UBreadcrumb
        :items="[
          { label: 'Dashboard', to: '/' },
          { label: name, to: `/microservice/${name}` },
          { label: 'Analisi' }
        ]"
        class="mb-4"
      />
      <div class="flex items-start justify-between">
        <div>
          <h1 class="text-3xl font-serif">
            Analisi Dettagliata
          </h1>
          <p
            v-if="data?.microservice.lastAnalysis"
            class="text-[var(--ui-text-muted)] mt-1"
          >
            Ultima analisi: {{ new Date(data.microservice.lastAnalysis).toLocaleString('it-IT') }}
          </p>
        </div>
        <UButton
          icon="i-lucide-arrow-left"
          color="neutral"
          variant="soft"
          :to="`/microservice/${name}`"
        >
          Indietro
        </UButton>
      </div>
    </div>

    <!-- Loading -->
    <div
      v-if="pending && !data"
      class="flex justify-center py-16"
    >
      <UIcon
        name="i-lucide-loader-2"
        class="w-8 h-8 animate-spin text-[var(--ui-text-muted)]"
      />
    </div>

    <!-- Error -->
    <UAlert
      v-else-if="error"
      color="error"
      variant="soft"
      icon="i-lucide-alert-triangle"
      title="Errore"
      :description="error.message"
    />

    <!-- Content -->
    <div v-else-if="data">
      <!-- Filter Cards -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <UCard
          class="cursor-pointer transition-all hover:shadow-md"
          :class="filterStatus === 'all' ? 'ring-2 ring-[var(--ui-primary)]' : ''"
          @click="filterStatus = 'all'"
        >
          <div class="text-center">
            <p class="text-3xl font-bold">
              {{ data.summary.total }}
            </p>
            <p class="text-sm text-[var(--ui-text-muted)]">
              Totale
            </p>
          </div>
        </UCard>
        <UCard
          class="cursor-pointer transition-all hover:shadow-md"
          :class="filterStatus === 'implemented' ? 'ring-2 ring-[var(--ui-success)]' : ''"
          @click="filterStatus = 'implemented'"
        >
          <div class="text-center">
            <p class="text-3xl font-bold text-[var(--ui-success)]">
              {{ data.summary.implemented }}
            </p>
            <p class="text-sm text-[var(--ui-text-muted)]">
              Implementati
            </p>
          </div>
        </UCard>
        <UCard
          class="cursor-pointer transition-all hover:shadow-md"
          :class="filterStatus === 'partial' ? 'ring-2 ring-[var(--ui-warning)]' : ''"
          @click="filterStatus = 'partial'"
        >
          <div class="text-center">
            <p class="text-3xl font-bold text-[var(--ui-warning)]">
              {{ data.summary.partial }}
            </p>
            <p class="text-sm text-[var(--ui-text-muted)]">
              Parziali
            </p>
          </div>
        </UCard>
        <UCard
          class="cursor-pointer transition-all hover:shadow-md"
          :class="filterStatus === 'missing' ? 'ring-2 ring-[var(--ui-error)]' : ''"
          @click="filterStatus = 'missing'"
        >
          <div class="text-center">
            <p class="text-3xl font-bold text-[var(--ui-error)]">
              {{ data.summary.missing }}
            </p>
            <p class="text-sm text-[var(--ui-text-muted)]">
              Mancanti
            </p>
          </div>
        </UCard>
      </div>

      <!-- Results List -->
      <div class="space-y-4">
        <UCard
          v-for="result in filteredResults"
          :id="`result-${result.id}`"
          :key="result.id"
          :class="highlightId === result.id ? 'ring-2 ring-[var(--ui-primary)]' : ''"
        >
          <template #header>
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <UBadge
                  :color="getStatusColor(result.status)"
                  size="lg"
                >
                  {{ getStatusLabel(result.status) }}
                </UBadge>
                <div>
                  <span class="font-mono text-sm text-[var(--ui-text-muted)]">{{ result.usecase?.code }}</span>
                  <h3 class="font-semibold">
                    {{ result.usecase?.title }}
                  </h3>
                </div>
              </div>
              <div class="flex items-center gap-2">
                <UBadge
                  v-if="result.confidence"
                  :color="getConfidenceColor(result.confidence)"
                  variant="subtle"
                  size="sm"
                >
                  Confidence: {{ result.confidence }}
                </UBadge>
                <UBadge
                  v-if="result.jiraIssueKey"
                  color="info"
                  size="sm"
                >
                  {{ result.jiraIssueKey }}
                </UBadge>
                <UButton
                  v-if="!result.jiraIssueKey && result.status !== 'implemented'"
                  icon="i-lucide-ticket"
                  color="primary"
                  variant="outline"
                  size="sm"
                  @click="openJiraModal(result)"
                >
                  Crea Issue
                </UButton>
              </div>
            </div>
          </template>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 class="font-medium text-sm text-[var(--ui-text-muted)] mb-2">
                Descrizione
              </h4>
              <p class="text-sm whitespace-pre-wrap">
                {{ result.usecase?.description || 'N/A' }}
              </p>

              <h4 class="font-medium text-sm text-[var(--ui-text-muted)] mt-4 mb-2">
                Attori
              </h4>
              <p class="text-sm">
                {{ result.usecase?.actors || 'N/A' }}
              </p>

              <h4 class="font-medium text-sm text-[var(--ui-text-muted)] mt-4 mb-2">
                Precondizioni
              </h4>
              <p class="text-sm whitespace-pre-wrap">
                {{ result.usecase?.preconditions || 'N/A' }}
              </p>
            </div>

            <div>
              <h4 class="font-medium text-sm text-[var(--ui-text-muted)] mb-2">
                Flusso Principale
              </h4>
              <p class="text-sm whitespace-pre-wrap">
                {{ result.usecase?.mainFlow || 'N/A' }}
              </p>

              <h4 class="font-medium text-sm text-[var(--ui-text-muted)] mt-4 mb-2">
                Flussi Alternativi
              </h4>
              <p class="text-sm whitespace-pre-wrap">
                {{ result.usecase?.alternativeFlows || 'N/A' }}
              </p>
            </div>
          </div>

          <div
            v-if="result.evidence || result.notes"
            class="mt-6 pt-4 border-t border-[var(--ui-border)]"
          >
            <div
              v-if="result.evidence"
              class="mb-4"
            >
              <h4 class="font-medium text-sm text-[var(--ui-text-muted)] mb-2">
                Evidenze nel Codice
              </h4>
              <p class="text-sm bg-[var(--ui-bg-elevated)] p-3 rounded whitespace-pre-wrap">
                {{ result.evidence }}
              </p>
            </div>

            <div v-if="result.notes">
              <h4 class="font-medium text-sm text-[var(--ui-text-muted)] mb-2">
                Note
              </h4>
              <p class="text-sm bg-[var(--ui-bg-elevated)] p-3 rounded whitespace-pre-wrap">
                {{ result.notes }}
              </p>
            </div>
          </div>
        </UCard>
      </div>
    </div>

    <!-- Jira Issue Modal -->
    <UModal
      v-model:open="showJiraModal"
      :ui="{ width: 'max-w-3xl' }"
    >
      <template #content>
        <div class="bg-[var(--ui-bg)] rounded-lg overflow-hidden">
          <!-- Header -->
          <div class="px-6 py-4 border-b border-[var(--ui-border)] bg-[var(--ui-bg-elevated)]">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <UIcon
                    name="i-simple-icons-jira"
                    class="w-5 h-5 text-blue-500"
                  />
                </div>
                <div>
                  <h3 class="font-semibold text-lg">
                    Nuova Issue Jira
                  </h3>
                  <p class="text-sm text-[var(--ui-text-muted)]">
                    Modifica i dettagli prima di inviare
                  </p>
                </div>
              </div>
              <UButton
                icon="i-lucide-x"
                color="neutral"
                variant="ghost"
                size="sm"
                @click="showJiraModal = false"
              />
            </div>
          </div>

          <!-- Body -->
          <div
            v-if="selectedResult"
            class="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto"
          >
            <UAlert
              v-if="jiraError"
              color="error"
              variant="soft"
              icon="i-lucide-alert-triangle"
              :description="jiraError"
            />

            <!-- Status Info -->
            <div class="flex items-center gap-3 p-3 rounded-lg bg-[var(--ui-bg-elevated)]">
              <UBadge
                :color="getStatusColor(selectedResult.status)"
                size="lg"
              >
                {{ getStatusLabel(selectedResult.status) }}
              </UBadge>
              <UBadge
                v-if="selectedResult.confidence"
                :color="getConfidenceColor(selectedResult.confidence)"
                variant="subtle"
              >
                Confidence: {{ selectedResult.confidence }}
              </UBadge>
              <span
                v-if="selectedResult.usecase?.code"
                class="text-sm text-[var(--ui-text-muted)] font-mono"
              >
                {{ selectedResult.usecase.code }}
              </span>
            </div>

            <!-- Summary -->
            <UFormField label="Titolo">
              <UInput
                v-model="issueForm.summary"
                placeholder="Titolo della issue"
                size="lg"
              />
            </UFormField>

            <!-- Priority & Assignee Row -->
            <div class="grid grid-cols-2 gap-4">
              <UFormField label="Priorità">
                <USelect
                  v-model="issueForm.priority"
                  :items="priorityOptions"
                  size="lg"
                />
              </UFormField>

              <UFormField label="Assegnatario">
                <USelect
                  v-model="issueForm.assignee"
                  :items="userOptions"
                  placeholder="Non assegnato"
                  :loading="loadingUsers"
                  size="lg"
                  searchable
                />
              </UFormField>
            </div>

            <!-- Labels -->
            <UFormField label="Labels">
              <div class="space-y-2">
                <!-- Labels display -->
                <div
                  v-if="issueForm.labels.length > 0"
                  class="flex flex-wrap gap-2"
                >
                  <UBadge
                    v-for="label in issueForm.labels"
                    :key="label"
                    color="primary"
                    variant="soft"
                    size="lg"
                    class="pr-1"
                  >
                    {{ label }}
                    <UButton
                      icon="i-lucide-x"
                      color="primary"
                      variant="link"
                      size="xs"
                      class="ml-1 -mr-1"
                      @click="removeLabel(label)"
                    />
                  </UBadge>
                </div>

                <!-- Add label input -->
                <div class="flex gap-2">
                  <UInput
                    v-model="newLabel"
                    placeholder="Aggiungi label e premi Invio"
                    class="flex-1"
                    @keydown="handleLabelKeydown"
                  />
                  <UButton
                    icon="i-lucide-plus"
                    color="neutral"
                    variant="soft"
                    :disabled="!newLabel.trim()"
                    @click="addLabel"
                  >
                    Aggiungi
                  </UButton>
                </div>
              </div>
            </UFormField>

            <!-- Description -->
            <UFormField label="Descrizione">
              <UTextarea
                v-model="issueForm.description"
                :rows="14"
                placeholder="Descrizione della issue (formato Jira wiki)"
                class="font-mono text-sm"
              />
              <template #hint>
                <span class="text-xs">Formato: *bold*, _italic_, h2. Header, {code}code{code}</span>
              </template>
            </UFormField>
          </div>

          <!-- Footer -->
          <div class="px-6 py-4 border-t border-[var(--ui-border)] bg-[var(--ui-bg-elevated)]">
            <div class="flex justify-between items-center">
              <p class="text-sm text-[var(--ui-text-muted)]">
                L'issue verrà creata nel progetto Jira configurato
              </p>
              <div class="flex gap-2">
                <UButton
                  color="neutral"
                  variant="outline"
                  @click="showJiraModal = false"
                >
                  Annulla
                </UButton>
                <UButton
                  icon="i-lucide-send"
                  color="primary"
                  :loading="creatingIssue"
                  @click="createJiraIssue"
                >
                  Crea Issue
                </UButton>
              </div>
            </div>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
