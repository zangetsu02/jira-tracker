<script setup lang="ts">
import type { AppSettings, JiraConfig } from '~~/shared/utils/types'

const { data: settings, refresh: refreshSettings } = await useFetch<AppSettings>('/api/settings')
const { data: jiraConfig, refresh: refreshJira } = await useFetch<JiraConfig | null>('/api/jira/config')

const settingsForm = ref({
  microservicesDirectory: '',
  microservicesPattern: 'sil-ms-*'
})

const jiraForm = ref({
  url: '',
  username: '',
  password: '',
  defaultProject: ''
})

const savingSettings = ref(false)
const savingJira = ref(false)
const testingJira = ref(false)
const settingsError = ref<string | null>(null)
const settingsSuccess = ref<string | null>(null)
const jiraError = ref<string | null>(null)
const jiraSuccess = ref<string | null>(null)

watch(settings, (val) => {
  if (val) {
    settingsForm.value.microservicesDirectory = val.microservicesDirectory || ''
    settingsForm.value.microservicesPattern = val.microservicesPattern || 'sil-ms-*'
  }
}, { immediate: true })

watch(jiraConfig, (val) => {
  if (val) {
    jiraForm.value.url = val.url || ''
    jiraForm.value.username = val.username || ''
    jiraForm.value.password = ''
    jiraForm.value.defaultProject = val.defaultProject || ''
  }
}, { immediate: true })

const saveSettings = async () => {
  savingSettings.value = true
  settingsError.value = null
  settingsSuccess.value = null

  try {
    await $fetch('/api/settings', {
      method: 'POST',
      body: settingsForm.value
    })
    await refreshSettings()
    settingsSuccess.value = 'Configurazione salvata'
    setTimeout(() => settingsSuccess.value = null, 3000)
  } catch (e) {
    settingsError.value = e instanceof Error ? e.message : 'Errore durante salvataggio'
  } finally {
    savingSettings.value = false
  }
}

const saveJiraConfig = async () => {
  savingJira.value = true
  jiraError.value = null
  jiraSuccess.value = null

  try {
    await $fetch('/api/jira/config', {
      method: 'POST',
      body: jiraForm.value
    })
    await refreshJira()
    jiraSuccess.value = 'Configurazione Jira salvata'
    setTimeout(() => jiraSuccess.value = null, 3000)
  } catch (e: unknown) {
    const err = e as { data?: { message?: string }, message?: string }
    jiraError.value = err.data?.message || err.message || 'Errore durante salvataggio'
  } finally {
    savingJira.value = false
  }
}

const testJiraConnection = async () => {
  testingJira.value = true
  jiraError.value = null
  jiraSuccess.value = null

  try {
    const result = await $fetch<{ user: string }>('/api/jira/test', {
      method: 'POST'
    })
    jiraSuccess.value = `Connessione riuscita: ${result.user}`
  } catch (e: unknown) {
    const err = e as { data?: { message?: string }, message?: string }
    jiraError.value = err.data?.message || err.message || 'Test connessione fallito'
  } finally {
    testingJira.value = false
  }
}
</script>

<template>
  <div class="animate-fade-in">
    <!-- Header -->
    <header class="mb-10">
      <h1 class="text-4xl lg:text-5xl font-display tracking-tight">
        Impostazioni
      </h1>
      <p class="text-[var(--ui-text-muted)] mt-2 text-lg">
        Configura le directory e le integrazioni
      </p>
    </header>

    <!-- Settings Grid -->
    <div class="grid grid-cols-1 xl:grid-cols-2 gap-6">
      <!-- Directory Settings -->
      <div class="bento-item animate-slide-up stagger-1">
        <div class="section-header">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 bg-[var(--ui-bg-muted)] flex items-center justify-center">
              <UIcon
                name="i-lucide-folder-cog"
                class="w-4 h-4 text-[var(--ui-text-muted)]"
              />
            </div>
            <div>
              <h2 class="text-sm font-semibold text-[var(--ui-text)]">
                Directory Microservizi
              </h2>
              <p class="text-xs text-[var(--ui-text-muted)]">
                Percorso ai sorgenti da analizzare
              </p>
            </div>
          </div>
        </div>

        <div class="p-6 space-y-6">
          <!-- Success Alert -->
          <div
            v-if="settingsSuccess"
            class="flex items-center gap-3 p-3 bg-[var(--ui-success-soft)] text-[var(--ui-success)]"
          >
            <UIcon
              name="i-lucide-check-circle"
              class="w-4 h-4"
            />
            <span class="text-sm font-medium">{{ settingsSuccess }}</span>
          </div>

          <!-- Error Alert -->
          <div
            v-if="settingsError"
            class="flex items-center gap-3 p-3 bg-[var(--ui-error-soft)] text-[var(--ui-error)]"
          >
            <UIcon
              name="i-lucide-alert-circle"
              class="w-4 h-4"
            />
            <span class="text-sm font-medium">{{ settingsError }}</span>
            <button
              class="ml-auto"
              @click="settingsError = null"
            >
              <UIcon
                name="i-lucide-x"
                class="w-4 h-4"
              />
            </button>
          </div>

          <!-- Directory Input -->
          <div class="space-y-2">
            <label class="text-xs font-semibold uppercase tracking-wider text-[var(--ui-text-muted)]">
              Percorso Directory
            </label>
            <div class="relative">
              <UIcon
                name="i-lucide-folder"
                class="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--ui-text-muted)]"
              />
              <input
                v-model="settingsForm.microservicesDirectory"
                type="text"
                placeholder="/home/user/microservices"
                class="w-full h-12 pl-11 pr-4 bg-[var(--ui-bg-muted)] border border-[var(--ui-border)] text-sm font-mono placeholder:text-[var(--ui-text-dimmed)] focus:outline-none focus:border-[var(--ui-text)] transition-colors"
              >
            </div>
            <p class="text-xs text-[var(--ui-text-dimmed)]">
              Percorso assoluto alla cartella contenente i microservizi
            </p>
          </div>

          <!-- Pattern Input -->
          <div class="space-y-2">
            <label class="text-xs font-semibold uppercase tracking-wider text-[var(--ui-text-muted)]">
              Pattern di Ricerca
            </label>
            <div class="relative">
              <UIcon
                name="i-lucide-regex"
                class="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--ui-text-muted)]"
              />
              <input
                v-model="settingsForm.microservicesPattern"
                type="text"
                placeholder="sil-ms-*"
                class="w-full h-12 pl-11 pr-4 bg-[var(--ui-bg-muted)] border border-[var(--ui-border)] text-sm font-mono placeholder:text-[var(--ui-text-dimmed)] focus:outline-none focus:border-[var(--ui-text)] transition-colors"
              >
            </div>
            <p class="text-xs text-[var(--ui-text-dimmed)]">
              Usa * come wildcard (es: sil-ms-* trova sil-ms-auth, sil-ms-users, ...)
            </p>
          </div>

          <!-- Save Button -->
          <div class="pt-2">
            <button
              class="h-11 px-6 bg-[var(--ui-text)] text-[var(--ui-bg)] font-medium text-sm flex items-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
              :disabled="savingSettings"
              @click="saveSettings"
            >
              <UIcon
                v-if="savingSettings"
                name="i-lucide-loader-2"
                class="w-4 h-4 animate-spin"
              />
              <UIcon
                v-else
                name="i-lucide-save"
                class="w-4 h-4"
              />
              Salva Configurazione
            </button>
          </div>
        </div>
      </div>

      <!-- Jira Settings -->
      <div class="bento-item animate-slide-up stagger-2">
        <div class="section-header">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 bg-[var(--ui-info-soft)] flex items-center justify-center">
              <UIcon
                name="i-simple-icons-jira"
                class="w-4 h-4 text-[var(--ui-info)]"
              />
            </div>
            <div>
              <h2 class="text-sm font-semibold text-[var(--ui-text)]">
                Integrazione Jira
              </h2>
              <p class="text-xs text-[var(--ui-text-muted)]">
                Credenziali per la creazione automatica di issue
              </p>
            </div>
          </div>
          <span
            v-if="jiraConfig"
            class="tag tag--success"
          >
            <UIcon
              name="i-lucide-check"
              class="w-3 h-3"
            />
            Configurato
          </span>
        </div>

        <div class="p-6 space-y-6">
          <!-- Success Alert -->
          <div
            v-if="jiraSuccess"
            class="flex items-center gap-3 p-3 bg-[var(--ui-success-soft)] text-[var(--ui-success)]"
          >
            <UIcon
              name="i-lucide-check-circle"
              class="w-4 h-4"
            />
            <span class="text-sm font-medium">{{ jiraSuccess }}</span>
          </div>

          <!-- Error Alert -->
          <div
            v-if="jiraError"
            class="flex items-center gap-3 p-3 bg-[var(--ui-error-soft)] text-[var(--ui-error)]"
          >
            <UIcon
              name="i-lucide-alert-circle"
              class="w-4 h-4"
            />
            <span class="text-sm font-medium">{{ jiraError }}</span>
            <button
              class="ml-auto"
              @click="jiraError = null"
            >
              <UIcon
                name="i-lucide-x"
                class="w-4 h-4"
              />
            </button>
          </div>

          <!-- URL Input -->
          <div class="space-y-2">
            <label class="text-xs font-semibold uppercase tracking-wider text-[var(--ui-text-muted)]">
              URL Server Jira
            </label>
            <div class="relative">
              <UIcon
                name="i-lucide-link"
                class="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--ui-text-muted)]"
              />
              <input
                v-model="jiraForm.url"
                type="url"
                placeholder="https://jira.azienda.com"
                class="w-full h-12 pl-11 pr-4 bg-[var(--ui-bg-muted)] border border-[var(--ui-border)] text-sm placeholder:text-[var(--ui-text-dimmed)] focus:outline-none focus:border-[var(--ui-text)] transition-colors"
              >
            </div>
          </div>

          <!-- Credentials Grid -->
          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-2">
              <label class="text-xs font-semibold uppercase tracking-wider text-[var(--ui-text-muted)]">
                Username
              </label>
              <div class="relative">
                <UIcon
                  name="i-lucide-user"
                  class="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--ui-text-muted)]"
                />
                <input
                  v-model="jiraForm.username"
                  type="text"
                  placeholder="mario.rossi"
                  class="w-full h-12 pl-11 pr-4 bg-[var(--ui-bg-muted)] border border-[var(--ui-border)] text-sm placeholder:text-[var(--ui-text-dimmed)] focus:outline-none focus:border-[var(--ui-text)] transition-colors"
                >
              </div>
            </div>

            <div class="space-y-2">
              <label class="text-xs font-semibold uppercase tracking-wider text-[var(--ui-text-muted)]">
                API Token
              </label>
              <div class="relative">
                <UIcon
                  name="i-lucide-key-round"
                  class="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--ui-text-muted)]"
                />
                <input
                  v-model="jiraForm.password"
                  type="password"
                  placeholder="********"
                  class="w-full h-12 pl-11 pr-4 bg-[var(--ui-bg-muted)] border border-[var(--ui-border)] text-sm placeholder:text-[var(--ui-text-dimmed)] focus:outline-none focus:border-[var(--ui-text)] transition-colors"
                >
              </div>
            </div>
          </div>

          <!-- Project Input -->
          <div class="space-y-2">
            <label class="text-xs font-semibold uppercase tracking-wider text-[var(--ui-text-muted)]">
              Progetto Default
            </label>
            <div class="relative">
              <UIcon
                name="i-lucide-folder-kanban"
                class="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--ui-text-muted)]"
              />
              <input
                v-model="jiraForm.defaultProject"
                type="text"
                placeholder="PROJ"
                class="w-full h-12 pl-11 pr-4 bg-[var(--ui-bg-muted)] border border-[var(--ui-border)] text-sm font-mono uppercase placeholder:text-[var(--ui-text-dimmed)] focus:outline-none focus:border-[var(--ui-text)] transition-colors"
              >
            </div>
            <p class="text-xs text-[var(--ui-text-dimmed)]">
              Chiave del progetto Jira dove creare le issue
            </p>
          </div>

          <!-- Action Buttons -->
          <div class="flex items-center gap-3 pt-2">
            <button
              class="h-11 px-6 bg-[var(--ui-text)] text-[var(--ui-bg)] font-medium text-sm flex items-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
              :disabled="savingJira"
              @click="saveJiraConfig"
            >
              <UIcon
                v-if="savingJira"
                name="i-lucide-loader-2"
                class="w-4 h-4 animate-spin"
              />
              <UIcon
                v-else
                name="i-lucide-save"
                class="w-4 h-4"
              />
              Salva
            </button>

            <button
              class="h-11 px-6 bg-[var(--ui-bg-muted)] text-[var(--ui-text)] border border-[var(--ui-border)] font-medium text-sm flex items-center gap-2 hover:bg-[var(--ui-bg-accent)] transition-colors disabled:opacity-50"
              :disabled="testingJira || !jiraConfig"
              @click="testJiraConnection"
            >
              <UIcon
                v-if="testingJira"
                name="i-lucide-loader-2"
                class="w-4 h-4 animate-spin"
              />
              <UIcon
                v-else
                name="i-lucide-plug"
                class="w-4 h-4"
              />
              Test Connessione
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
