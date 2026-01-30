<script setup lang="ts">
import type { Microservice, UseCase, AnalysisResult, AnalysisPrompt } from '~~/shared/utils/types'

const route = useRoute()
const name = computed(() => route.params.name as string)
const { getStatusColor: _getStatusColor, getStatusLabel: _getStatusLabel, getCoverageColor: _getCoverageColor } = useAnalysisStatus()

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
  labels?: string[]
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

const { data: prompts, refresh: _refreshPrompts } = await useFetch<AnalysisPrompt[]>('/api/prompts', {
  default: () => []
})

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

// Prompt selection drawer
const promptDrawerOpen = ref(false)
const selectedPromptId = ref<number | null>(null)

const _selectedPrompt = computed(() => {
  if (!selectedPromptId.value) return null
  return prompts.value?.find(p => p.id === selectedPromptId.value) || null
})

const _defaultPrompt = computed(() => {
  return prompts.value?.find(p => p.isDefault) || prompts.value?.[0] || null
})

// Initialize selected prompt with default
watch(prompts, (list) => {
  if (list && list.length > 0 && !selectedPromptId.value) {
    const defaultP = list.find(p => p.isDefault)
    selectedPromptId.value = defaultP?.id || list[0].id
  }
}, { immediate: true })

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

const openAnalysisDrawer = () => {
  promptDrawerOpen.value = true
}

const startAnalysis = () => {
  promptDrawerOpen.value = false
  analyzing.value = true
  analyzeError.value = null
  analysisOutput.value = ''
  analysisProgress.value = 0
  analysisPhase.value = 'thinking'

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const ws = new WebSocket(`${protocol}//${window.location.host}/_ws`)

  ws.onopen = () => {
    ws.send(JSON.stringify({
      type: 'start-analysis',
      microserviceName: name.value,
      promptId: selectedPromptId.value
    }))
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
        <li class="text-[var(--ui-text-dimmed)]">
          /
        </li>
        <li class="text-[var(--ui-text)] font-medium">
          {{ shortName }}
        </li>
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
            @click="openAnalysisDrawer"
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
              <p class="font-medium">
                {{ EXTRACTION_PHASE_LABELS[extractionPhase] || 'Estrazione in corso...' }}
              </p>
              <p class="text-xs text-[var(--ui-text-muted)]">
                Claude sta leggendo il PDF ed estraendo gli use case
              </p>
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
              <p class="font-medium">
                {{ PHASE_LABELS[analysisPhase] || 'Analisi in corso...' }}
              </p>
              <p class="text-xs text-[var(--ui-text-muted)]">
                Claude sta analizzando il microservizio
              </p>
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
        <div class="bento-item bento-item--span-3 p-6 animate-slide-up stagger-1 report-card group">
          <div class="report-card__header">
            <div
              class="report-card__icon-wrapper"
              :class="microservice.pdfFilename ? 'report-card__icon-wrapper--success' : 'report-card__icon-wrapper--muted'"
            >
              <UIcon
                :name="microservice.pdfFilename ? 'i-lucide-file-check' : 'i-lucide-file-x'"
                class="w-5 h-5"
              />
              <div class="report-card__icon-ring" />
            </div>
            <span class="report-card__label">Documento PDF</span>
          </div>

          <div class="mt-5">
            <div
              v-if="microservice.pdfFilename"
              class="report-card__file-info"
            >
              <p class="font-medium text-sm truncate">
                {{ microservice.pdfFilename }}
              </p>
              <span class="report-card__badge report-card__badge--success mt-2">Caricato</span>
            </div>
            <div
              v-else
              class="report-card__file-info"
            >
              <p class="text-[var(--ui-text-muted)] text-sm">
                Non caricato
              </p>
              <p class="text-xs text-[var(--ui-text-dimmed)] mt-1">
                Carica un PDF per avviare l'analisi
              </p>
            </div>
          </div>

          <button
            class="report-card__action-btn mt-4"
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
        <div class="bento-item bento-item--span-3 p-6 animate-slide-up stagger-2 report-card group">
          <div class="report-card__header">
            <div
              class="report-card__icon-wrapper"
              :class="hasUseCases ? 'report-card__icon-wrapper--success' : 'report-card__icon-wrapper--muted'"
            >
              <UIcon
                name="i-lucide-list-checks"
                class="w-5 h-5"
              />
              <div class="report-card__icon-ring" />
            </div>
            <span class="report-card__label">Use Cases</span>
          </div>

          <div class="report-card__value-wrapper mt-5">
            <div class="report-card__value-main">
              <span class="report-card__value">{{ microservice?.usecases?.length ?? 0 }}</span>
            </div>
            <span
              v-if="hasUseCases"
              class="report-card__badge report-card__badge--success"
            >
              Pronti
            </span>
          </div>

          <p
            v-if="!hasUseCases"
            class="text-xs text-[var(--ui-text-dimmed)] mt-3"
          >
            Estrai use case dal PDF
          </p>

          <button
            v-if="microservice?.pdfFilename && !hasUseCases"
            class="report-card__action-btn report-card__action-btn--secondary mt-4"
            :disabled="!canExtract"
            @click="startExtraction"
          >
            <UIcon
              name="i-lucide-file-search"
              class="w-3.5 h-3.5"
            />
            Estrai
          </button>
        </div>

        <!-- Analisi Card -->
        <div class="bento-item bento-item--span-3 p-6 animate-slide-up stagger-3 report-card group">
          <div class="report-card__header">
            <div class="report-card__icon-wrapper report-card__icon-wrapper--info">
              <UIcon
                name="i-lucide-bar-chart-3"
                class="w-5 h-5"
              />
              <div class="report-card__icon-ring" />
            </div>
            <span class="report-card__label">Risultati</span>
          </div>

          <div class="report-card__value-wrapper mt-5">
            <div class="report-card__value-main">
              <span class="report-card__value">{{ stats.total }}</span>
            </div>
          </div>

          <div
            v-if="stats.total > 0"
            class="mt-4 space-y-2"
          >
            <div class="report-card__result-row report-card__result-row--success">
              <UIcon
                name="i-lucide-check-circle"
                class="w-3.5 h-3.5"
              />
              <span class="flex-1">Implementati</span>
              <span class="font-mono font-semibold">{{ stats.implemented }}</span>
            </div>
            <div class="report-card__result-row report-card__result-row--warning">
              <UIcon
                name="i-lucide-minus-circle"
                class="w-3.5 h-3.5"
              />
              <span class="flex-1">Parziali</span>
              <span class="font-mono font-semibold">{{ stats.partial }}</span>
            </div>
            <div class="report-card__result-row report-card__result-row--error">
              <UIcon
                name="i-lucide-x-circle"
                class="w-3.5 h-3.5"
              />
              <span class="flex-1">Mancanti</span>
              <span class="font-mono font-semibold">{{ stats.missing }}</span>
            </div>
          </div>
          <p
            v-else
            class="text-xs text-[var(--ui-text-dimmed)] mt-3"
          >
            Avvia analisi per vedere i risultati
          </p>
        </div>

        <!-- Coverage Card -->
        <div class="bento-item bento-item--span-3 p-6 animate-slide-up stagger-4 report-card group">
          <div class="report-card__header">
            <div
              class="report-card__icon-wrapper"
              :class="coverage >= 80 ? 'report-card__icon-wrapper--success' : coverage >= 50 ? 'report-card__icon-wrapper--warning' : 'report-card__icon-wrapper--error'"
            >
              <UIcon
                name="i-lucide-pie-chart"
                class="w-5 h-5"
              />
              <div class="report-card__icon-ring" />
            </div>
            <span class="report-card__label">Copertura</span>
          </div>

          <div class="report-card__value-wrapper mt-5">
            <div class="report-card__value-main">
              <span class="report-card__value">{{ coverage }}</span>
              <span class="report-card__value-suffix">%</span>
            </div>
            <div
              class="report-card__trend"
              :class="coverage >= 80 ? 'report-card__trend--up' : coverage < 50 ? 'report-card__trend--down' : ''"
            >
              <UIcon
                :name="coverage >= 80 ? 'i-lucide-trending-up' : coverage < 50 ? 'i-lucide-trending-down' : 'i-lucide-minus'"
                class="w-4 h-4"
              />
            </div>
          </div>

          <div class="mt-4">
            <div class="report-card__progress">
              <div class="report-card__progress-track">
                <div
                  class="report-card__progress-fill"
                  :class="coverage >= 80 ? 'report-card__progress-fill--success' : coverage >= 50 ? 'report-card__progress-fill--warning' : 'report-card__progress-fill--error'"
                  :style="{ width: `${coverage}%` }"
                />
              </div>
            </div>
            <span
              class="report-card__badge mt-3"
              :class="coverage >= 80 ? 'report-card__badge--success' : coverage >= 50 ? 'report-card__badge--warning' : 'report-card__badge--error'"
            >
              {{ coverage >= 80 ? 'Ottimo' : coverage >= 50 ? 'Discreto' : 'Critico' }}
            </span>
          </div>
        </div>
      </div>

      <!-- Two Column Layout: Use Cases + Risultati Analisi -->
      <div class="grid grid-cols-1 xl:grid-cols-2 gap-6">
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

          <div class="max-h-[400px] overflow-y-auto">
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
      </div>

      <!-- Jira Issues - Full Width -->
      <div class="bento-item animate-slide-up stagger-7 jira-card">
        <!-- Header -->
        <div class="jira-card__header">
          <div class="jira-card__title-wrapper">
            <div class="jira-card__logo">
              <UIcon
                name="i-simple-icons-jira"
                class="w-5 h-5"
              />
            </div>
            <div>
              <h2 class="jira-card__title">
                Issue Jira
              </h2>
              <p class="jira-card__subtitle">
                {{ jiraIssues?.total || 0 }} issue collegate
              </p>
            </div>
          </div>
          <button
            class="jira-card__refresh-btn"
            :class="{ 'jira-card__refresh-btn--loading': jiraLoading }"
            :disabled="jiraLoading"
            @click="refreshJira()"
          >
            <UIcon
              name="i-lucide-refresh-cw"
              class="w-4 h-4"
            />
          </button>
        </div>

        <!-- Stats Bar -->
        <div
          v-if="jiraIssues?.issues?.length"
          class="jira-card__stats"
        >
          <div class="jira-card__stat">
            <span class="jira-card__stat-value">{{ jiraIssues.issues.filter(i => i.status === 'Aperto' || i.status === 'Open' || i.status === 'To Do').length }}</span>
            <span class="jira-card__stat-label">Aperte</span>
          </div>
          <div class="jira-card__stat-divider" />
          <div class="jira-card__stat">
            <span class="jira-card__stat-value">{{ jiraIssues.issues.filter(i => i.status === 'In Progress' || i.status === 'In Corso').length }}</span>
            <span class="jira-card__stat-label">In corso</span>
          </div>
          <div class="jira-card__stat-divider" />
          <div class="jira-card__stat">
            <span class="jira-card__stat-value">{{ jiraIssues.issues.filter(i => i.status === 'Done' || i.status === 'Chiuso' || i.status === 'Resolved').length }}</span>
            <span class="jira-card__stat-label">Chiuse</span>
          </div>
        </div>

        <!-- Loading -->
        <div
          v-if="jiraLoading && !jiraIssues?.issues?.length"
          class="jira-card__loading"
        >
          <div class="jira-card__loading-spinner">
            <UIcon
              name="i-lucide-loader-2"
              class="w-6 h-6 animate-spin"
            />
          </div>
          <p class="jira-card__loading-text">
            Caricamento issue...
          </p>
        </div>

        <!-- Empty State -->
        <div
          v-else-if="!jiraIssues?.issues?.length"
          class="jira-card__empty"
        >
          <div class="jira-card__empty-icon">
            <UIcon
              name="i-lucide-inbox"
              class="w-8 h-8"
            />
          </div>
          <p class="jira-card__empty-title">
            Nessuna issue collegata
          </p>
          <p class="jira-card__empty-description">
            Le issue Jira verranno visualizzate qui dopo l'analisi
          </p>
        </div>

        <!-- Issues List -->
        <div
          v-else
          class="jira-card__list"
        >
          <a
            v-for="(issue, index) in jiraIssues.issues"
            :key="issue.key"
            :href="issue.url"
            target="_blank"
            rel="noopener"
            class="jira-issue animate-slide-in-right"
            :style="{ animationDelay: `${index * 0.04}s` }"
          >
            <div class="jira-issue__header">
              <span class="jira-issue__key">{{ issue.key }}</span>
              <span
                class="jira-issue__status"
                :class="{
                  'jira-issue__status--open': issue.status === 'Aperto' || issue.status === 'Open' || issue.status === 'To Do',
                  'jira-issue__status--progress': issue.status === 'In Progress' || issue.status === 'In Corso',
                  'jira-issue__status--done': issue.status === 'Done' || issue.status === 'Chiuso' || issue.status === 'Resolved'
                }"
              >
                <span class="jira-issue__status-dot" />
                {{ issue.status }}
              </span>
            </div>
            <p class="jira-issue__summary">{{ issue.summary }}</p>
            <!-- Labels -->
            <div
              v-if="issue.labels?.length"
              class="jira-issue__tags"
            >
              <span
                v-for="label in issue.labels.slice(0, 2)"
                :key="label"
                class="jira-issue__tag"
              >
                {{ label }}
              </span>
              <span
                v-if="issue.labels.length > 2"
                class="jira-issue__tag jira-issue__tag--more"
              >
                +{{ issue.labels.length - 2 }}
              </span>
            </div>
            <div class="jira-issue__footer">
              <div class="jira-issue__meta">
                <!-- Priority -->
                <span
                  v-if="issue.priority"
                  class="jira-issue__priority"
                  :class="{
                    'jira-issue__priority--highest': issue.priority === 'Highest',
                    'jira-issue__priority--high': issue.priority === 'High',
                    'jira-issue__priority--medium': issue.priority === 'Medium',
                    'jira-issue__priority--low': issue.priority === 'Low',
                    'jira-issue__priority--lowest': issue.priority === 'Lowest'
                  }"
                >
                  <UIcon
                    name="i-lucide-signal"
                    class="w-3 h-3"
                  />
                  <span>{{ issue.priority }}</span>
                </span>
                <!-- Time -->
                <span class="jira-issue__time">
                  <UIcon
                    name="i-lucide-clock"
                    class="w-3 h-3"
                  />
                  <span>{{ formatDate(issue.updated) }}</span>
                </span>
              </div>
              <div class="jira-issue__action">
                <span>Apri in Jira</span>
                <UIcon
                  name="i-lucide-external-link"
                  class="w-3 h-3"
                />
              </div>
            </div>
          </a>
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
          <pre class="text-xs text-[var(--ui-text-muted)] font-mono whitespace-pre-wrap leading-relaxed">{{
          extractionOutput }}</pre>
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
          <pre class="text-xs text-green-400 font-mono whitespace-pre-wrap leading-relaxed">{{ analysisOutput
          }}</pre>
        </div>
      </div>
    </div>

    <!-- Prompt Selection Drawer -->
    <USlideover
      v-model:open="promptDrawerOpen"
      side="right"
      :ui="{ width: 'sm:max-w-xl' }"
    >
      <template #header>
        <div class="flex items-center gap-4">
          <div class="w-12 h-12 bg-[var(--accent-soft)] flex items-center justify-center shrink-0">
            <UIcon
              name="i-lucide-file-text"
              class="w-6 h-6 text-[var(--accent)]"
            />
          </div>
          <div class="min-w-0 flex-1">
            <h2 class="text-xl font-semibold tracking-tight">
              Seleziona Prompt
            </h2>
            <p class="text-sm text-[var(--ui-text-muted)] truncate mt-0.5">
              Scegli il prompt da usare per l'analisi
            </p>
          </div>
        </div>
      </template>

      <template #body>
        <div class="space-y-4 -mx-4 -my-4 p-4">
          <!-- Empty state -->
          <div
            v-if="!prompts?.length"
            class="text-center py-12"
          >
            <div class="w-16 h-16 mx-auto bg-[var(--ui-bg-muted)] flex items-center justify-center mb-4">
              <UIcon
                name="i-lucide-file-plus"
                class="w-8 h-8 text-[var(--ui-text-muted)]"
              />
            </div>
            <p class="text-[var(--ui-text-muted)] mb-4">
              Nessun prompt configurato
            </p>
            <NuxtLink
              to="/prompts"
              class="inline-flex items-center gap-2 px-4 py-2 bg-[var(--ui-text)] text-[var(--ui-bg)] text-sm font-medium hover:opacity-90 transition-opacity"
            >
              <UIcon
                name="i-lucide-plus"
                class="w-4 h-4"
              />
              Crea Prompt
            </NuxtLink>
          </div>

          <!-- Prompt list -->
          <div
            v-else
            class="space-y-3"
          >
            <button
              v-for="prompt in prompts"
              :key="prompt.id"
              type="button"
              class="w-full text-left p-4 border transition-all duration-200"
              :class="selectedPromptId === prompt.id
                ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
                : 'border-[var(--ui-border)] bg-[var(--ui-bg-muted)] hover:border-[var(--ui-text-muted)]'"
              @click="selectedPromptId = prompt.id"
            >
              <div class="flex items-start gap-3">
                <div
                  class="w-5 h-5 mt-0.5 border-2 flex items-center justify-center shrink-0 transition-colors"
                  :class="selectedPromptId === prompt.id
                    ? 'border-[var(--accent)] bg-[var(--accent)]'
                    : 'border-[var(--ui-border)]'"
                >
                  <UIcon
                    v-if="selectedPromptId === prompt.id"
                    name="i-lucide-check"
                    class="w-3 h-3 text-white"
                  />
                </div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2">
                    <p class="font-medium text-sm">
                      {{ prompt.name }}
                    </p>
                    <span
                      v-if="prompt.isDefault"
                      class="tag tag--info text-xs"
                    >
                      Default
                    </span>
                  </div>
                  <p
                    v-if="prompt.description"
                    class="text-xs text-[var(--ui-text-muted)] mt-1 line-clamp-2"
                  >
                    {{ prompt.description }}
                  </p>
                </div>
              </div>
            </button>

            <!-- Link to manage prompts -->
            <NuxtLink
              to="/prompts"
              class="flex items-center gap-2 p-3 text-sm text-[var(--ui-text-muted)] hover:text-[var(--ui-text)] transition-colors"
            >
              <UIcon
                name="i-lucide-settings"
                class="w-4 h-4"
              />
              Gestisci Prompt
            </NuxtLink>
          </div>
        </div>
      </template>

      <template #footer>
        <div class="flex items-center justify-between gap-4">
          <button
            type="button"
            class="h-11 px-6 bg-[var(--ui-bg-muted)] text-[var(--ui-text)] border border-[var(--ui-border)] font-medium text-sm hover:bg-[var(--ui-bg-accent)] transition-colors"
            @click="promptDrawerOpen = false"
          >
            Annulla
          </button>
          <button
            type="button"
            class="h-11 px-6 bg-[var(--ui-text)] text-[var(--ui-bg)] font-medium text-sm flex items-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
            :disabled="!selectedPromptId && prompts?.length > 0"
            @click="startAnalysis"
          >
            <UIcon
              name="i-lucide-play"
              class="w-4 h-4"
            />
            Avvia Analisi
          </button>
        </div>
      </template>
    </USlideover>
  </div>
</template>
