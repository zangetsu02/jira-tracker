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

const { data, pending, error, refresh } = await useFetch<AnalysisData>(
  () => `/api/analysis/${name.value}`
)

const selectedResult = ref<(AnalysisResult & { usecase?: UseCase }) | null>(null)
const showJiraModal = ref(false)
const filterStatus = ref<string>('all')
const expandedResultId = ref<number | null>(null)

const filterTabs = computed(() => [
  { id: 'all', label: 'Tutti', count: data.value?.summary.total ?? 0, color: 'neutral' as const },
  { id: 'implemented', label: 'Implementati', count: data.value?.summary.implemented ?? 0, color: 'success' as const },
  { id: 'partial', label: 'Parziali', count: data.value?.summary.partial ?? 0, color: 'warning' as const },
  { id: 'missing', label: 'Mancanti', count: data.value?.summary.missing ?? 0, color: 'error' as const },
  { id: 'unclear', label: 'Non chiari', count: data.value?.summary.unclear ?? 0, color: 'neutral' as const }
])

const filteredResults = computed(() => {
  if (!data.value?.results) return []
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
    filterStatus.value = tabs[newIndex].id
    nextTick(() => {
      const tabEl = document.querySelector(`[data-tab-index="${newIndex}"]`) as HTMLElement
      tabEl?.focus()
    })
  }
}
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
      <!-- Stats Bento Grid -->
      <div class="bento-grid">
        <!-- Total -->
        <div class="bento-item bento-item--span-3 p-6 animate-slide-up stagger-1">
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
          <p class="text-5xl font-display">
            {{ data.summary.total }}
          </p>
          <p class="text-xs text-[var(--ui-text-muted)] mt-2">
            use case analizzati
          </p>
        </div>

        <!-- Implemented -->
        <div class="bento-item bento-item--span-3 p-6 animate-slide-up stagger-2">
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
          <p class="text-5xl font-display text-[var(--ui-success)]">
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
        <div class="bento-item bento-item--span-3 p-6 animate-slide-up stagger-3">
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
          <p class="text-5xl font-display text-[var(--ui-warning)]">
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
        <div class="bento-item bento-item--span-3 p-6 animate-slide-up stagger-4">
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
          <p class="text-5xl font-display text-[var(--ui-error)]">
            {{ data.summary.missing }}
          </p>
          <div class="mt-3 h-2 bg-[var(--ui-bg-muted)] overflow-hidden">
            <div
              class="h-full bg-[var(--ui-error)] transition-all duration-500"
              :style="{ width: `${data.summary.total ? (data.summary.missing / data.summary.total) * 100 : 0}%` }"
            />
          </div>
        </div>
      </div>

      <!-- Results Section -->
      <div class="bento-item bento-item--span-12 animate-slide-up stagger-5">
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
              :aria-selected="filterStatus === tab.id"
              :aria-controls="`results-panel-${tab.id}`"
              :tabindex="filterStatus === tab.id ? 0 : -1"
              :data-tab-index="index"
              class="px-3 py-1.5 text-xs font-medium transition-all duration-200 flex items-center gap-2"
              :class="filterStatus === tab.id
                ? 'bg-[var(--ui-text)] text-[var(--ui-bg)]'
                : 'bg-[var(--ui-bg-muted)] text-[var(--ui-text-muted)] hover:bg-[var(--ui-bg-accent)] hover:text-[var(--ui-text)]'"
              @click="filterStatus = tab.id"
              @keydown="handleTabKeydown($event, index)"
            >
              {{ tab.label }}
              <span
                class="px-1.5 py-0.5 text-[10px] font-mono"
                :class="filterStatus === tab.id
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
          role="tabpanel"
          :id="`results-panel-${filterStatus}`"
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
            {{ filterStatus === 'all' ? 'Nessuna analisi disponibile per questo microservizio' : `Nessun use case con stato "${filterTabs.find(t => t.id === filterStatus)?.label}"` }}
          </p>
          <UButton
            v-if="filterStatus !== 'all'"
            color="neutral"
            variant="soft"
            size="sm"
            class="mt-4"
            @click="filterStatus = 'all'"
          >
            Mostra tutti
          </UButton>
        </div>

        <!-- Results List -->
        <div
          v-else
          role="tabpanel"
          :id="`results-panel-${filterStatus}`"
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
                <div class="flex items-center gap-2 mb-1">
                  <span class="font-mono text-xs text-[var(--ui-info)]">
                    {{ result.usecase?.code }}
                  </span>
                  <span
                    class="tag text-[10px]"
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
                    class="tag text-[10px]"
                    :class="{
                      'tag--success': result.confidence === 'high',
                      'tag--warning': result.confidence === 'medium',
                      'tag--error': result.confidence === 'low'
                    }"
                  >
                    {{ result.confidence }}
                  </span>
                </div>
                <p class="text-sm font-medium truncate">
                  {{ result.usecase?.title }}
                </p>
                <p
                  v-if="result.usecase?.description && expandedResultId !== result.id"
                  class="text-xs text-[var(--ui-text-muted)] mt-1 line-clamp-1"
                >
                  {{ result.usecase.description }}
                </p>
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

                  <!-- Action Button -->
                  <div
                    v-if="!result.jiraIssueKey && result.status !== 'implemented'"
                    class="mt-6 pt-4 border-t border-[var(--ui-border)] flex justify-end"
                  >
                    <button
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
  </div>
</template>
