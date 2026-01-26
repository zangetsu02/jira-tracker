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
  () => `/api/jira/issues/by-label/${name.value}`,
  { default: () => ({ total: 0, issues: [] }) }
)

const analyzing = ref(false)
const extracting = ref(false)
const analyzeError = ref<string | null>(null)
const uploadProgress = ref(false)
const analysisOutput = ref('')
const extractionOutput = ref('')
const analysisProgress = ref(0)
const extractionProgress = ref(0)
const analysisPhase = ref('')
const extractionPhase = ref('')
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

const EXTRACTION_PHASE_LABELS: Record<string, string> = {
  thinking: 'Elaborazione PDF...',
  reading_pdf: 'Lettura documento...',
  extracting: 'Estrazione use case...',
  parsing: 'Parsing risultati...',
  saving: 'Salvataggio...'
}

const hasUseCases = computed(() => (microservice.value?.usecases?.length ?? 0) > 0)
const canExtract = computed(() => !!microservice.value?.pdfFilename && !extracting.value && !analyzing.value)
const canAnalyze = computed(() => hasUseCases.value && !analyzing.value && !extracting.value)

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

const shortName = computed(() => name.value.replace('sil-ms-', ''))

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

const startExtraction = () => {
  extracting.value = true
  analyzeError.value = null
  extractionOutput.value = ''
  extractionProgress.value = 0
  extractionPhase.value = 'thinking'

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const ws = new WebSocket(`${protocol}//${window.location.host}/_ws`)

  ws.onopen = () => {
    ws.send(JSON.stringify({ type: 'start-extraction', microserviceName: name.value }))
  }

  ws.onmessage = async (event) => {
    try {
      const msg = JSON.parse(event.data)
      switch (msg.type) {
        case 'status':
          extractionProgress.value = msg.progress ?? extractionProgress.value
          break
        case 'chunk':
          extractionOutput.value += msg.text
          extractionPhase.value = msg.phase
          extractionProgress.value = msg.progress ?? extractionProgress.value
          break
        case 'complete':
          extractionProgress.value = 100
          ws.close()
          await refresh()
          extracting.value = false
          break
        case 'error':
          analyzeError.value = msg.message
          ws.close()
          extracting.value = false
          break
      }
    } catch (e) {
      console.error('WebSocket parse error:', e)
    }
  }

  ws.onerror = () => {
    analyzeError.value = 'Errore di connessione'
    extracting.value = false
  }

  ws.onclose = () => {
    if (extracting.value) extracting.value = false
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

const formatDate = (date: string | null) => {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  })
}
</script>

<template>
  <div class="animate-fade-in">
    <!-- Breadcrumb -->
    <nav class="mb-6">
      <ol class="flex items-center gap-2 text-sm">
        <li>
          <NuxtLink
            to="/"
            class="text-[var(--ui-text-muted)] hover:text-[var(--ui-text)] transition-colors"
          >
            Dashboard
          </NuxtLink>
        </li>
        <li class="text-[var(--ui-text-dimmed)]">/</li>
        <li class="text-[var(--ui-text)] font-medium">{{ shortName }}</li>
      </ol>
    </nav>

    <!-- Header -->
    <header class="mb-8">
      <div class="flex items-start justify-between gap-8">
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-4 mb-2">
            <div class="w-14 h-14 bg-[var(--ui-bg-muted)] flex items-center justify-center">
              <UIcon
                name="i-lucide-box"
                class="w-7 h-7 text-[var(--ui-text-muted)]"
              />
            </div>
            <div>
              <h1 class="text-4xl lg:text-5xl font-display tracking-tight">
                {{ shortName }}
              </h1>
              <p class="text-sm font-mono text-[var(--ui-text-muted)] mt-1 truncate">
                {{ microservice?.path }}
              </p>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <button
            v-if="!extracting"
            class="h-12 px-6 bg-[var(--ui-bg-muted)] text-[var(--ui-text)] border border-[var(--ui-border)] font-medium text-sm flex items-center gap-2 hover:bg-[var(--ui-bg-accent)] transition-colors disabled:opacity-50"
            :disabled="!canExtract"
            :title="!microservice?.pdfFilename ? 'Carica prima un PDF' : ''"
            @click="startExtraction"
          >
            <UIcon
              name="i-lucide-file-search"
              class="w-4 h-4"
            />
            Estrai Use Case
          </button>
          <button
            v-if="!analyzing"
            class="h-12 px-6 bg-[var(--ui-text)] text-[var(--ui-bg)] font-medium text-sm flex items-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
            :disabled="!canAnalyze"
            :title="!hasUseCases ? 'Estrai prima gli use case' : ''"
            @click="startAnalysis"
          >
            <UIcon
              name="i-lucide-play"
              class="w-4 h-4"
            />
            Analizza
          </button>
          <NuxtLink
            :to="`/analysis/${name}`"
            class="h-12 px-6 bg-[var(--ui-bg-muted)] text-[var(--ui-text)] border border-[var(--ui-border)] font-medium text-sm flex items-center gap-2 hover:bg-[var(--ui-bg-accent)] transition-colors"
          >
            <UIcon
              name="i-lucide-list"
              class="w-4 h-4"
            />
            Dettagli
          </NuxtLink>
        </div>
      </div>
    </header>

    <!-- Loading -->
    <div
      v-if="pending && !microservice"
      class="flex items-center justify-center py-32"
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

    <div
      v-else-if="microservice"
      class="space-y-6"
    >
      <!-- Error Alert -->
      <div
        v-if="analyzeError"
        class="flex items-center gap-3 p-4 bg-[var(--ui-error-soft)] text-[var(--ui-error)]"
      >
        <UIcon
          name="i-lucide-alert-circle"
          class="w-5 h-5"
        />
        <span class="flex-1">{{ analyzeError }}</span>
        <button @click="analyzeError = null">
          <UIcon
            name="i-lucide-x"
            class="w-4 h-4"
          />
        </button>
      </div>

      <!-- Extraction Progress -->
      <div
        v-if="extracting"
        class="bento-item p-6"
      >
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 bg-[var(--ui-info-soft)] flex items-center justify-center">
              <UIcon
                name="i-lucide-file-search"
                class="w-5 h-5 text-[var(--ui-info)] animate-pulse"
              />
            </div>
            <div>
              <p class="font-medium">{{ EXTRACTION_PHASE_LABELS[extractionPhase] || 'Estrazione in corso...' }}</p>
              <p class="text-xs text-[var(--ui-text-muted)]">Claude sta leggendo il PDF ed estraendo gli use case</p>
            </div>
          </div>
          <span class="text-2xl font-display">{{ extractionProgress }}%</span>
        </div>
        <div class="h-2 bg-[var(--ui-bg-muted)] overflow-hidden">
          <div
            class="h-full bg-[var(--ui-info)] transition-all duration-300"
            :style="{ width: `${extractionProgress}%` }"
          />
        </div>
      </div>

      <!-- Analysis Progress -->
      <div
        v-if="analyzing"
        class="bento-item p-6"
      >
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 bg-[var(--accent-soft)] flex items-center justify-center">
              <UIcon
                name="i-lucide-loader-2"
                class="w-5 h-5 text-[var(--accent)] animate-spin"
              />
            </div>
            <div>
              <p class="font-medium">{{ PHASE_LABELS[analysisPhase] || 'Analisi in corso...' }}</p>
              <p class="text-xs text-[var(--ui-text-muted)]">Claude sta analizzando il microservizio</p>
            </div>
          </div>
          <span class="text-2xl font-display">{{ analysisProgress }}%</span>
        </div>
        <div class="h-2 bg-[var(--ui-bg-muted)] overflow-hidden">
          <div
            class="h-full bg-[var(--accent)] transition-all duration-300"
            :style="{ width: `${analysisProgress}%` }"
          />
        </div>
      </div>

      <!-- Stats Grid -->
      <div class="bento-grid">
        <!-- PDF Card -->
        <div class="bento-item bento-item--span-4 p-6 animate-slide-up stagger-1">
          <div class="flex items-start justify-between mb-4">
            <p class="text-xs font-semibold uppercase tracking-wider text-[var(--ui-text-muted)]">
              Documento PDF
            </p>
            <div
              class="w-10 h-10 flex items-center justify-center"
              :class="microservice.pdfFilename ? 'bg-[var(--ui-success-soft)]' : 'bg-[var(--ui-bg-muted)]'"
            >
              <UIcon
                :name="microservice.pdfFilename ? 'i-lucide-file-check' : 'i-lucide-file-x'"
                class="w-5 h-5"
                :class="microservice.pdfFilename ? 'text-[var(--ui-success)]' : 'text-[var(--ui-text-muted)]'"
              />
            </div>
          </div>

          <div
            v-if="microservice.pdfFilename"
            class="mb-4"
          >
            <p class="font-medium truncate">{{ microservice.pdfFilename }}</p>
            <p class="text-xs text-[var(--ui-text-muted)] mt-1">PDF caricato</p>
          </div>
          <div
            v-else
            class="mb-4"
          >
            <p class="text-[var(--ui-text-muted)]">Non caricato</p>
            <p class="text-xs text-[var(--ui-text-dimmed)] mt-1">Carica un PDF per avviare l'analisi</p>
          </div>

          <button
            class="h-10 px-4 bg-[var(--ui-bg-muted)] text-[var(--ui-text)] border border-[var(--ui-border)] text-sm flex items-center gap-2 hover:bg-[var(--ui-bg-accent)] transition-colors disabled:opacity-50"
            :disabled="uploadProgress"
            @click="triggerUpload"
          >
            <UIcon
              :name="uploadProgress ? 'i-lucide-loader-2' : 'i-lucide-upload'"
              class="w-4 h-4"
              :class="uploadProgress ? 'animate-spin' : ''"
            />
            {{ microservice.pdfFilename ? 'Sostituisci' : 'Carica PDF' }}
          </button>
          <input
            ref="fileInput"
            type="file"
            accept="application/pdf"
            class="hidden"
            @change="uploadPdf"
          >
        </div>

        <!-- Use Cases Estratti Card -->
        <div class="bento-item bento-item--span-4 p-6 animate-slide-up stagger-2">
          <div class="flex items-start justify-between mb-4">
            <p class="text-xs font-semibold uppercase tracking-wider text-[var(--ui-text-muted)]">
              Use Cases Estratti
            </p>
            <div
              class="w-10 h-10 flex items-center justify-center"
              :class="hasUseCases ? 'bg-[var(--ui-success-soft)]' : 'bg-[var(--ui-bg-muted)]'"
            >
              <UIcon
                name="i-lucide-list-checks"
                class="w-5 h-5"
                :class="hasUseCases ? 'text-[var(--ui-success)]' : 'text-[var(--ui-text-muted)]'"
              />
            </div>
          </div>

          <p class="text-5xl font-display mb-2">
            {{ microservice?.usecases?.length ?? 0 }}
          </p>

          <p
            v-if="hasUseCases"
            class="text-xs text-[var(--ui-text-muted)] mb-3"
          >
            Pronti per l'analisi
          </p>
          <p
            v-else
            class="text-xs text-[var(--ui-text-dimmed)] mb-3"
          >
            Estrai use case dal PDF
          </p>

          <button
            v-if="microservice?.pdfFilename && !hasUseCases"
            class="h-8 px-3 bg-[var(--ui-bg-muted)] text-[var(--ui-text)] border border-[var(--ui-border)] text-xs flex items-center gap-2 hover:bg-[var(--ui-bg-accent)] transition-colors disabled:opacity-50"
            :disabled="!canExtract"
            @click="startExtraction"
          >
            <UIcon
              name="i-lucide-file-search"
              class="w-3 h-3"
            />
            Estrai
          </button>
        </div>

        <!-- Analisi Card -->
        <div class="bento-item bento-item--span-4 p-6 animate-slide-up stagger-3">
          <div class="flex items-start justify-between mb-4">
            <p class="text-xs font-semibold uppercase tracking-wider text-[var(--ui-text-muted)]">
              Risultati Analisi
            </p>
            <div class="w-10 h-10 bg-[var(--ui-bg-muted)] flex items-center justify-center">
              <UIcon
                name="i-lucide-bar-chart-3"
                class="w-5 h-5 text-[var(--ui-text-muted)]"
              />
            </div>
          </div>

          <p class="text-5xl font-display mb-4">
            {{ stats.total }}
          </p>

          <div
            v-if="stats.total > 0"
            class="flex flex-wrap gap-2"
          >
            <span class="tag tag--success">
              <UIcon
                name="i-lucide-check"
                class="w-3 h-3"
              />
              {{ stats.implemented }} ok
            </span>
            <span class="tag tag--warning">
              <UIcon
                name="i-lucide-minus"
                class="w-3 h-3"
              />
              {{ stats.partial }} parz
            </span>
            <span class="tag tag--error">
              <UIcon
                name="i-lucide-x"
                class="w-3 h-3"
              />
              {{ stats.missing }} manc
            </span>
          </div>
          <p
            v-else
            class="text-xs text-[var(--ui-text-dimmed)]"
          >
            Avvia analisi per vedere i risultati
          </p>
        </div>

        <!-- Coverage Card -->
        <div class="bento-item bento-item--span-4 p-6 animate-slide-up stagger-4">
          <div class="flex items-start justify-between mb-4">
            <p class="text-xs font-semibold uppercase tracking-wider text-[var(--ui-text-muted)]">
              Copertura
            </p>
            <div
              class="w-10 h-10 flex items-center justify-center"
              :class="coverage >= 80 ? 'bg-[var(--ui-success-soft)]' : coverage >= 50 ? 'bg-[var(--ui-warning-soft)]' : 'bg-[var(--ui-error-soft)]'"
            >
              <UIcon
                name="i-lucide-pie-chart"
                class="w-5 h-5"
                :class="coverage >= 80 ? 'text-[var(--ui-success)]' : coverage >= 50 ? 'text-[var(--ui-warning)]' : 'text-[var(--ui-error)]'"
              />
            </div>
          </div>

          <p class="text-5xl font-display mb-4">
            {{ coverage }}<span class="text-2xl text-[var(--ui-text-muted)]">%</span>
          </p>

          <div class="h-2 bg-[var(--ui-bg-muted)] overflow-hidden">
            <div
              class="h-full transition-all duration-500"
              :class="coverage >= 80 ? 'bg-[var(--ui-success)]' : coverage >= 50 ? 'bg-[var(--ui-warning)]' : 'bg-[var(--ui-error)]'"
              :style="{ width: `${coverage}%` }"
            />
          </div>
        </div>
      </div>

      <!-- Extracted Use Cases Section -->
      <div
        v-if="hasUseCases"
        class="bento-item animate-slide-up stagger-5"
      >
        <div class="section-header">
          <h2 class="section-header__title">
            Use Cases Estratti dal PDF
          </h2>
          <span class="text-xs font-mono text-[var(--ui-text-dimmed)]">
            {{ microservice?.usecases?.length ?? 0 }} use case
          </span>
        </div>

        <div class="max-h-[300px] overflow-y-auto">
          <div
            v-for="(uc, index) in microservice?.usecases"
            :key="uc.id"
            class="data-row animate-slide-in-right"
            :style="{ animationDelay: `${index * 0.03}s` }"
          >
            <div class="w-8 h-8 bg-[var(--ui-bg-muted)] flex items-center justify-center shrink-0">
              <span class="text-xs font-mono text-[var(--ui-text-muted)]">{{ index + 1 }}</span>
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium">
                <span class="font-mono text-xs text-[var(--ui-info)] mr-2">{{ uc.code }}</span>
                {{ uc.title }}
              </p>
              <p
                v-if="uc.description"
                class="text-xs text-[var(--ui-text-muted)] mt-1 line-clamp-2"
              >
                {{ uc.description }}
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Two Column Layout -->
      <div class="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <!-- Use Cases Analizzati List -->
        <div class="bento-item animate-slide-up stagger-6">
          <div class="section-header">
            <h2 class="section-header__title">
              Risultati Analisi
            </h2>
            <span
              v-if="stats.total"
              class="text-xs font-mono text-[var(--ui-text-dimmed)]"
            >
              {{ stats.total }} totali
            </span>
          </div>

          <div
            v-if="!microservice.analyses?.length"
            class="empty-state"
          >
            <UIcon
              name="i-lucide-search"
              class="empty-state__icon"
            />
            <p class="empty-state__title">
              Nessuna analisi
            </p>
            <p class="empty-state__description">
              {{ hasUseCases ? 'Avvia l\'analisi per confrontare gli use case' : 'Estrai gli use case e avvia l\'analisi' }}
            </p>
          </div>

          <div
            v-else
            class="max-h-[400px] overflow-y-auto"
          >
            <div
              v-for="(analysis, index) in microservice.analyses"
              :key="analysis.id"
              class="data-row data-row--clickable animate-slide-in-right"
              :style="{ animationDelay: `${index * 0.03}s` }"
              @click="navigateTo(`/analysis/${name}?highlight=${analysis.id}`)"
            >
              <span
                class="status-dot"
                :class="{
                  'status-dot--success': analysis.status === 'implemented',
                  'status-dot--warning': analysis.status === 'partial',
                  'status-dot--error': analysis.status === 'missing',
                  'status-dot--muted': analysis.status === 'unclear'
                }"
              />
              <div class="flex-1 min-w-0">
                <p class="text-xs text-[var(--ui-text-muted)] line-clamp-1">
                  {{ analysis.usecase?.description || analysis.evidence || analysis.notes }}
                </p>
                <div
                  v-if="analysis.jiraIssueKey"
                  class="mt-1"
                >
                  <span class="tag tag--info font-mono text-xs">
                    {{ analysis.jiraIssueKey }}
                  </span>
                </div>
              </div>
              <UIcon
                name="i-lucide-chevron-right"
                class="w-4 h-4 text-[var(--ui-text-dimmed)]"
              />
            </div>
          </div>
        </div>

        <!-- Jira Issues -->
        <div class="bento-item animate-slide-up stagger-7">
          <div class="section-header">
            <div class="flex items-center gap-2">
              <UIcon
                name="i-simple-icons-jira"
                class="w-4 h-4 text-[var(--ui-info)]"
              />
              <h2 class="section-header__title">
                Issue Jira
              </h2>
            </div>
            <button
              class="text-[var(--ui-text-muted)] hover:text-[var(--ui-text)] transition-colors"
              :disabled="jiraLoading"
              @click="refreshJira()"
            >
              <UIcon
                name="i-lucide-refresh-cw"
                class="w-4 h-4"
                :class="jiraLoading ? 'animate-spin' : ''"
              />
            </button>
          </div>

          <div
            v-if="jiraLoading && !jiraIssues?.issues?.length"
            class="flex items-center justify-center py-12"
          >
            <UIcon
              name="i-lucide-loader-2"
              class="w-6 h-6 animate-spin text-[var(--ui-text-muted)]"
            />
          </div>

          <div
            v-else-if="!jiraIssues?.issues?.length"
            class="empty-state"
          >
            <UIcon
              name="i-lucide-inbox"
              class="empty-state__icon"
            />
            <p class="empty-state__title">
              Nessuna issue
            </p>
            <p class="empty-state__description">
              Le issue verranno mostrate dopo l'analisi
            </p>
          </div>

          <div
            v-else
            class="max-h-[400px] overflow-y-auto"
          >
            <a
              v-for="(issue, index) in jiraIssues.issues"
              :key="issue.key"
              :href="issue.url"
              target="_blank"
              rel="noopener"
              class="data-row animate-slide-in-right"
              :style="{ animationDelay: `${index * 0.03}s` }"
            >
              <span class="tag tag--info font-mono">
                {{ issue.key }}
              </span>
              <div class="flex-1 min-w-0">
                <p class="text-sm truncate">{{ issue.summary }}</p>
                <div class="flex items-center gap-2 mt-1">
                  <span class="tag">{{ issue.status }}</span>
                  <span class="text-xs text-[var(--ui-text-dimmed)]">
                    {{ formatDate(issue.updated) }}
                  </span>
                </div>
              </div>
              <UIcon
                name="i-lucide-external-link"
                class="w-4 h-4 text-[var(--ui-text-dimmed)]"
              />
            </a>
          </div>
        </div>
      </div>

      <!-- Extraction Output Console -->
      <div
        v-if="extractionOutput"
        class="bento-item animate-slide-up"
      >
        <div class="section-header">
          <h2 class="section-header__title">
            Output Estrazione
          </h2>
          <button
            class="text-[var(--ui-text-muted)] hover:text-[var(--ui-text)] transition-colors"
            @click="extractionOutput = ''"
          >
            <UIcon
              name="i-lucide-x"
              class="w-4 h-4"
            />
          </button>
        </div>
        <div class="p-4 bg-[#0a0a0a] max-h-64 overflow-y-auto">
          <pre class="text-xs text-[var(--ui-text-muted)] font-mono whitespace-pre-wrap leading-relaxed">{{ extractionOutput }}</pre>
        </div>
      </div>

      <!-- Analysis Output Console -->
      <div
        v-if="analysisOutput"
        class="bento-item animate-slide-up"
      >
        <div class="section-header">
          <h2 class="section-header__title">
            Output Analisi
          </h2>
          <button
            class="text-[var(--ui-text-muted)] hover:text-[var(--ui-text)] transition-colors"
            @click="analysisOutput = ''"
          >
            <UIcon
              name="i-lucide-x"
              class="w-4 h-4"
            />
          </button>
        </div>
        <div class="p-4 bg-[#0a0a0a] max-h-64 overflow-y-auto">
          <pre class="text-xs text-green-400 font-mono whitespace-pre-wrap leading-relaxed">{{ analysisOutput }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>
