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
    ignored: number
  }
}

const showIgnored = ref(false)

const { data, pending, error, refresh } = await useFetch<AnalysisData>(
  () => `/api/analysis/${name.value}${showIgnored.value ? '?includeIgnored=true' : ''}`,
  { watch: [showIgnored] }
)

const selectedResult = ref<(AnalysisResult & { usecase?: UseCase }) | null>(null)
const showJiraModal = ref(false)
const showLinkJiraModal = ref(false)
const linkJiraIssueKey = ref('')
const linkingJiraId = ref<number | null>(null)
const filterStatus = ref<string>('all')
const expandedResultId = ref<number | null>(null)
const deletingId = ref<number | null>(null)
const ignoringId = ref<number | null>(null)
const restoringId = ref<number | null>(null)
const showChatSlideover = ref(false)
const chatResult = ref<(AnalysisResult & { usecase?: UseCase }) | null>(null)
const deduplicating = ref(false)

const openChat = (result: AnalysisResult & { usecase?: UseCase }) => {
  chatResult.value = result
  showChatSlideover.value = true
}

const handleDeduplicate = async () => {
  if (!confirm('Vuoi identificare e rimuovere i duplicati? Le issue già collegate a Jira non verranno toccate.')) {
    return
  }

  deduplicating.value = true
  try {
    const result = await $fetch(`/api/analysis/${name.value}/deduplicate`, {
      method: 'POST'
    })
    if (result.deleted > 0) {
      alert(`${result.message}`)
      await refresh()
    } else {
      alert(result.message || 'Nessun duplicato trovato')
    }
  } catch (e: any) {
    alert(`Errore: ${e.message || 'Errore sconosciuto'}`)
  } finally {
    deduplicating.value = false
  }
}

const filterTabs = computed(() => {
  const tabs = [
    { id: 'all', label: 'Tutti', count: data.value?.summary.total ?? 0, color: 'neutral' as const },
    { id: 'implemented', label: 'Implementati', count: data.value?.summary.implemented ?? 0, color: 'success' as const },
    { id: 'partial', label: 'Parziali', count: data.value?.summary.partial ?? 0, color: 'warning' as const },
    { id: 'missing', label: 'Mancanti', count: data.value?.summary.missing ?? 0, color: 'error' as const },
    { id: 'unclear', label: 'Non chiari', count: data.value?.summary.unclear ?? 0, color: 'neutral' as const }
  ]

  // Mostra tab Ignorati solo se ce ne sono
  const ignoredCount = data.value?.summary.ignored ?? 0
  if (ignoredCount > 0) {
    tabs.push({ id: 'ignored', label: 'Ignorati', count: ignoredCount, color: 'neutral' as const })
  }

  return tabs
})

const filteredResults = computed(() => {
  if (!data.value?.results) return []
  // Per il tab "Ignorati" mostriamo tutti i risultati (già filtrati dall'API)
  if (showIgnored.value) return data.value.results
  if (filterStatus.value === 'all') return data.value.results
  return data.value.results.filter(r => r.status === filterStatus.value)
})

const shortName = computed(() => name.value.replace('sil-ms-', ''))
const microserviceName = computed(() => data.value?.microservice.name || 'Unknown')

const toggleExpand = (id: number) => {
  expandedResultId.value = expandedResultId.value === id ? null : id
}

const openJiraModal = (result: AnalysisResult & { usecase?: UseCase }) => {
  selectedResult.value = result
  showJiraModal.value = true
}

const handleIssueCreated = async (issueKey: string) => {
  await refresh()
  alert(`Issue creata: ${issueKey}`)
}

const openLinkJiraModal = (result: AnalysisResult & { usecase?: UseCase }) => {
  selectedResult.value = result
  linkJiraIssueKey.value = ''
  showLinkJiraModal.value = true
}

const handleLinkJiraIssue = async () => {
  if (!selectedResult.value || !linkJiraIssueKey.value.trim()) return

  linkingJiraId.value = selectedResult.value.id
  try {
    await $fetch(`/api/analysis-result/${selectedResult.value.id}`, {
      method: 'PATCH',
      body: { jiraIssueKey: linkJiraIssueKey.value.trim().toUpperCase() }
    })
    await refresh()
    showLinkJiraModal.value = false
    linkJiraIssueKey.value = ''
  } catch (e: any) {
    alert(`Errore durante il collegamento: ${e.message || 'Errore sconosciuto'}`)
  } finally {
    linkingJiraId.value = null
  }
}

const handleDeleteResult = async (result: AnalysisResult & { usecase?: UseCase }) => {
  const description = result.usecase?.description || result.evidence || result.notes || 'questo risultato'
  if (!confirm(`Sei sicuro di voler eliminare "${description.substring(0, 50)}${description.length > 50 ? '...' : ''}"?`)) {
    return
  }

  deletingId.value = result.id
  try {
    await $fetch(`/api/analysis-result/${result.id}`, {
      method: 'DELETE'
    })
    await refresh()
  } catch (e: any) {
    alert(`Errore durante l'eliminazione: ${e.message || 'Errore sconosciuto'}`)
  } finally {
    deletingId.value = null
  }
}

const handleIgnoreResult = async (result: AnalysisResult & { usecase?: UseCase }) => {
  ignoringId.value = result.id
  try {
    await $fetch(`/api/analysis-result/${result.id}`, {
      method: 'PATCH',
      body: { ignored: true }
    })
    await refresh()
  } catch (e: any) {
    alert(`Errore durante l'operazione: ${e.message || 'Errore sconosciuto'}`)
  } finally {
    ignoringId.value = null
  }
}

const handleRestoreResult = async (result: AnalysisResult & { usecase?: UseCase }) => {
  restoringId.value = result.id
  try {
    await $fetch(`/api/analysis-result/${result.id}`, {
      method: 'PATCH',
      body: { ignored: false }
    })
    await refresh()
  } catch (e: any) {
    alert(`Errore durante l'operazione: ${e.message || 'Errore sconosciuto'}`)
  } finally {
    restoringId.value = null
  }
}

// Gestisce il cambio di tab
const handleTabChange = (tabId: string) => {
  if (tabId === 'ignored') {
    showIgnored.value = true
    filterStatus.value = 'all'
  } else {
    showIgnored.value = false
    filterStatus.value = tabId
  }
}

// Auto-expand highlighted result
onMounted(() => {
  if (highlightId.value) {
    expandedResultId.value = highlightId.value
    nextTick(() => {
      const el = document.getElementById(`result-${highlightId.value}`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    })
  }
})

// Keyboard navigation for filter tabs
const handleTabKeydown = (e: KeyboardEvent, currentIndex: number) => {
  const tabs = filterTabs.value
  let newIndex = currentIndex

  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
    e.preventDefault()
    newIndex = (currentIndex + 1) % tabs.length
  } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
    e.preventDefault()
    newIndex = (currentIndex - 1 + tabs.length) % tabs.length
  } else if (e.key === 'Home') {
    e.preventDefault()
    newIndex = 0
  } else if (e.key === 'End') {
    e.preventDefault()
    newIndex = tabs.length - 1
  }

  if (newIndex !== currentIndex) {
    handleTabChange(tabs[newIndex].id)
    nextTick(() => {
      const tabEl = document.querySelector(`[data-tab-index="${newIndex}"]`) as HTMLElement
      tabEl?.focus()
    })
  }
}

// Determina quale tab è attivo
const activeTabId = computed(() => showIgnored.value ? 'ignored' : filterStatus.value)
</script>

<template>
  <div class="animate-fade-in">
    <!-- Breadcrumb Navigation -->
    <nav
      class="mb-6"
      aria-label="Breadcrumb"
    >
      <ol class="flex items-center gap-2 text-sm">
        <li>
          <NuxtLink
            to="/"
            class="text-[var(--ui-text-muted)] hover:text-[var(--ui-text)] transition-colors"
          >
            Dashboard
          </NuxtLink>
        </li>
        <li
          class="text-[var(--ui-text-dimmed)]"
          aria-hidden="true"
        >
          /
        </li>
        <li>
          <NuxtLink
            :to="`/microservice/${name}`"
            class="text-[var(--ui-text-muted)] hover:text-[var(--ui-text)] transition-colors"
          >
            {{ shortName }}
          </NuxtLink>
        </li>
        <li
          class="text-[var(--ui-text-dimmed)]"
          aria-hidden="true"
        >
          /
        </li>
        <li aria-current="page">
          <span class="text-[var(--ui-text)] font-medium">Analisi</span>
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
                name="i-lucide-bar-chart-3"
                class="w-7 h-7 text-[var(--ui-text-muted)]"
              />
            </div>
            <div>
              <h1 class="text-4xl lg:text-5xl font-display tracking-tight">
                Analisi Dettagliata
              </h1>
              <p
                v-if="data?.microservice.lastAnalysis"
                class="text-sm text-[var(--ui-text-muted)] mt-1"
              >
                Ultima analisi: {{ new Date(data.microservice.lastAnalysis).toLocaleString('it-IT') }}
              </p>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <UButton
            icon="i-lucide-copy-x"
            color="warning"
            variant="soft"
            size="lg"
            :loading="deduplicating"
            :disabled="deduplicating || pending"
            aria-label="Rimuovi duplicati"
            @click="handleDeduplicate"
          >
            Rimuovi Duplicati
          </UButton>
          <UButton
            icon="i-lucide-refresh-cw"
            color="neutral"
            variant="ghost"
            size="lg"
            :loading="pending"
            aria-label="Aggiorna analisi"
            @click="refresh()"
          />
          <NuxtLink
            :to="`/microservice/${name}`"
            class="h-12 px-6 bg-[var(--ui-bg-muted)] text-[var(--ui-text)] border border-[var(--ui-border)] font-medium text-sm flex items-center gap-2 hover:bg-[var(--ui-bg-accent)] transition-colors"
          >
            <UIcon
              name="i-lucide-arrow-left"
              class="w-4 h-4"
            />
            Indietro
          </NuxtLink>
        </div>
      </div>
    </header>

    <!-- Loading State -->
    <div
      v-if="pending && !data"
      class="space-y-6"
    >
      <!-- Skeleton for stats -->
      <div class="bento-grid">
        <div
          v-for="i in 4"
          :key="i"
          class="bento-item bento-item--span-3 p-6"
        >
          <div class="animate-pulse">
            <div class="h-3 w-20 bg-[var(--ui-bg-muted)] mb-4" />
            <div class="h-12 w-16 bg-[var(--ui-bg-muted)] mb-2" />
            <div class="h-2 w-full bg-[var(--ui-bg-muted)]" />
          </div>
        </div>
      </div>
      <!-- Skeleton for list -->
      <div class="bento-item bento-item--span-12">
        <div class="section-header">
          <div class="h-4 w-32 bg-[var(--ui-bg-muted)] animate-pulse" />
        </div>
        <div
          v-for="i in 3"
          :key="i"
          class="data-row"
        >
          <div class="animate-pulse flex items-center gap-4 w-full">
            <div class="w-8 h-8 bg-[var(--ui-bg-muted)]" />
            <div class="flex-1">
              <div class="h-4 w-48 bg-[var(--ui-bg-muted)] mb-2" />
              <div class="h-3 w-32 bg-[var(--ui-bg-muted)]" />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Error State -->
    <UAlert
      v-else-if="error"
      color="error"
      variant="soft"
      icon="i-lucide-alert-triangle"
      title="Errore di caricamento"
      :description="error.message"
      class="mb-8"
    >
      <template #actions>
        <UButton
          color="error"
          variant="soft"
          size="sm"
          @click="refresh()"
        >
          Riprova
        </UButton>
      </template>
    </UAlert>

    <!-- Content -->
    <div
      v-else-if="data"
      class="space-y-6"
    >
      <!-- Stats Grid -->
      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <!-- Total -->
        <div class="bento-item p-6 animate-slide-up stagger-1">
          <div class="flex items-start justify-between mb-4">
            <p class="text-xs font-semibold uppercase tracking-wider text-[var(--ui-text-muted)]">
              Totale
            </p>
            <div class="w-10 h-10 bg-[var(--ui-bg-muted)] flex items-center justify-center">
              <UIcon
                name="i-lucide-list"
                class="w-5 h-5 text-[var(--ui-text-muted)]"
              />
            </div>
          </div>
          <p class="text-4xl lg:text-5xl font-display">
            {{ data.summary.total }}
          </p>
          <p class="text-xs text-[var(--ui-text-muted)] mt-2">
            use case analizzati
          </p>
        </div>

        <!-- Implemented -->
        <div class="bento-item p-6 animate-slide-up stagger-2">
          <div class="flex items-start justify-between mb-4">
            <p class="text-xs font-semibold uppercase tracking-wider text-[var(--ui-text-muted)]">
              Implementati
            </p>
            <div class="w-10 h-10 bg-[var(--ui-success-soft)] flex items-center justify-center">
              <UIcon
                name="i-lucide-check-circle"
                class="w-5 h-5 text-[var(--ui-success)]"
              />
            </div>
          </div>
          <p class="text-4xl lg:text-5xl font-display text-[var(--ui-success)]">
            {{ data.summary.implemented }}
          </p>
          <div class="mt-3 h-2 bg-[var(--ui-bg-muted)] overflow-hidden">
            <div
              class="h-full bg-[var(--ui-success)] transition-all duration-500"
              :style="{ width: `${data.summary.total ? (data.summary.implemented / data.summary.total) * 100 : 0}%` }"
            />
          </div>
        </div>

        <!-- Partial -->
        <div class="bento-item p-6 animate-slide-up stagger-3">
          <div class="flex items-start justify-between mb-4">
            <p class="text-xs font-semibold uppercase tracking-wider text-[var(--ui-text-muted)]">
              Parziali
            </p>
            <div class="w-10 h-10 bg-[var(--ui-warning-soft)] flex items-center justify-center">
              <UIcon
                name="i-lucide-alert-circle"
                class="w-5 h-5 text-[var(--ui-warning)]"
              />
            </div>
          </div>
          <p class="text-4xl lg:text-5xl font-display text-[var(--ui-warning)]">
            {{ data.summary.partial }}
          </p>
          <div class="mt-3 h-2 bg-[var(--ui-bg-muted)] overflow-hidden">
            <div
              class="h-full bg-[var(--ui-warning)] transition-all duration-500"
              :style="{ width: `${data.summary.total ? (data.summary.partial / data.summary.total) * 100 : 0}%` }"
            />
          </div>
        </div>

        <!-- Missing -->
        <div class="bento-item p-6 animate-slide-up stagger-4">
          <div class="flex items-start justify-between mb-4">
            <p class="text-xs font-semibold uppercase tracking-wider text-[var(--ui-text-muted)]">
              Mancanti
            </p>
            <div class="w-10 h-10 bg-[var(--ui-error-soft)] flex items-center justify-center">
              <UIcon
                name="i-lucide-x-circle"
                class="w-5 h-5 text-[var(--ui-error)]"
              />
            </div>
          </div>
          <p class="text-4xl lg:text-5xl font-display text-[var(--ui-error)]">
            {{ data.summary.missing }}
          </p>
          <div class="mt-3 h-2 bg-[var(--ui-bg-muted)] overflow-hidden">
            <div
              class="h-full bg-[var(--ui-error)] transition-all duration-500"
              :style="{ width: `${data.summary.total ? (data.summary.missing / data.summary.total) * 100 : 0}%` }"
            />
          </div>
        </div>

        <!-- Unclear -->
        <div class="bento-item p-6 animate-slide-up stagger-5">
          <div class="flex items-start justify-between mb-4">
            <p class="text-xs font-semibold uppercase tracking-wider text-[var(--ui-text-muted)]">
              Non Chiari
            </p>
            <div class="w-10 h-10 bg-[var(--ui-bg-muted)] flex items-center justify-center">
              <UIcon
                name="i-lucide-help-circle"
                class="w-5 h-5 text-[var(--ui-text-muted)]"
              />
            </div>
          </div>
          <p class="text-4xl lg:text-5xl font-display text-[var(--ui-text-muted)]">
            {{ data.summary.unclear }}
          </p>
          <div class="mt-3 h-2 bg-[var(--ui-bg-muted)] overflow-hidden">
            <div
              class="h-full bg-[var(--ui-text-dimmed)] transition-all duration-500"
              :style="{ width: `${data.summary.total ? (data.summary.unclear / data.summary.total) * 100 : 0}%` }"
            />
          </div>
        </div>
      </div>

      <!-- Results Section -->
      <div class="bento-item bento-item--span-12 animate-slide-up stagger-6">
        <!-- Section Header with Filter Tabs -->
        <div class="section-header flex-col sm:flex-row gap-4">
          <h2 class="section-header__title">
            Risultati Analisi
          </h2>

          <!-- Filter Tabs - Accessible -->
          <div
            role="tablist"
            aria-label="Filtra per stato"
            class="flex flex-wrap gap-1"
          >
            <button
              v-for="(tab, index) in filterTabs"
              :key="tab.id"
              role="tab"
              :aria-selected="activeTabId === tab.id"
              :aria-controls="`results-panel-${tab.id}`"
              :tabindex="activeTabId === tab.id ? 0 : -1"
              :data-tab-index="index"
              class="px-3 py-1.5 text-xs font-medium transition-all duration-200 flex items-center gap-2"
              :class="activeTabId === tab.id
                ? 'bg-[var(--ui-text)] text-[var(--ui-bg)]'
                : 'bg-[var(--ui-bg-muted)] text-[var(--ui-text-muted)] hover:bg-[var(--ui-bg-accent)] hover:text-[var(--ui-text)]'"
              @click="handleTabChange(tab.id)"
              @keydown="handleTabKeydown($event, index)"
            >
              {{ tab.label }}
              <span
                class="px-1.5 py-0.5 text-[10px] font-mono"
                :class="activeTabId === tab.id
                  ? 'bg-[var(--ui-bg)] text-[var(--ui-text)]'
                  : 'bg-[var(--ui-bg-accent)] text-[var(--ui-text-dimmed)]'"
              >
                {{ tab.count }}
              </span>
            </button>
          </div>
        </div>

        <!-- Empty State -->
        <div
          v-if="filteredResults.length === 0"
          :id="`results-panel-${filterStatus}`"
          role="tabpanel"
          class="empty-state"
        >
          <UIcon
            name="i-lucide-inbox"
            class="empty-state__icon"
          />
          <p class="empty-state__title">
            Nessun risultato
          </p>
          <p class="empty-state__description">
            {{ showIgnored ? 'Nessun avviso ignorato' : (filterStatus === 'all' ? 'Nessuna analisi disponibile per questo microservizio' : `Nessun use case con stato "${filterTabs.find(t => t.id === filterStatus)?.label}"`) }}
          </p>
          <UButton
            v-if="!showIgnored && filterStatus !== 'all'"
            color="neutral"
            variant="soft"
            size="sm"
            class="mt-4"
            @click="handleTabChange('all')"
          >
            Mostra tutti
          </UButton>
        </div>

        <!-- Results List -->
        <div
          v-else
          :id="`results-panel-${filterStatus}`"
          role="tabpanel"
          class="divide-y divide-[var(--ui-border)]"
        >
          <article
            v-for="(result, index) in filteredResults"
            :id="`result-${result.id}`"
            :key="result.id"
            class="animate-slide-in-right"
            :class="highlightId === result.id ? 'bg-[var(--accent-soft)]' : ''"
            :style="{ animationDelay: `${index * 0.03}s` }"
          >
            <!-- Result Header - Always Visible -->
            <button
              type="button"
              class="w-full data-row data-row--clickable text-left"
              :aria-expanded="expandedResultId === result.id"
              :aria-controls="`result-details-${result.id}`"
              @click="toggleExpand(result.id)"
            >
              <!-- Status Indicator -->
              <span
                class="status-dot shrink-0"
                :class="{
                  'status-dot--success': result.status === 'implemented',
                  'status-dot--warning': result.status === 'partial',
                  'status-dot--error': result.status === 'missing',
                  'status-dot--muted': result.status === 'unclear'
                }"
                :aria-label="`Stato: ${getStatusLabel(result.status)}`"
              />

              <!-- Main Info -->
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <p class="text-sm font-medium truncate">
                    {{ result.usecase?.description || result.evidence || result.notes }}
                  </p>
                  <span
                    class="tag text-[10px] shrink-0"
                    :class="{
                      'tag--success': result.status === 'implemented',
                      'tag--warning': result.status === 'partial',
                      'tag--error': result.status === 'missing'
                    }"
                  >
                    {{ getStatusLabel(result.status) }}
                  </span>
                  <span
                    v-if="result.confidence"
                    class="tag text-[10px] shrink-0"
                    :class="{
                      'tag--success': result.confidence === 'high',
                      'tag--warning': result.confidence === 'medium',
                      'tag--error': result.confidence === 'low'
                    }"
                  >
                    {{ result.confidence }}
                  </span>
                  <span
                    v-if="result.ignored"
                    class="tag text-[10px] shrink-0 bg-[var(--ui-bg-muted)] text-[var(--ui-text-dimmed)]"
                  >
                    Ignorato
                  </span>
                </div>
              </div>

              <!-- Actions -->
              <div class="flex items-center gap-2 shrink-0">
                <span
                  v-if="result.jiraIssueKey"
                  class="tag tag--info font-mono text-xs"
                >
                  {{ result.jiraIssueKey }}
                </span>
                <UIcon
                  name="i-lucide-chevron-down"
                  class="w-5 h-5 text-[var(--ui-text-dimmed)] transition-transform duration-200"
                  :class="expandedResultId === result.id ? 'rotate-180' : ''"
                />
              </div>
            </button>

            <!-- Expanded Details -->
            <Transition
              enter-active-class="transition-all duration-300 ease-out"
              leave-active-class="transition-all duration-200 ease-in"
              enter-from-class="opacity-0 max-h-0"
              enter-to-class="opacity-100 max-h-[1000px]"
              leave-from-class="opacity-100 max-h-[1000px]"
              leave-to-class="opacity-0 max-h-0"
            >
              <div
                v-if="expandedResultId === result.id"
                :id="`result-details-${result.id}`"
                class="overflow-hidden"
              >
                <div class="px-5 pb-5 pt-2 bg-[var(--ui-bg-muted)] border-t border-[var(--ui-border)]">
                  <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <!-- Left Column -->
                    <div class="space-y-4">
                      <div v-if="result.usecase?.description">
                        <h4 class="text-xs font-semibold uppercase tracking-wider text-[var(--ui-text-muted)] mb-2">
                          Descrizione
                        </h4>
                        <p class="text-sm whitespace-pre-wrap leading-relaxed">
                          {{ result.usecase.description }}
                        </p>
                      </div>

                      <div v-if="result.usecase?.actors">
                        <h4 class="text-xs font-semibold uppercase tracking-wider text-[var(--ui-text-muted)] mb-2">
                          Attori
                        </h4>
                        <p class="text-sm">
                          {{ result.usecase.actors }}
                        </p>
                      </div>

                      <div v-if="result.usecase?.preconditions">
                        <h4 class="text-xs font-semibold uppercase tracking-wider text-[var(--ui-text-muted)] mb-2">
                          Precondizioni
                        </h4>
                        <p class="text-sm whitespace-pre-wrap leading-relaxed">
                          {{ result.usecase.preconditions }}
                        </p>
                      </div>
                    </div>

                    <!-- Right Column -->
                    <div class="space-y-4">
                      <div v-if="result.usecase?.mainFlow">
                        <h4 class="text-xs font-semibold uppercase tracking-wider text-[var(--ui-text-muted)] mb-2">
                          Flusso Principale
                        </h4>
                        <p class="text-sm whitespace-pre-wrap leading-relaxed">
                          {{ result.usecase.mainFlow }}
                        </p>
                      </div>

                      <div v-if="result.usecase?.alternativeFlows">
                        <h4 class="text-xs font-semibold uppercase tracking-wider text-[var(--ui-text-muted)] mb-2">
                          Flussi Alternativi
                        </h4>
                        <p class="text-sm whitespace-pre-wrap leading-relaxed">
                          {{ result.usecase.alternativeFlows }}
                        </p>
                      </div>
                    </div>
                  </div>

                  <!-- Evidence and Notes -->
                  <div
                    v-if="result.evidence || result.notes"
                    class="mt-6 pt-4 border-t border-[var(--ui-border)] space-y-4"
                  >
                    <div v-if="result.evidence">
                      <h4 class="text-xs font-semibold uppercase tracking-wider text-[var(--ui-text-muted)] mb-2">
                        Evidenze nel Codice
                      </h4>
                      <pre class="text-sm bg-[var(--ui-bg-elevated)] p-4 overflow-x-auto whitespace-pre-wrap font-mono text-xs leading-relaxed border border-[var(--ui-border)]">{{ result.evidence }}</pre>
                    </div>

                    <div v-if="result.notes">
                      <h4 class="text-xs font-semibold uppercase tracking-wider text-[var(--ui-text-muted)] mb-2">
                        Note
                      </h4>
                      <p class="text-sm bg-[var(--ui-bg-elevated)] p-4 whitespace-pre-wrap leading-relaxed border border-[var(--ui-border)]">
                        {{ result.notes }}
                      </p>
                    </div>
                  </div>

                  <!-- Action Buttons -->
                  <div class="mt-6 pt-4 border-t border-[var(--ui-border)] flex justify-between items-center gap-2">
                    <div class="flex items-center gap-2">
                      <button
                        type="button"
                        class="h-10 px-5 bg-[var(--ui-error)] text-white font-medium text-sm flex items-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
                        :disabled="deletingId === result.id"
                        @click.stop="handleDeleteResult(result)"
                      >
                        <UIcon
                          v-if="deletingId !== result.id"
                          name="i-lucide-trash-2"
                          class="w-4 h-4"
                        />
                        <UIcon
                          v-else
                          name="i-lucide-loader-2"
                          class="w-4 h-4 animate-spin"
                        />
                        Elimina
                      </button>
                      <!-- Bottone Ignora per risultati attivi -->
                      <button
                        v-if="!result.ignored"
                        type="button"
                        class="h-10 px-5 bg-[var(--ui-bg-muted)] text-[var(--ui-text)] border border-[var(--ui-border)] font-medium text-sm flex items-center gap-2 hover:bg-[var(--ui-bg-accent)] transition-colors disabled:opacity-50"
                        :disabled="ignoringId === result.id"
                        @click.stop="handleIgnoreResult(result)"
                      >
                        <UIcon
                          v-if="ignoringId !== result.id"
                          name="i-lucide-eye-off"
                          class="w-4 h-4"
                        />
                        <UIcon
                          v-else
                          name="i-lucide-loader-2"
                          class="w-4 h-4 animate-spin"
                        />
                        Ignora
                      </button>
                      <!-- Bottone Ripristina per risultati ignorati -->
                      <button
                        v-if="result.ignored"
                        type="button"
                        class="h-10 px-5 bg-[var(--ui-success)] text-white font-medium text-sm flex items-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
                        :disabled="restoringId === result.id"
                        @click.stop="handleRestoreResult(result)"
                      >
                        <UIcon
                          v-if="restoringId !== result.id"
                          name="i-lucide-eye"
                          class="w-4 h-4"
                        />
                        <UIcon
                          v-else
                          name="i-lucide-loader-2"
                          class="w-4 h-4 animate-spin"
                        />
                        Ripristina
                      </button>
                    </div>
                    <div class="flex items-center gap-2">
                      <UButton
                        color="neutral"
                        variant="solid"
                        size="lg"
                        class="font-medium"
                        @click.stop="openChat(result)"
                      >
                        <UIcon
                          name="i-lucide-message-circle"
                          class="w-4 h-4"
                        />
                        Chiedi a Claude
                      </UButton>
                      <button
                        v-if="!result.jiraIssueKey && result.status !== 'implemented'"
                        type="button"
                        class="h-10 px-5 bg-[var(--ui-bg)] text-[var(--ui-text)] border border-[var(--ui-border-accented)] font-medium text-sm flex items-center gap-2 hover:bg-[var(--ui-bg-accented)] transition-colors"
                        @click.stop="openLinkJiraModal(result)"
                      >
                        <UIcon
                          name="i-lucide-link"
                          class="w-4 h-4"
                        />
                        Collega Issue
                      </button>
                      <button
                        v-if="!result.jiraIssueKey && result.status !== 'implemented' && !result.ignored"
                        type="button"
                        class="h-10 px-5 bg-[var(--ui-info)] text-white font-medium text-sm flex items-center gap-2 hover:opacity-90 transition-opacity"
                        @click.stop="openJiraModal(result)"
                      >
                        <UIcon
                          name="i-simple-icons-jira"
                          class="w-4 h-4"
                        />
                        Crea Issue Jira
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </Transition>
          </article>
        </div>
      </div>
    </div>

    <!-- Jira Issue Modal -->
    <JiraIssueModal
      v-model:open="showJiraModal"
      :result="selectedResult"
      :microservice-name="microserviceName"
      @created="handleIssueCreated"
    />

    <!-- Claude Chat Slideover -->
    <ClaudeChatSlideover
      v-model:open="showChatSlideover"
      :result="chatResult"
      :microservice-name="microserviceName"
    />

    <!-- Link Jira Issue Modal -->
    <UModal v-model:open="showLinkJiraModal">
      <template #content>
        <div class="p-6">
          <div class="flex items-center gap-3 mb-6">
            <div class="w-10 h-10 bg-[var(--ui-info-soft)] flex items-center justify-center">
              <UIcon
                name="i-lucide-link"
                class="w-5 h-5 text-[var(--ui-info)]"
              />
            </div>
            <div>
              <h3 class="text-lg font-semibold">
                Collega Issue Jira
              </h3>
              <p class="text-sm text-[var(--ui-text-muted)]">
                Inserisci il codice di un'issue Jira esistente
              </p>
            </div>
          </div>

          <form
            class="space-y-4"
            @submit.prevent="handleLinkJiraIssue"
          >
            <UFormField label="Codice Issue">
              <UInput
                v-model="linkJiraIssueKey"
                placeholder="es. PROJ-123"
                size="lg"
                autofocus
                :disabled="linkingJiraId !== null"
              />
            </UFormField>

            <div class="flex justify-end gap-3 pt-4">
              <UButton
                color="neutral"
                variant="ghost"
                :disabled="linkingJiraId !== null"
                @click="showLinkJiraModal = false"
              >
                Annulla
              </UButton>
              <UButton
                type="submit"
                color="info"
                :loading="linkingJiraId !== null"
                :disabled="!linkJiraIssueKey.trim()"
              >
                Collega
              </UButton>
            </div>
          </form>
        </div>
      </template>
    </UModal>
  </div>
</template>
