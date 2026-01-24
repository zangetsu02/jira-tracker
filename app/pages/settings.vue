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

  try {
    await $fetch('/api/settings', {
      method: 'POST',
      body: settingsForm.value
    })
    await refreshSettings()
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
    jiraSuccess.value = `Connessione riuscita! Utente: ${result.user}`
  } catch (e: unknown) {
    const err = e as { data?: { message?: string }, message?: string }
    jiraError.value = err.data?.message || err.message || 'Test connessione fallito'
  } finally {
    testingJira.value = false
  }
}
</script>

<template>
  <div>
    <!-- Header -->
    <div class="mb-8">
      <h1 class="text-3xl font-serif">
        Impostazioni
      </h1>
      <p class="text-[var(--ui-text-muted)] mt-1">
        Configura le directory dei microservizi e l'integrazione con Jira
      </p>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Directory Settings -->
      <UCard>
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon
              name="i-lucide-folder"
              class="w-4 h-4 text-[var(--ui-text-muted)]"
            />
            <span class="text-sm font-medium">Directory Microservizi</span>
          </div>
        </template>

        <UAlert
          v-if="settingsError"
          color="error"
          variant="soft"
          icon="i-lucide-alert-triangle"
          :description="settingsError"
          class="mb-4"
          :close-button="{ icon: 'i-lucide-x', color: 'error', variant: 'link' }"
          @close="settingsError = null"
        />

        <p class="text-sm text-[var(--ui-text-muted)] mb-4">
          Percorso alla directory contenente i microservizi da analizzare
        </p>

        <div class="space-y-4">
          <UFormField label="Percorso Directory">
            <UInput
              v-model="settingsForm.microservicesDirectory"
              placeholder="/path/to/microservices"
              icon="i-lucide-folder"
            />
          </UFormField>

          <UFormField
            label="Pattern"
            hint="Usa * come wildcard"
          >
            <UInput
              v-model="settingsForm.microservicesPattern"
              placeholder="sil-ms-*"
              icon="i-lucide-regex"
            />
          </UFormField>
        </div>

        <template #footer>
          <UButton
            icon="i-lucide-save"
            color="primary"
            :loading="savingSettings"
            @click="saveSettings"
          >
            Salva
          </UButton>
        </template>
      </UCard>

      <!-- Jira Settings -->
      <UCard>
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon
              name="i-simple-icons-jira"
              class="w-4 h-4 text-blue-500"
            />
            <span class="text-sm font-medium">Integrazione Jira</span>
          </div>
        </template>

        <UAlert
          v-if="jiraError"
          color="error"
          variant="soft"
          icon="i-lucide-alert-triangle"
          :description="jiraError"
          class="mb-4"
          :close-button="{ icon: 'i-lucide-x', color: 'error', variant: 'link' }"
          @close="jiraError = null"
        />

        <UAlert
          v-if="jiraSuccess"
          color="success"
          variant="soft"
          icon="i-lucide-check-circle"
          :description="jiraSuccess"
          class="mb-4"
          :close-button="{ icon: 'i-lucide-x', color: 'success', variant: 'link' }"
          @close="jiraSuccess = null"
        />

        <p class="text-sm text-[var(--ui-text-muted)] mb-4">
          Configura l'accesso al tuo server Jira per creare issue automaticamente
        </p>

        <div class="space-y-4">
          <UFormField label="URL Jira">
            <UInput
              v-model="jiraForm.url"
              placeholder="https://jira.example.com"
              icon="i-lucide-link"
            />
          </UFormField>

          <div class="grid grid-cols-2 gap-4">
            <UFormField label="Username">
              <UInput
                v-model="jiraForm.username"
                placeholder="username"
                icon="i-lucide-user"
              />
            </UFormField>

            <UFormField label="API Token">
              <UInput
                v-model="jiraForm.password"
                type="password"
                placeholder="********"
                icon="i-lucide-key"
              />
            </UFormField>
          </div>

          <UFormField label="Progetto Default">
            <UInput
              v-model="jiraForm.defaultProject"
              placeholder="PROJ"
              icon="i-lucide-folder-kanban"
            />
          </UFormField>
        </div>

        <template #footer>
          <div class="flex gap-2">
            <UButton
              icon="i-lucide-save"
              color="primary"
              :loading="savingJira"
              @click="saveJiraConfig"
            >
              Salva
            </UButton>
            <UButton
              icon="i-lucide-plug"
              color="neutral"
              variant="soft"
              :loading="testingJira"
              :disabled="!jiraConfig"
              @click="testJiraConnection"
            >
              Test
            </UButton>
          </div>
        </template>
      </UCard>
    </div>
  </div>
</template>
