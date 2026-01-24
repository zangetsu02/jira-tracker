<script setup lang="ts">
import type { Microservice, UseCase, AnalysisResult } from '~~/shared/utils/types'

const route = useRoute()
const name = computed(() => route.params.name as string)
const { getStatusColor, getStatusLabel, getCoverageColor } = useAnalysisStatus()

interface MicroserviceDetail extends Microservice {
  usecases: UseCase[]
  analyses: (AnalysisResult & { usecase?: UseCase })[]
}

interface JiraIssue {
  key: string
  url: string
  summary: string
  status: string
  priority?: string
  assignee?: string
  updated: string
  created: string
}

interface JiraIssuesResponse {
  total: number
  issues: JiraIssue[]
}

const { data: microservice, pending, error, refresh } = await useFetch<MicroserviceDetail>(
  () => `/api/microservices/${name.value}`
)

const { data: jiraIssues, pending: jiraLoading, refresh: refreshJira } = await useFetch<JiraIssuesResponse>(
  () => `/api/jira/issues/${name.value}`,
  { default: () => ({ total: 0, issues: [] }) }
)

const analyzing = ref(false)
const analyzeError = ref<string | null>(null)
const uploadProgress = ref(false)
const analysisOutput = ref('')
const analysisProgress = ref(0)
const analysisPhase = ref('')
const fileInput = ref<HTMLInputElement | null>(null)

const PHASE_LABELS: Record<string, string> = {
  thinking: 'Elaborazione...',
  extracting_usecases: 'Estrazione Use Case...',
  analyzing_legacy: 'Analisi legacy...',
  analyzing_microservice: 'Analisi microservizio...',
  comparing: 'Confronto...',
  recommendations: 'Raccomandazioni...',
  generating_json: 'Finalizzazione...'
}

const stats = computed(() => {
  const analyses = microservice.value?.analyses ?? []
  return {
    total: analyses.length,
    implemented: analyses.filter(a => a.status === 'implemented').length,
    partial: analyses.filter(a => a.status === 'partial').length,
    missing: analyses.filter(a => a.status === 'missing').length
  }
})

const coverage = computed(() => {
  if (stats.value.total === 0) return 0
  return Math.round((stats.value.implemented / stats.value.total) * 100)
})

const triggerUpload = () => fileInput.value?.click()

const uploadPdf = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file || file.type !== 'application/pdf') {
    analyzeError.value = 'Il file deve essere un PDF'
    return
  }

  uploadProgress.value = true
  analyzeError.value = null

  try {
    const formData = new FormData()
    formData.append('pdf', file)
    await $fetch(`/api/microservices/${name.value}/pdf`, { method: 'POST', body: formData })
    await refresh()
  } catch (e) {
    analyzeError.value = e instanceof Error ? e.message : 'Errore durante upload'
  } finally {
    uploadProgress.value = false
    if (fileInput.value) fileInput.value.value = ''
  }
}

const startAnalysis = () => {
  analyzing.value = true
  analyzeError.value = null
  analysisOutput.value = ''
  analysisProgress.value = 0
  analysisPhase.value = 'thinking'

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const ws = new WebSocket(`${protocol}//${window.location.host}/_ws`)

  ws.onopen = () => {
    ws.send(JSON.stringify({ type: 'start-analysis', microserviceName: name.value }))
  }

  ws.onmessage = async (event) => {
    try {
      const msg = JSON.parse(event.data)
      switch (msg.type) {
        case 'status':
          analysisProgress.value = msg.progress ?? analysisProgress.value
          break
        case 'chunk':
          analysisOutput.value += msg.text
          analysisPhase.value = msg.phase
          analysisProgress.value = msg.progress ?? analysisProgress.value
          break
        case 'complete':
          analysisProgress.value = 100
          ws.close()
          await refresh()
          analyzing.value = false
          break
        case 'error':
          analyzeError.value = msg.message
          ws.close()
          analyzing.value = false
          break
      }
    } catch (e) {
      console.error('WebSocket parse error:', e)
    }
  }

  ws.onerror = () => {
    analyzeError.value = 'Errore di connessione'
    analyzing.value = false
  }

  ws.onclose = () => {
    if (analyzing.value) analyzing.value = false
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
          { label: name }
        ]"
        class="mb-4"
      />
      <div class="flex items-start justify-between">
        <div>
          <h1 class="text-3xl font-serif">
            {{ name }}
          </h1>
          <p class="text-[var(--ui-text-muted)] mt-1 font-mono text-sm">
            {{ microservice?.path }}
          </p>
        </div>
        <UButtonGroup>
          <UButton
            v-if="!analyzing"
            icon="i-lucide-play"
            color="primary"
            variant="soft"
            :disabled="!microservice?.pdfFilename"
            @click="startAnalysis"
          >
            Analizza
          </UButton>
          <UButton
            icon="i-lucide-list"
            color="neutral"
            variant="outline"
            :to="`/analysis/${name}`"
          >
            Dettagli
          </UButton>
        </UButtonGroup>
      </div>
    </div>

    <!-- Loading -->
    <div
      v-if="pending && !microservice"
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

    <div v-else-if="microservice">
      <!-- Error Alert -->
      <UAlert
        v-if="analyzeError"
        color="error"
        variant="soft"
        icon="i-lucide-alert-circle"
        :description="analyzeError"
        :close-button="{ icon: 'i-lucide-x', color: 'error', variant: 'link' }"
        class="mb-6"
        @close="analyzeError = null"
      />

      <!-- Analysis Progress -->
      <UCard
        v-if="analyzing"
        class="mb-6"
      >
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2">
            <UIcon
              name="i-lucide-loader-2"
              class="w-4 h-4 animate-spin text-[var(--ui-primary)]"
            />
            <span class="text-sm font-medium">{{ PHASE_LABELS[analysisPhase] || 'Analisi in corso...' }}</span>
          </div>
          <UBadge
            color="primary"
            variant="soft"
          >
            {{ analysisProgress }}%
          </UBadge>
        </div>
        <UProgress
          :value="analysisProgress"
          color="primary"
          size="sm"
        />
      </UCard>

      <!-- Stats Grid -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <!-- PDF Card -->
        <UCard>
          <template #header>
            <div class="flex items-center gap-2">
              <UIcon
                name="i-lucide-file-text"
                class="w-4 h-4 text-[var(--ui-text-muted)]"
              />
              <span class="text-sm font-medium">Documento</span>
            </div>
          </template>

          <p class="text-sm text-[var(--ui-text-muted)] mb-4">
            PDF degli use case legacy
          </p>

          <div
            v-if="microservice.pdfFilename"
            class="mb-4"
          >
            <div class="flex items-center gap-2 text-sm">
              <UIcon
                name="i-lucide-check"
                class="w-4 h-4 text-green-500"
              />
              <span class="truncate">{{ microservice.pdfFilename }}</span>
            </div>
          </div>
          <div
            v-else
            class="mb-4"
          >
            <div class="flex items-center gap-2 text-sm text-[var(--ui-text-muted)]">
              <UIcon
                name="i-lucide-x"
                class="w-4 h-4"
              />
              <span>Non caricato</span>
            </div>
          </div>

          <UButton
            :icon="uploadProgress ? 'i-lucide-loader-2' : 'i-lucide-upload'"
            :loading="uploadProgress"
            color="neutral"
            variant="ghost"
            size="xs"
            @click="triggerUpload"
          >
            {{ microservice.pdfFilename ? 'Sostituisci' : 'Carica PDF' }}
          </UButton>
          <input
            ref="fileInput"
            type="file"
            accept="application/pdf"
            class="hidden"
            @change="uploadPdf"
          >
        </UCard>

        <!-- Use Cases Card -->
        <UCard>
          <template #header>
            <div class="flex items-center gap-2">
              <UIcon
                name="i-lucide-list-checks"
                class="w-4 h-4 text-[var(--ui-text-muted)]"
              />
              <span class="text-sm font-medium">Use Cases</span>
            </div>
          </template>

          <p class="text-sm text-[var(--ui-text-muted)] mb-4">
            Analisi degli use case
          </p>

          <p class="text-3xl font-semibold mb-3">
            {{ stats.total }}
          </p>

          <div class="flex items-center gap-3">
            <UBadge
              color="success"
              variant="subtle"
              size="sm"
            >
              {{ stats.implemented }} ok
            </UBadge>
            <UBadge
              color="warning"
              variant="subtle"
              size="sm"
            >
              {{ stats.partial }} parz
            </UBadge>
            <UBadge
              color="error"
              variant="subtle"
              size="sm"
            >
              {{ stats.missing }} manc
            </UBadge>
          </div>
        </UCard>

        <!-- Coverage Card -->
        <UCard>
          <template #header>
            <div class="flex items-center gap-2">
              <UIcon
                name="i-lucide-check-circle"
                class="w-4 h-4 text-[var(--ui-text-muted)]"
              />
              <span class="text-sm font-medium">Copertura</span>
            </div>
          </template>

          <p class="text-sm text-[var(--ui-text-muted)] mb-4">
            Percentuale implementati
          </p>

          <p class="text-3xl font-semibold mb-3">
            {{ coverage }}%
          </p>

          <UProgress
            :value="coverage"
            :color="getCoverageColor(coverage)"
            size="sm"
            :animation="false"
          />
        </UCard>
      </div>

      <!-- Content Grid -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Use Cases List -->
        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <span class="text-sm font-medium">Use Cases Analizzati</span>
              <UBadge
                v-if="stats.total"
                color="neutral"
                variant="subtle"
                size="sm"
              >
                {{ stats.total }} totali
              </UBadge>
            </div>
          </template>

          <div
            v-if="!microservice.analyses?.length"
            class="py-8 text-center"
          >
            <UIcon
              name="i-lucide-search"
              class="w-10 h-10 mx-auto text-[var(--ui-text-muted)] mb-3"
            />
            <p class="text-sm text-[var(--ui-text-muted)]">
              Nessuna analisi
            </p>
            <p class="text-xs text-[var(--ui-text-muted)] mt-1">
              Carica un PDF e avvia l'analisi
            </p>
          </div>

          <div
            v-else
            class="divide-y divide-[var(--ui-border)] max-h-96 overflow-y-auto -mx-4 -mb-4"
          >
            <div
              v-for="analysis in microservice.analyses"
              :key="analysis.id"
              class="px-4 py-3 hover:bg-[var(--ui-bg-elevated)] cursor-pointer transition-colors"
              @click="navigateTo(`/analysis/${name}?highlight=${analysis.id}`)"
            >
              <div class="flex items-start gap-3">
                <UBadge
                  :color="getStatusColor(analysis.status)"
                  variant="soft"
                  size="sm"
                  class="mt-0.5"
                >
                  {{ getStatusLabel(analysis.status, true) }}
                </UBadge>
                <div class="flex-1 min-w-0">
                  <p class="text-sm">
                    <span class="text-[var(--ui-text-muted)] font-mono text-xs">{{ analysis.usecase?.code }}</span>
                    {{ analysis.usecase?.title }}
                  </p>
                  <UBadge
                    v-if="analysis.jiraIssueKey"
                    color="info"
                    variant="subtle"
                    size="xs"
                    class="mt-1 font-mono"
                  >
                    {{ analysis.jiraIssueKey }}
                  </UBadge>
                </div>
                <UIcon
                  name="i-lucide-chevron-right"
                  class="w-4 h-4 text-[var(--ui-text-muted)] mt-0.5"
                />
              </div>
            </div>
          </div>
        </UCard>

        <!-- Jira Issues -->
        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <UIcon
                  name="i-simple-icons-jira"
                  class="w-4 h-4 text-blue-500"
                />
                <span class="text-sm font-medium">Jira Issues</span>
              </div>
              <UButton
                icon="i-lucide-refresh-cw"
                color="neutral"
                variant="ghost"
                size="xs"
                :loading="jiraLoading"
                @click="refreshJira()"
              />
            </div>
          </template>

          <div
            v-if="jiraLoading && !jiraIssues?.issues?.length"
            class="py-8 text-center"
          >
            <UIcon
              name="i-lucide-loader-2"
              class="w-8 h-8 animate-spin text-[var(--ui-text-muted)] mx-auto"
            />
          </div>

          <div
            v-else-if="!jiraIssues?.issues?.length"
            class="py-8 text-center"
          >
            <UIcon
              name="i-lucide-inbox"
              class="w-10 h-10 mx-auto text-[var(--ui-text-muted)] mb-3"
            />
            <p class="text-sm text-[var(--ui-text-muted)]">
              Nessuna issue
            </p>
          </div>

          <div
            v-else
            class="divide-y divide-[var(--ui-border)] max-h-96 overflow-y-auto -mx-4 -mb-4"
          >
            <a
              v-for="issue in jiraIssues.issues"
              :key="issue.key"
              :href="issue.url"
              target="_blank"
              rel="noopener"
              class="flex items-start gap-3 px-4 py-3 hover:bg-[var(--ui-bg-elevated)] transition-colors"
            >
              <UBadge
                color="info"
                variant="soft"
                size="sm"
                class="font-mono mt-0.5"
              >
                {{ issue.key }}
              </UBadge>
              <div class="flex-1 min-w-0">
                <p class="text-sm truncate">{{ issue.summary }}</p>
                <UBadge
                  color="neutral"
                  variant="subtle"
                  size="xs"
                  class="mt-1"
                >
                  {{ issue.status }}
                </UBadge>
              </div>
              <UIcon
                name="i-lucide-external-link"
                class="w-4 h-4 text-[var(--ui-text-muted)] mt-0.5"
              />
            </a>
          </div>
        </UCard>
      </div>

      <!-- Analysis Output -->
      <UCard
        v-if="analysisOutput"
        class="mt-6"
      >
        <template #header>
          <div class="flex items-center justify-between">
            <span class="text-sm font-medium">Output</span>
            <UButton
              icon="i-lucide-x"
              color="neutral"
              variant="ghost"
              size="xs"
              @click="analysisOutput = ''"
            />
          </div>
        </template>
        <div class="bg-[#0a0a0a] rounded-md p-4 max-h-48 overflow-y-auto">
          <pre class="text-xs text-green-400 font-mono whitespace-pre-wrap">{{ analysisOutput }}</pre>
        </div>
      </UCard>
    </div>
  </div>
</template>
