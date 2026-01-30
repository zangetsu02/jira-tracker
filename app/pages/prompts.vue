<script setup lang="ts">
import type { AnalysisPrompt } from '~~/shared/utils/types'

const { data: prompts, pending, refresh } = await useFetch<AnalysisPrompt[]>('/api/prompts', {
  default: () => []
})

const editDrawerOpen = ref(false)
const editingPrompt = ref<AnalysisPrompt | null>(null)
const saving = ref(false)
const deleting = ref(false)
const error = ref<string | null>(null)
const success = ref<string | null>(null)

const form = ref({
  name: '',
  description: '',
  content: '',
  isDefault: false
})

const isEditing = computed(() => !!editingPrompt.value)

const openNewPrompt = () => {
  editingPrompt.value = null
  form.value = {
    name: '',
    description: '',
    content: getDefaultPromptTemplate(),
    isDefault: false
  }
  editDrawerOpen.value = true
}

const openEditPrompt = (prompt: AnalysisPrompt) => {
  editingPrompt.value = prompt
  form.value = {
    name: prompt.name,
    description: prompt.description || '',
    content: prompt.content,
    isDefault: prompt.isDefault || false
  }
  editDrawerOpen.value = true
}

const closeDrawer = () => {
  editDrawerOpen.value = false
  editingPrompt.value = null
  error.value = null
}

const savePrompt = async () => {
  if (!form.value.name || !form.value.content) {
    error.value = 'Nome e contenuto sono obbligatori'
    return
  }

  saving.value = true
  error.value = null

  try {
    if (editingPrompt.value) {
      await $fetch(`/api/prompts/${editingPrompt.value.id}`, {
        method: 'PUT',
        body: form.value
      })
      success.value = 'Prompt aggiornato'
    } else {
      await $fetch('/api/prompts', {
        method: 'POST',
        body: form.value
      })
      success.value = 'Prompt creato'
    }
    await refresh()
    closeDrawer()
    setTimeout(() => success.value = null, 3000)
  } catch (e: unknown) {
    const err = e as { data?: { message?: string }, message?: string }
    error.value = err.data?.message || err.message || 'Errore durante il salvataggio'
  } finally {
    saving.value = false
  }
}

const deletePrompt = async (prompt: AnalysisPrompt) => {
  if (!confirm(`Eliminare il prompt "${prompt.name}"?`)) return

  deleting.value = true
  error.value = null

  try {
    await $fetch(`/api/prompts/${prompt.id}`, { method: 'DELETE' })
    await refresh()
    success.value = 'Prompt eliminato'
    setTimeout(() => success.value = null, 3000)
  } catch (e: unknown) {
    const err = e as { data?: { message?: string }, message?: string }
    error.value = err.data?.message || err.message || 'Errore durante eliminazione'
  } finally {
    deleting.value = false
  }
}

const formatDate = (date: string | Date | null) => {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })
}

function getDefaultPromptTemplate(): string {
  return `# Analisi Microservizio

Sei un senior software engineer specializzato in migrazione da sistemi legacy ASPX a microservizi Java/Spring Boot.

IMPORTANTE: Rispondi SEMPRE in ITALIANO. Tutti i titoli, descrizioni e contenuti delle issue devono essere in lingua italiana.

## Contesto

- **Microservizio**: \`{{microservicePath}}\` (Java/Spring Boot)
{{#if legacyPath}}- **Codice legacy ASPX**: \`{{legacyPath}}\`{{/if}}
{{#if pdfPath}}- **Documento requisiti (PDF)**: \`{{pdfPath}}\`{{/if}}

## Stack Tecnologico del Microservizio
- Java 17+
- Spring Boot 3.x
- Spring Web (REST API)
- Spring Data JPA
- Maven/Gradle

{{#if usecases}}
## Use Case da Verificare

I seguenti use case sono stati estratti dal documento dei requisiti e devono essere verificati nel codice:

{{usecasesList}}
{{/if}}

## Obiettivo

Analizza il microservizio e identifica issue da risolvere confrontando:
{{#if usecases}}
1. **Use Case estratti**: verifica che ogni use case sia implementato correttamente
{{/if}}
{{#if legacyPath}}
2. **Codice Legacy**: confronta il comportamento con il sistema ASPX originale
{{/if}}
3. **Implementazione**: mappa endpoint, servizi, repository e verifica completezza

## Tipi di Issue

- \`missing_implementation\`: Funzionalita assente (use case non implementato)
- \`partial_implementation\`: Funzionalita incompleta
- \`legacy_mismatch\`: Comportamento diverso dal legacy
- \`behavior_difference\`: Differenza rispetto ai requisiti/use case
- \`missing_test\`: Funzionalita non testata
- \`security_concern\`: Problema di sicurezza
- \`performance_concern\`: Problema di performance
- \`documentation_gap\`: Documentazione mancante

## Valori ammessi

- **severity**: critical, high, medium, low
- **priority**: highest, high, medium, low, lowest
- **estimatedEffort**: XS, S, M, L, XL

## Output

Restituisci ESCLUSIVAMENTE un oggetto JSON valido con questa struttura esatta:

{"issues":[{"code":"ISSUE-001","title":"Titolo","type":"missing_implementation","severity":"high","priority":"high","description":"Descrizione","relatedUseCases":["UC-001"],"legacyReference":null,"microserviceReference":"src/file.ts:45","acceptanceCriteria":["Criterio 1"],"suggestedLabels":["backend"],"estimatedEffort":"M"}]}

REGOLE CRITICHE:
- LINGUA: Scrivi TUTTO in ITALIANO (titoli, descrizioni, criteri di accettazione, note)
- EFFICIENZA: Usa massimo 8-10 tool calls. Leggi SOLO i file essenziali
- STRUTTURA JAVA: Cerca in src/main/java per Controller, Service, Repository, Entity
- Usa Glob per trovare i file, poi leggi solo quelli rilevanti
- NON leggere tutti i file - concentrati su *Controller.java, *Service.java, *Repository.java
- IMPORTANTE: L'ultima cosa che devi fare e' SEMPRE generare il JSON di output. Non terminare mai con una tool call.
- DOPO aver analizzato, genera IMMEDIATAMENTE il JSON come testo (NON come tool call)
- Output SOLO JSON valido, nessun testo prima o dopo
- Nessun markdown, nessun code fence, nessun commento
- JSON deve iniziare con { e terminare con }
- NON scrivere frasi come "Based on my analysis..." - vai direttamente al JSON
- Usa null per campi non applicabili
- In relatedUseCases usa i codici degli use case forniti sopra
- Se non ci sono issue, restituisci {"issues":[]}
- RICORDA: Devi SEMPRE concludere con l'output JSON testuale, mai con una tool call`
}
</script>

<template>
  <div class="animate-fade-in">
    <!-- Header -->
    <header class="mb-10">
      <div class="flex items-start justify-between gap-8">
        <div>
          <h1 class="text-4xl lg:text-5xl font-display tracking-tight">
            Prompt di Analisi
          </h1>
          <p class="text-[var(--ui-text-muted)] mt-2 text-lg">
            Gestisci i prompt personalizzati per l'analisi dei microservizi
          </p>
        </div>
        <button
          class="h-12 px-6 bg-[var(--ui-text)] text-[var(--ui-bg)] font-medium text-sm flex items-center gap-2 hover:opacity-90 transition-opacity"
          @click="openNewPrompt"
        >
          <UIcon
            name="i-lucide-plus"
            class="w-4 h-4"
          />
          Nuovo Prompt
        </button>
      </div>
    </header>

    <!-- Success Alert -->
    <div
      v-if="success"
      class="mb-6 flex items-center gap-3 p-4 bg-[var(--ui-success-soft)] text-[var(--ui-success)]"
    >
      <UIcon
        name="i-lucide-check-circle"
        class="w-5 h-5"
      />
      <span class="flex-1">{{ success }}</span>
      <button @click="success = null">
        <UIcon
          name="i-lucide-x"
          class="w-4 h-4"
        />
      </button>
    </div>

    <!-- Error Alert -->
    <div
      v-if="error && !editDrawerOpen"
      class="mb-6 flex items-center gap-3 p-4 bg-[var(--ui-error-soft)] text-[var(--ui-error)]"
    >
      <UIcon
        name="i-lucide-alert-circle"
        class="w-5 h-5"
      />
      <span class="flex-1">{{ error }}</span>
      <button @click="error = null">
        <UIcon
          name="i-lucide-x"
          class="w-4 h-4"
        />
      </button>
    </div>

    <!-- Loading -->
    <div
      v-if="pending && !prompts?.length"
      class="flex items-center justify-center py-32"
    >
      <UIcon
        name="i-lucide-loader-2"
        class="w-8 h-8 animate-spin text-[var(--ui-text-muted)]"
      />
    </div>

    <!-- Empty State -->
    <div
      v-else-if="!prompts?.length"
      class="bento-item p-12 text-center"
    >
      <div class="w-20 h-20 mx-auto bg-[var(--ui-bg-muted)] flex items-center justify-center mb-6">
        <UIcon
          name="i-lucide-file-text"
          class="w-10 h-10 text-[var(--ui-text-muted)]"
        />
      </div>
      <h2 class="text-xl font-semibold mb-2">
        Nessun prompt configurato
      </h2>
      <p class="text-[var(--ui-text-muted)] mb-6 max-w-md mx-auto">
        Crea il tuo primo prompt personalizzato per l'analisi dei microservizi.
        Puoi definire le istruzioni specifiche per Claude.
      </p>
      <button
        class="h-12 px-6 bg-[var(--ui-text)] text-[var(--ui-bg)] font-medium text-sm inline-flex items-center gap-2 hover:opacity-90 transition-opacity"
        @click="openNewPrompt"
      >
        <UIcon
          name="i-lucide-plus"
          class="w-4 h-4"
        />
        Crea il primo Prompt
      </button>
    </div>

    <!-- Prompts Grid -->
    <div
      v-else
      class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6"
    >
      <div
        v-for="prompt in prompts"
        :key="prompt.id"
        class="bento-item p-6 group animate-slide-up"
      >
        <div class="flex items-start justify-between gap-4 mb-4">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 bg-[var(--ui-bg-muted)] flex items-center justify-center shrink-0">
              <UIcon
                name="i-lucide-file-text"
                class="w-5 h-5 text-[var(--ui-text-muted)]"
              />
            </div>
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <h3 class="font-semibold truncate">
                  {{ prompt.name }}
                </h3>
                <span
                  v-if="prompt.isDefault"
                  class="tag tag--info text-xs shrink-0"
                >
                  Default
                </span>
              </div>
              <p class="text-xs text-[var(--ui-text-dimmed)]">
                {{ formatDate(prompt.updatedAt) }}
              </p>
            </div>
          </div>
          <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              class="p-2 text-[var(--ui-text-muted)] hover:text-[var(--ui-text)] hover:bg-[var(--ui-bg-muted)] transition-colors"
              title="Modifica"
              @click="openEditPrompt(prompt)"
            >
              <UIcon
                name="i-lucide-pencil"
                class="w-4 h-4"
              />
            </button>
            <button
              class="p-2 text-[var(--ui-text-muted)] hover:text-[var(--ui-error)] hover:bg-[var(--ui-error-soft)] transition-colors"
              title="Elimina"
              :disabled="deleting"
              @click="deletePrompt(prompt)"
            >
              <UIcon
                name="i-lucide-trash-2"
                class="w-4 h-4"
              />
            </button>
          </div>
        </div>

        <p
          v-if="prompt.description"
          class="text-sm text-[var(--ui-text-muted)] line-clamp-2 mb-4"
        >
          {{ prompt.description }}
        </p>

        <div class="p-3 bg-[var(--ui-bg-muted)] font-mono text-xs text-[var(--ui-text-dimmed)] line-clamp-4">
          {{ prompt.content.substring(0, 200) }}...
        </div>

        <button
          class="mt-4 w-full h-10 border border-[var(--ui-border)] text-sm font-medium flex items-center justify-center gap-2 hover:bg-[var(--ui-bg-muted)] transition-colors"
          @click="openEditPrompt(prompt)"
        >
          <UIcon
            name="i-lucide-pencil"
            class="w-4 h-4"
          />
          Modifica
        </button>
      </div>
    </div>

    <!-- Edit/Create Drawer -->
    <USlideover
      v-model:open="editDrawerOpen"
      side="right"
      :ui="{ width: 'sm:max-w-5xl' }"
    >
      <template #header>
        <div class="flex items-center gap-4">
          <div class="w-12 h-12 bg-[var(--ui-bg-muted)] flex items-center justify-center shrink-0">
            <UIcon
              :name="isEditing ? 'i-lucide-pencil' : 'i-lucide-plus'"
              class="w-6 h-6 text-[var(--ui-text-muted)]"
            />
          </div>
          <div class="min-w-0 flex-1">
            <h2 class="text-xl font-semibold tracking-tight">
              {{ isEditing ? 'Modifica Prompt' : 'Nuovo Prompt' }}
            </h2>
            <p class="text-sm text-[var(--ui-text-muted)] truncate mt-0.5">
              {{ isEditing ? editingPrompt?.name : 'Crea un nuovo prompt di analisi' }}
            </p>
          </div>
        </div>
      </template>

      <template #body>
        <div class="space-y-6 -mx-4 -my-4 p-4">
          <!-- Error Alert -->
          <div
            v-if="error"
            class="flex items-center gap-3 p-3 bg-[var(--ui-error-soft)] text-[var(--ui-error)]"
          >
            <UIcon
              name="i-lucide-alert-circle"
              class="w-4 h-4"
            />
            <span class="text-sm">{{ error }}</span>
            <button
              class="ml-auto"
              @click="error = null"
            >
              <UIcon
                name="i-lucide-x"
                class="w-4 h-4"
              />
            </button>
          </div>

          <!-- Name -->
          <div class="space-y-2">
            <label class="text-xs font-semibold uppercase tracking-wider text-[var(--ui-text-muted)]">
              Nome *
            </label>
            <input
              v-model="form.name"
              type="text"
              placeholder="Es: Analisi Completa"
              class="w-full h-12 px-4 bg-[var(--ui-bg-muted)] border border-[var(--ui-border)] text-sm placeholder:text-[var(--ui-text-dimmed)] focus:outline-none focus:border-[var(--ui-text)] transition-colors"
            >
          </div>

          <!-- Description -->
          <div class="space-y-2">
            <label class="text-xs font-semibold uppercase tracking-wider text-[var(--ui-text-muted)]">
              Descrizione
            </label>
            <input
              v-model="form.description"
              type="text"
              placeholder="Descrizione opzionale del prompt"
              class="w-full h-12 px-4 bg-[var(--ui-bg-muted)] border border-[var(--ui-border)] text-sm placeholder:text-[var(--ui-text-dimmed)] focus:outline-none focus:border-[var(--ui-text)] transition-colors"
            >
          </div>

          <!-- Is Default -->
          <div class="flex items-center gap-3">
            <button
              type="button"
              class="w-5 h-5 border-2 flex items-center justify-center transition-colors"
              :class="form.isDefault
                ? 'border-[var(--ui-info)] bg-[var(--ui-info)]'
                : 'border-[var(--ui-border)] hover:border-[var(--ui-text-muted)]'"
              @click="form.isDefault = !form.isDefault"
            >
              <UIcon
                v-if="form.isDefault"
                name="i-lucide-check"
                class="w-3 h-3 text-white"
              />
            </button>
            <label
              class="text-sm cursor-pointer"
              @click="form.isDefault = !form.isDefault"
            >
              Imposta come prompt predefinito
            </label>
          </div>

          <!-- Content -->
          <div class="space-y-2">
            <label class="text-xs font-semibold uppercase tracking-wider text-[var(--ui-text-muted)]">
              Contenuto Prompt *
            </label>
            <textarea
              v-model="form.content"
              rows="25"
              placeholder="Inserisci il prompt per Claude..."
              class="w-full min-h-[500px] px-4 py-4 bg-neutral-900 border border-neutral-700 rounded text-sm font-mono text-neutral-100 leading-6 placeholder:text-neutral-500 focus:outline-none focus:border-neutral-500 focus:ring-1 focus:ring-neutral-500 transition-colors resize-y"
            />
            <p class="text-xs text-[var(--ui-text-dimmed)]">
              Variabili disponibili: <code class="px-1.5 py-0.5 bg-neutral-800 text-neutral-300 rounded">&#123;&#123;microservicePath&#125;&#125;</code>,
              <code class="px-1.5 py-0.5 bg-neutral-800 text-neutral-300 rounded">&#123;&#123;legacyPath&#125;&#125;</code>,
              <code class="px-1.5 py-0.5 bg-neutral-800 text-neutral-300 rounded">&#123;&#123;pdfPath&#125;&#125;</code>,
              <code class="px-1.5 py-0.5 bg-neutral-800 text-neutral-300 rounded">&#123;&#123;usecasesList&#125;&#125;</code>
            </p>
          </div>
        </div>
      </template>

      <template #footer>
        <div class="flex items-center justify-between gap-4">
          <button
            type="button"
            class="h-11 px-6 bg-[var(--ui-bg-muted)] text-[var(--ui-text)] border border-[var(--ui-border)] font-medium text-sm hover:bg-[var(--ui-bg-accent)] transition-colors"
            @click="closeDrawer"
          >
            Annulla
          </button>
          <button
            type="button"
            class="h-11 px-6 bg-[var(--ui-text)] text-[var(--ui-bg)] font-medium text-sm flex items-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
            :disabled="saving || !form.name || !form.content"
            @click="savePrompt"
          >
            <UIcon
              v-if="saving"
              name="i-lucide-loader-2"
              class="w-4 h-4 animate-spin"
            />
            <UIcon
              v-else
              name="i-lucide-save"
              class="w-4 h-4"
            />
            {{ isEditing ? 'Salva Modifiche' : 'Crea Prompt' }}
          </button>
        </div>
      </template>
    </USlideover>
  </div>
</template>
