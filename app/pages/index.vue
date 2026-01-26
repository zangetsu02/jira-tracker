<script setup lang="ts">
import type { MicroserviceWithStatus } from '~~/shared/utils/types'

const { user } = useAuth()
const { getCoverageColor } = useAnalysisStatus()
const { data: microservices, pending, error, refresh } = await useFetch<MicroserviceWithStatus[]>('/api/microservices')

// Toggle per mostrare microservizi esclusi
const showExcluded = ref(false)

// Lista filtrata dei microservizi
const filteredMicroservices = computed(() => {
  const list = microservices.value ?? []
  if (showExcluded.value) {
    return list
  }
  return list.filter(m => !m.excluded)
})

// Conteggio esclusi
const excludedCount = computed(() => {
  return (microservices.value ?? []).filter(m => m.excluded).length
})

const stats = computed(() => {
  // Stats calcolate solo sui microservizi NON esclusi
  const list = (microservices.value ?? []).filter(m => !m.excluded)
  const totalUseCases = list.reduce((acc, m) => acc + (m.useCaseCount || 0), 0)
  const implementedUseCases = list.reduce((acc, m) => acc + (m.implementedCount || 0), 0)

  return {
    total: list.length,
    analyzed: list.filter(m => m.hasAnalysis).length,
    withIssues: list.filter(m => m.lastAnalysisStatus === 'issues').length,
    partial: list.filter(m => m.lastAnalysisStatus === 'partial').length,
    coverage: totalUseCases > 0 ? Math.round((implementedUseCases / totalUseCases) * 100) : 0,
    totalUseCases,
    implementedUseCases
  }
})

const greeting = computed(() => {
  const hour = new Date().getHours()
  if (hour < 12) return 'Buongiorno'
  if (hour < 18) return 'Buon pomeriggio'
  return 'Buonasera'
})

const userName = computed(() => {
  const email = user.value?.name
  if (!email) return 'utente'
  const name = email.split('@')[0]
  return name.charAt(0).toUpperCase() + name.slice(1)
})

const getMicroserviceCoverageColor = (ms: MicroserviceWithStatus) => {
  if (!ms.useCaseCount) return 'neutral'
  const percentage = Math.round((ms.implementedCount / ms.useCaseCount) * 100)
  return getCoverageColor(percentage)
}

const getMicroserviceCoverage = (ms: MicroserviceWithStatus) => {
  if (!ms.useCaseCount) return 0
  return Math.round((ms.implementedCount / ms.useCaseCount) * 100)
}

const formatDate = (date: string | null) => {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'short'
  })
}

// Toggle esclusione microservizio
const togglingExclusion = ref<string | null>(null)

const toggleExclusion = async (ms: MicroserviceWithStatus, event: Event) => {
  event.stopPropagation()
  togglingExclusion.value = ms.name

  try {
    await $fetch(`/api/microservices/${ms.name}/exclude`, {
      method: 'PATCH',
      body: { excluded: !ms.excluded }
    })
    await refresh()
  } catch (e) {
    console.error('Errore durante esclusione:', e)
  } finally {
    togglingExclusion.value = null
  }
}
</script>

<template>
  <div class="animate-fade-in">
    <!-- Header -->
    <header class="mb-10">
      <div class="flex items-end justify-between gap-8">
        <div>
          <h1 class="text-4xl lg:text-5xl font-display tracking-tight">
            {{ greeting }}, {{ userName }}
          </h1>
          <p class="text-[var(--ui-text-muted)] mt-2 text-lg">
            Panoramica dello stato dei microservizi
          </p>
        </div>
        <UButton
          icon="i-lucide-refresh-cw"
          color="neutral"
          variant="ghost"
          size="lg"
          :loading="pending"
          @click="refresh()"
        >
          Aggiorna
        </UButton>
      </div>
    </header>

    <!-- Loading -->
    <div
      v-if="pending && !microservices"
      class="flex items-center justify-center py-32"
    >
      <div class="flex flex-col items-center gap-4">
        <UIcon
          name="i-lucide-loader-2"
          class="w-8 h-8 animate-spin text-[var(--ui-text-muted)]"
        />
        <span class="text-sm text-[var(--ui-text-muted)]">Caricamento...</span>
      </div>
    </div>

    <!-- Error -->
    <UAlert
      v-else-if="error"
      color="error"
      variant="soft"
      icon="i-lucide-alert-triangle"
      title="Errore di caricamento"
      :description="error.message"
      class="mb-8"
    />

    <div
      v-else-if="stats"
      class="space-y-8"
    >
      <!-- Stats Bento Grid -->
      <div class="bento-grid">
        <!-- Coverage - Large Card -->
        <div class="bento-item bento-item--span-4 p-6 animate-slide-up stagger-1">
          <div class="flex items-start justify-between mb-6">
            <div>
              <p class="text-xs font-semibold uppercase tracking-wider text-[var(--ui-text-muted)] mb-1">
                Copertura Totale
              </p>
              <p class="text-5xl font-display">
                {{ stats.coverage }}<span class="text-2xl text-[var(--ui-text-muted)]">%</span>
              </p>
            </div>
            <div
              class="w-12 h-12 flex items-center justify-center"
              :class="stats.coverage >= 80 ? 'bg-[var(--ui-success-soft)]' : stats.coverage >= 50 ? 'bg-[var(--ui-warning-soft)]' : 'bg-[var(--ui-error-soft)]'"
            >
              <UIcon
                name="i-lucide-pie-chart"
                class="w-6 h-6"
                :class="stats.coverage >= 80 ? 'text-[var(--ui-success)]' : stats.coverage >= 50 ? 'text-[var(--ui-warning)]' : 'text-[var(--ui-error)]'"
              />
            </div>
          </div>
          <div class="space-y-3">
            <div class="h-3 bg-[var(--ui-bg-muted)] overflow-hidden">
              <div
                class="h-full transition-all duration-700 ease-out"
                :class="stats.coverage >= 80 ? 'bg-[var(--ui-success)]' : stats.coverage >= 50 ? 'bg-[var(--ui-warning)]' : 'bg-[var(--ui-error)]'"
                :style="{ width: `${stats.coverage}%` }"
              />
            </div>
            <p class="text-sm text-[var(--ui-text-muted)]">
              <span class="font-mono font-medium text-[var(--ui-text)]">{{ stats.implementedUseCases }}</span>
              di
              <span class="font-mono font-medium text-[var(--ui-text)]">{{ stats.totalUseCases }}</span>
              use case implementati
            </p>
          </div>
        </div>

        <!-- Microservices Count -->
        <div class="bento-item bento-item--span-4 p-6 animate-slide-up stagger-2">
          <div class="flex items-start justify-between mb-4">
            <p class="text-xs font-semibold uppercase tracking-wider text-[var(--ui-text-muted)]">
              Microservizi
            </p>
            <div class="w-10 h-10 bg-[var(--ui-bg-muted)] flex items-center justify-center">
              <UIcon
                name="i-lucide-boxes"
                class="w-5 h-5 text-[var(--ui-text-muted)]"
              />
            </div>
          </div>
          <p class="text-5xl font-display mb-4">
            {{ stats.total }}
          </p>
          <div class="flex items-center gap-4 text-sm">
            <div class="flex items-center gap-2">
              <span class="status-dot status-dot--success" />
              <span class="text-[var(--ui-text-muted)]">{{ stats.analyzed }} analizzati</span>
            </div>
          </div>
        </div>

        <!-- Issues -->
        <div class="bento-item bento-item--span-4 p-6 animate-slide-up stagger-3">
          <div class="flex items-start justify-between mb-4">
            <p class="text-xs font-semibold uppercase tracking-wider text-[var(--ui-text-muted)]">
              Stato Analisi
            </p>
            <div class="w-10 h-10 bg-[var(--ui-bg-muted)] flex items-center justify-center">
              <UIcon
                name="i-lucide-activity"
                class="w-5 h-5 text-[var(--ui-text-muted)]"
              />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <p
                class="text-3xl font-display"
                :class="stats.withIssues > 0 ? 'text-[var(--ui-error)]' : ''"
              >
                {{ stats.withIssues }}
              </p>
              <p class="text-xs text-[var(--ui-text-muted)] mt-1">Con problemi</p>
            </div>
            <div>
              <p
                class="text-3xl font-display"
                :class="stats.partial > 0 ? 'text-[var(--ui-warning)]' : ''"
              >
                {{ stats.partial }}
              </p>
              <p class="text-xs text-[var(--ui-text-muted)] mt-1">Parziali</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Microservices Table -->
      <div class="bento-item bento-item--span-12 animate-slide-up stagger-4">
        <div class="section-header">
          <h2 class="section-header__title">
            Tutti i Microservizi
          </h2>
          <div class="flex items-center gap-4">
            <button
              v-if="excludedCount > 0"
              class="flex items-center gap-2 text-xs text-[var(--ui-text-muted)] hover:text-[var(--ui-text)] transition-colors"
              @click="showExcluded = !showExcluded"
            >
              <UIcon
                :name="showExcluded ? 'i-lucide-eye' : 'i-lucide-eye-off'"
                class="w-4 h-4"
              />
              {{ showExcluded ? 'Nascondi' : 'Mostra' }} esclusi ({{ excludedCount }})
            </button>
            <span class="text-xs font-mono text-[var(--ui-text-dimmed)]">
              {{ stats.total }} attivi
            </span>
          </div>
        </div>

        <!-- Empty State -->
        <div
          v-if="microservices?.length === 0"
          class="empty-state"
        >
          <UIcon
            name="i-lucide-folder-open"
            class="empty-state__icon"
          />
          <p class="empty-state__title">
            Nessun microservizio trovato
          </p>
          <p class="empty-state__description">
            Configura la directory nelle impostazioni
          </p>
          <UButton
            to="/settings"
            color="neutral"
            variant="soft"
            size="sm"
            class="mt-4"
            icon="i-lucide-settings-2"
          >
            Vai alle impostazioni
          </UButton>
        </div>

        <!-- Table -->
        <div
          v-else
          class="divide-y divide-[var(--ui-border)]"
        >
          <!-- Header Row -->
          <div class="grid grid-cols-12 gap-4 px-5 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--ui-text-muted)] bg-[var(--ui-bg-muted)]">
            <div class="col-span-4">Nome</div>
            <div class="col-span-2 text-center">Documento</div>
            <div class="col-span-3 text-center">Copertura</div>
            <div class="col-span-2 text-center">Ultima Analisi</div>
            <div class="col-span-1 text-center">Azioni</div>
          </div>

          <!-- Data Rows -->
          <div
            v-for="(ms, index) in filteredMicroservices"
            :key="ms.id"
            class="data-row data-row--clickable grid grid-cols-12 gap-4 items-center animate-slide-in-right"
            :class="{ 'opacity-50': ms.excluded }"
            :style="{ animationDelay: `${index * 0.03}s` }"
            @click="navigateTo(`/microservice/${ms.name}`)"
          >
            <!-- Name -->
            <div class="col-span-4 flex items-center gap-4 min-w-0">
              <div
                class="w-10 h-10 flex items-center justify-center flex-shrink-0"
                :class="ms.excluded ? 'bg-[var(--ui-bg-elevated)]' : 'bg-[var(--ui-bg-muted)]'"
              >
                <UIcon
                  :name="ms.excluded ? 'i-lucide-eye-off' : 'i-lucide-box'"
                  class="w-5 h-5 text-[var(--ui-text-muted)]"
                />
              </div>
              <div class="min-w-0">
                <div class="flex items-center gap-2">
                  <p class="font-medium truncate">
                    {{ ms.name.replace('sil-ms-', '') }}
                  </p>
                  <span
                    v-if="ms.excluded"
                    class="tag text-[10px]"
                  >
                    Escluso
                  </span>
                </div>
                <p class="text-xs text-[var(--ui-text-dimmed)] font-mono truncate">
                  {{ ms.name }}
                </p>
              </div>
            </div>

            <!-- PDF Status -->
            <div class="col-span-2 flex justify-center">
              <span
                class="tag"
                :class="ms.pdfFilename ? 'tag--success' : ''"
              >
                <UIcon
                  :name="ms.pdfFilename ? 'i-lucide-file-check' : 'i-lucide-file-x'"
                  class="w-3.5 h-3.5"
                />
                {{ ms.pdfFilename ? 'PDF' : 'Mancante' }}
              </span>
            </div>

            <!-- Coverage -->
            <div class="col-span-3">
              <div
                v-if="ms.hasAnalysis && !ms.excluded"
                class="flex items-center gap-3"
              >
                <div class="flex-1 h-2 bg-[var(--ui-bg-muted)] overflow-hidden">
                  <div
                    class="h-full transition-all duration-500"
                    :class="{
                      'bg-[var(--ui-success)]': getMicroserviceCoverage(ms) >= 80,
                      'bg-[var(--ui-warning)]': getMicroserviceCoverage(ms) >= 50 && getMicroserviceCoverage(ms) < 80,
                      'bg-[var(--ui-error)]': getMicroserviceCoverage(ms) < 50
                    }"
                    :style="{ width: `${getMicroserviceCoverage(ms)}%` }"
                  />
                </div>
                <span class="text-sm font-mono w-16 text-right">
                  {{ ms.implementedCount }}/{{ ms.useCaseCount }}
                </span>
              </div>
              <span
                v-else-if="ms.excluded"
                class="text-sm text-[var(--ui-text-dimmed)]"
              >
                -
              </span>
              <span
                v-else
                class="text-sm text-[var(--ui-text-dimmed)]"
              >
                Non analizzato
              </span>
            </div>

            <!-- Last Analysis -->
            <div class="col-span-2 text-center">
              <span class="text-sm font-mono text-[var(--ui-text-muted)]">
                {{ formatDate(ms.lastAnalysis) }}
              </span>
            </div>

            <!-- Actions -->
            <div class="col-span-1 flex justify-center">
              <button
                class="p-2 rounded hover:bg-[var(--ui-bg-muted)] transition-colors"
                :title="ms.excluded ? 'Includi microservizio' : 'Escludi microservizio'"
                :disabled="togglingExclusion === ms.name"
                @click="toggleExclusion(ms, $event)"
              >
                <UIcon
                  v-if="togglingExclusion === ms.name"
                  name="i-lucide-loader-2"
                  class="w-4 h-4 animate-spin text-[var(--ui-text-muted)]"
                />
                <UIcon
                  v-else
                  :name="ms.excluded ? 'i-lucide-eye' : 'i-lucide-eye-off'"
                  class="w-4 h-4 text-[var(--ui-text-muted)] hover:text-[var(--ui-text)]"
                />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
