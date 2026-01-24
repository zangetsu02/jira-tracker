<script setup lang="ts">
import type { MicroserviceWithStatus } from '~~/shared/utils/types'

const { user } = useAuth()
const { getCoverageColor } = useAnalysisStatus()
const { data: microservices, pending, error, refresh } = await useFetch<MicroserviceWithStatus[]>('/api/microservices')

const stats = computed(() => {
  const list = microservices.value ?? []
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

const recentMicroservices = computed(() => {
  return [...(microservices.value ?? [])]
    .filter(m => m.lastAnalysis)
    .sort((a, b) => new Date(b.lastAnalysis!).getTime() - new Date(a.lastAnalysis!).getTime())
    .slice(0, 5)
})

const greeting = computed(() => {
  const hour = new Date().getHours()
  if (hour < 12) return 'Buongiorno'
  if (hour < 18) return 'Buon pomeriggio'
  return 'Buonasera'
})

const userName = computed(() => user.value?.email?.split('@')[0] ?? 'utente')

const getMicroserviceCoverageColor = (ms: MicroserviceWithStatus) => {
  if (!ms.useCaseCount) return 'neutral'
  const percentage = Math.round((ms.implementedCount / ms.useCaseCount) * 100)
  return getCoverageColor(percentage)
}
</script>

<template>
  <div>
    <!-- Header -->
    <div class="mb-8">
      <h1 class="text-3xl font-serif">
        {{ greeting }} <span class="text-[var(--ui-text-muted)]">{{ userName }},</span>
      </h1>
      <p class="text-[var(--ui-text-muted)] mt-1">
        ecco un rapido sguardo a come stanno andando le cose.
      </p>
    </div>

    <!-- Loading -->
    <div
      v-if="pending && !microservices"
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

    <div v-else-if="stats">
      <!-- Stats Row 1 -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <!-- Microservizi -->
        <UCard>
          <template #header>
            <div class="flex items-center gap-2">
              <UIcon
                name="i-lucide-box"
                class="w-4 h-4 text-[var(--ui-text-muted)]"
              />
              <span class="text-sm font-medium">Microservizi</span>
            </div>
          </template>
          <p class="text-sm text-[var(--ui-text-muted)] mb-4">
            Totale microservizi monitorati
          </p>
          <p class="text-3xl font-semibold mb-2">
            {{ stats.total }}
          </p>
          <NuxtLink
            to="/"
            class="text-xs text-[var(--ui-primary)] hover:underline"
          >
            Visualizza tutti
          </NuxtLink>
        </UCard>

        <!-- Analizzati -->
        <UCard>
          <template #header>
            <div class="flex items-center gap-2">
              <UIcon
                name="i-lucide-search-check"
                class="w-4 h-4 text-[var(--ui-text-muted)]"
              />
              <span class="text-sm font-medium">Analizzati</span>
            </div>
          </template>
          <p class="text-sm text-[var(--ui-text-muted)] mb-4">
            Microservizi con analisi completata
          </p>
          <p class="text-3xl font-semibold mb-2">
            {{ stats.analyzed }}
          </p>
          <p class="text-xs text-[var(--ui-text-muted)]">
            su {{ stats.total }} totali
          </p>
        </UCard>

        <!-- Copertura -->
        <UCard>
          <template #header>
            <div class="flex items-center gap-2">
              <UIcon
                name="i-lucide-check-circle"
                class="w-4 h-4 text-[var(--ui-text-muted)]"
              />
              <span class="text-sm font-medium">Copertura UC</span>
            </div>
          </template>
          <p class="text-sm text-[var(--ui-text-muted)] mb-4">
            Use case implementati correttamente
          </p>
          <div class="flex items-baseline gap-3 mb-2">
            <p class="text-3xl font-semibold">
              {{ stats.coverage }}%
            </p>
            <UBadge
              :color="getCoverageColor(stats.coverage)"
              variant="subtle"
              size="sm"
            >
              {{ stats.implementedUseCases }}/{{ stats.totalUseCases }}
            </UBadge>
          </div>
          <UProgress
            :value="stats.coverage"
            :color="getCoverageColor(stats.coverage)"
            size="sm"
            :animation="false"
          />
        </UCard>
      </div>

      <!-- Stats Row 2 -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <!-- Con Issues -->
        <UCard>
          <template #header>
            <div class="flex items-center gap-2">
              <UIcon
                name="i-lucide-alert-triangle"
                class="w-4 h-4 text-[var(--ui-text-muted)]"
              />
              <span class="text-sm font-medium">Con Issues</span>
            </div>
          </template>
          <p class="text-sm text-[var(--ui-text-muted)] mb-4">
            Microservizi con problemi rilevati
          </p>
          <div class="flex items-baseline gap-3 mb-2">
            <p
              class="text-3xl font-semibold"
              :class="stats.withIssues > 0 ? 'text-[var(--ui-error)]' : ''"
            >
              {{ stats.withIssues }}
            </p>
            <UBadge
              v-if="stats.withIssues > 0"
              color="error"
              variant="subtle"
              size="sm"
            >
              da risolvere
            </UBadge>
          </div>
          <UProgress
            v-if="stats.withIssues > 0 && stats.total > 0"
            :value="(stats.withIssues / stats.total) * 100"
            color="error"
            size="sm"
            :animation="false"
          />
        </UCard>

        <!-- Parziali -->
        <UCard>
          <template #header>
            <div class="flex items-center gap-2">
              <UIcon
                name="i-lucide-clock"
                class="w-4 h-4 text-[var(--ui-text-muted)]"
              />
              <span class="text-sm font-medium">Parziali</span>
            </div>
          </template>
          <p class="text-sm text-[var(--ui-text-muted)] mb-4">
            Implementazioni incomplete
          </p>
          <div class="flex items-baseline gap-3 mb-2">
            <p
              class="text-3xl font-semibold"
              :class="stats.partial > 0 ? 'text-[var(--ui-warning)]' : ''"
            >
              {{ stats.partial }}
            </p>
            <UBadge
              v-if="stats.partial > 0"
              color="warning"
              variant="subtle"
              size="sm"
            >
              in lavorazione
            </UBadge>
          </div>
          <UProgress
            v-if="stats.partial > 0 && stats.total > 0"
            :value="(stats.partial / stats.total) * 100"
            color="warning"
            size="sm"
            :animation="false"
          />
        </UCard>

        <!-- Recenti -->
        <UCard>
          <template #header>
            <div class="flex items-center gap-2">
              <UIcon
                name="i-lucide-history"
                class="w-4 h-4 text-[var(--ui-text-muted)]"
              />
              <span class="text-sm font-medium">Analisi Recenti</span>
            </div>
          </template>
          <p class="text-sm text-[var(--ui-text-muted)] mb-4">
            Ultime analisi eseguite
          </p>
          <p class="text-xl font-semibold mb-2 truncate">
            {{ recentMicroservices.length > 0 ? recentMicroservices[0]?.name?.replace('sil-ms-', '')
              : 'Nessuna' }}
          </p>
          <UButton
            v-if="recentMicroservices.length > 0"
            :to="`/microservice/${recentMicroservices[0]?.name}`"
            color="neutral"
            variant="ghost"
            size="xs"
            trailing-icon="i-lucide-arrow-right"
          >
            Visualizza dettagli
          </UButton>
        </UCard>
      </div>

      <!-- Microservices List -->
      <div>
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-xl font-serif">
            Tutti i Microservizi
          </h2>
          <UButton
            icon="i-lucide-refresh-cw"
            color="neutral"
            variant="ghost"
            size="xs"
            :loading="pending"
            @click="refresh()"
          />
        </div>

        <UCard
          v-if="microservices?.length === 0"
          class="text-center py-12"
        >
          <UIcon
            name="i-lucide-folder-open"
            class="w-12 h-12 mx-auto text-[var(--ui-text-muted)] mb-4"
          />
          <p class="text-[var(--ui-text-muted)] mb-2">
            Nessun microservizio trovato
          </p>
          <p class="text-sm text-[var(--ui-text-muted)]">
            Configura la directory in Settings
          </p>
        </UCard>

        <UCard
          v-else
          :ui="{ body: 'p-0' }"
        >
          <div class="divide-y divide-[var(--ui-border)]">
            <div
              v-for="ms in microservices"
              :key="ms.id"
              class="p-4 hover:bg-[var(--ui-bg-elevated)] cursor-pointer transition-colors flex items-center gap-4"
              @click="navigateTo(`/microservice/${ms.name}`)"
            >
              <UAvatar
                icon="i-lucide-box"
                size="md"
                :ui="{ icon: 'text-[var(--ui-text-muted)]' }"
              />

              <div class="flex-1 min-w-0">
                <p class="font-medium truncate">
                  {{ ms.name }}
                </p>
                <p class="text-xs text-[var(--ui-text-muted)] truncate font-mono">
                  {{ ms.path }}
                </p>
              </div>

              <div class="flex items-center gap-4 flex-shrink-0">
                <!-- PDF Status -->
                <UTooltip :text="ms.pdfFilename ? 'PDF caricato' : 'PDF mancante'">
                  <UBadge
                    :color="ms.pdfFilename ? 'success' : 'neutral'"
                    :variant="ms.pdfFilename ? 'soft' : 'subtle'"
                    :icon="ms.pdfFilename ? 'i-lucide-file-check' : 'i-lucide-file-x'"
                    size="sm"
                  />
                </UTooltip>

                <!-- Coverage -->
                <div
                  v-if="ms.hasAnalysis"
                  class="flex items-center gap-2 w-28"
                >
                  <UProgress
                    :value="ms.useCaseCount > 0 ? (ms.implementedCount / ms.useCaseCount) * 100 : 0"
                    :color="getMicroserviceCoverageColor(ms)"
                    size="xs"
                    class="flex-1"
                    :animation="false"
                  />
                  <span class="text-xs text-[var(--ui-text-muted)] w-10 text-right font-mono">
                    {{ ms.implementedCount }}/{{ ms.useCaseCount }}
                  </span>
                </div>
                <div
                  v-else
                  class="w-28 text-xs text-[var(--ui-text-muted)] text-right"
                >
                  -
                </div>

                <UIcon
                  name="i-lucide-chevron-right"
                  class="w-4 h-4 text-[var(--ui-text-muted)]"
                />
              </div>
            </div>
          </div>
        </UCard>
      </div>
    </div>
  </div>
</template>
