<script setup lang="ts">
import { z } from 'zod'
import { refDebounced } from '@vueuse/core'
import type { FormSubmitEvent } from '@nuxt/ui'

interface JiraUser {
  id: string
  name: string
  displayName: string
  email?: string
  avatar?: string
  accountId?: string
}

export interface IssueFormData {
  summary: string
  description: string
  priority: string
  assignee: string
  labels: string[]
}

const props = withDefaults(defineProps<{
  initialData?: Partial<IssueFormData>
  loading?: boolean
  submitLabel?: string
  submitIcon?: string
  showCancel?: boolean
  mode?: 'create' | 'edit'
}>(), {
  submitLabel: 'Salva',
  submitIcon: 'i-lucide-save',
  showCancel: true,
  mode: 'edit'
})

const emit = defineEmits<{
  submit: [data: IssueFormData]
  cancel: []
}>()

// Zod schema
const schema = z.object({
  summary: z.string().min(1, 'Il titolo è obbligatorio'),
  description: z.string().optional(),
  priority: z.string(),
  assignee: z.string().optional(),
  labels: z.array(z.string())
})

type Schema = z.output<typeof schema>

// Form state
const state = reactive<Schema>({
  summary: '',
  description: '',
  priority: 'Medium',
  assignee: '',
  labels: []
})

// User search
const userSearchQuery = ref('')
const userSearchQueryDebounced = refDebounced(userSearchQuery, 400)
const jiraUsers = ref<JiraUser[]>([])
const loadingUsers = ref(false)

// Fetch users when search query changes
watch(userSearchQueryDebounced, async (query) => {
  if (!query || query.length < 2) {
    jiraUsers.value = []
    return
  }

  loadingUsers.value = true
  try {
    jiraUsers.value = await $fetch<JiraUser[]>(`/api/jira/users?q=${encodeURIComponent(query)}`)
  } catch {
    jiraUsers.value = []
  } finally {
    loadingUsers.value = false
  }
})

const priorityOptions = [
  { label: 'Highest - Critico', value: 'Highest', icon: 'i-lucide-chevrons-up' },
  { label: 'High - Alta', value: 'High', icon: 'i-lucide-chevron-up' },
  { label: 'Medium - Media', value: 'Medium', icon: 'i-lucide-minus' },
  { label: 'Low - Bassa', value: 'Low', icon: 'i-lucide-chevron-down' },
  { label: 'Lowest - Minima', value: 'Lowest', icon: 'i-lucide-chevrons-down' }
]

const userOptions = computed(() => {
  return (jiraUsers.value || [])
    .filter(u => (u.name || u.accountId) && u.displayName)
    .map(u => ({
      label: u.displayName,
      value: u.accountId || u.name,
      avatar: u.avatar ? { src: u.avatar } : undefined
    }))
})

// Initialize form when initialData changes
watch(() => props.initialData, (data) => {
  if (data) {
    state.summary = data.summary || ''
    state.description = data.description || ''
    state.priority = data.priority || 'Medium'
    state.assignee = data.assignee || ''
    state.labels = data.labels ? [...data.labels] : []
  }
}, { immediate: true, deep: true })

// Submit handler
const onSubmit = async (event: FormSubmitEvent<Schema>) => {
  emit('submit', {
    summary: event.data.summary,
    description: event.data.description || '',
    priority: event.data.priority,
    assignee: event.data.assignee || '',
    labels: event.data.labels
  })
}

// Reset form
const reset = () => {
  if (props.initialData) {
    state.summary = props.initialData.summary || ''
    state.description = props.initialData.description || ''
    state.priority = props.initialData.priority || 'Medium'
    state.assignee = props.initialData.assignee || ''
    state.labels = props.initialData.labels ? [...props.initialData.labels] : []
  }
}

defineExpose({ reset })
</script>

<template>
  <UForm
    :schema="schema"
    :state="state"
    class="issue-form space-y-5"
    @submit="onSubmit"
  >
    <!-- Titolo -->
    <UFormField
      label="Titolo Issue"
      name="summary"
      required
      class="w-full"
    >
      <UInput
        v-model="state.summary"
        placeholder="Titolo della issue"
        size="lg"
        :autofocus="mode === 'create'"
        class="w-full"
      />
    </UFormField>

    <!-- Priority & Assignee -->
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <UFormField
        label="Priorità"
        name="priority"
        class="w-full"
      >
        <USelect
          v-model="state.priority"
          :items="priorityOptions"
          size="lg"
          class="w-full"
        />
      </UFormField>

      <UFormField
        label="Assegnatario"
        name="assignee"
        class="w-full"
      >
        <USelectMenu
          v-model="state.assignee"
          v-model:search-term="userSearchQuery"
          :items="userOptions"
          value-key="value"
          placeholder="Non assegnato"
          :loading="loadingUsers"
          size="lg"
          searchable
          searchable-placeholder="Cerca utente (min 2 caratteri)..."
          ignore-filter
          class="w-full"
        >
          <template #empty>
            <span class="text-[var(--ui-text-muted)] text-sm px-2 py-1">
              {{ userSearchQuery.length < 2 ? 'Digita almeno 2 caratteri...' : 'Nessun utente trovato' }}
            </span>
          </template>
        </USelectMenu>
      </UFormField>
    </div>

    <!-- Labels -->
    <UFormField
      label="Labels"
      name="labels"
      class="w-full"
    >
      <UInputTags
        v-model="state.labels"
        placeholder="Aggiungi label e premi Invio..."
        size="lg"
        class="w-full"
      />
    </UFormField>

    <!-- Description -->
    <UFormField
      label="Descrizione"
      name="description"
      class="w-full"
    >
      <JiraDescriptionEditor
        v-model="state.description"
        placeholder="Descrizione della issue..."
        :rows="14"
        :disabled="props.loading"
      />
    </UFormField>

    <!-- Actions -->
    <div class="flex items-center justify-end gap-3 pt-4 border-t border-[var(--ui-border)]">
      <UButton
        v-if="showCancel"
        color="neutral"
        variant="ghost"
        size="lg"
        type="button"
        @click="$emit('cancel')"
      >
        Annulla
      </UButton>
      <UButton
        :icon="submitIcon"
        color="primary"
        size="lg"
        type="submit"
        :loading="loading"
      >
        {{ submitLabel }}
      </UButton>
    </div>
  </UForm>
</template>

<style scoped>
.issue-form :deep(input),
.issue-form :deep(textarea),
.issue-form :deep(select),
.issue-form :deep([role="combobox"]),
.issue-form :deep(.relative.inline-flex) {
  width: 100% !important;
}
</style>
