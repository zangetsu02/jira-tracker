<script setup lang="ts">
import type { JiraIssue, JiraComment, JiraCommentsResponse, JiraAttachment } from '~/composables/useJiraHelpers'
import type { IssueFormData } from './IssueForm.vue'

const props = defineProps<{
  issue: JiraIssue | null
  loading?: boolean
}>()

const emit = defineEmits<{
  refresh: []
}>()

const {
  getAssigneeName,
  getAssigneeAvatar,
  getAssigneeId,
  getReporterName,
  getReporterAvatar,
  getStatusColor,
  getPriorityColor,
  getPriorityIcon,
  formatDate,
  formatRelativeDate
} = useJiraHelpers()

// Edit state
const isEditing = ref(false)
const isSaving = ref(false)
const saveError = ref<string | null>(null)

// Comments state
const comments = ref<JiraComment[]>([])
const loadingComments = ref(false)
const commentsRef = ref<InstanceType<typeof import('./IssueComments.vue').default> | null>(null)

// Attachments - derived from issue prop (no separate API call needed)
const attachments = computed<JiraAttachment[]>(() => props.issue?.attachments || [])

// Form data for edit mode
const editFormData = computed<Partial<IssueFormData>>(() => {
  if (!props.issue) return {}
  return {
    summary: props.issue.summary,
    description: props.issue.description || '',
    priority: props.issue.priority || 'Medium',
    assignee: getAssigneeId(props.issue.assignee) || '',
    labels: [...(props.issue.labels || [])],
    issueType: props.issue.issueType || ''
  }
})

// Watch issue changes
watch(() => props.issue, (issue) => {
  if (issue) {
    isEditing.value = false
    saveError.value = null
    refreshComments()
  }
}, { immediate: true })

// Comments
const refreshComments = async () => {
  if (!props.issue?.key) {
    comments.value = []
    return
  }

  loadingComments.value = true
  try {
    const result = await $fetch<JiraCommentsResponse>(`/api/jira/issue/${props.issue.key}/comments`)
    comments.value = result.comments
  } catch (e) {
    console.error('Error fetching comments:', e)
    comments.value = []
  } finally {
    loadingComments.value = false
  }
}

const handleAddComment = async (body: string) => {
  if (!props.issue?.key) return

  commentsRef.value?.setAddingComment(true)
  try {
    const comment = await $fetch<JiraComment>(`/api/jira/issue/${props.issue.key}/comments`, {
      method: 'POST',
      body: { body }
    })
    comments.value.push(comment)
  } catch (e) {
    console.error('Error adding comment:', e)
  } finally {
    commentsRef.value?.setAddingComment(false)
  }
}

// Edit actions
const startEditing = () => {
  isEditing.value = true
  saveError.value = null
}

const cancelEditing = () => {
  isEditing.value = false
  saveError.value = null
}

const handleFormSubmit = async (data: IssueFormData) => {
  if (!props.issue?.key) return

  isSaving.value = true
  saveError.value = null

  try {
    await $fetch(`/api/jira/issue/${props.issue.key}`, {
      method: 'PATCH',
      body: {
        summary: data.summary,
        description: data.description,
        priority: data.priority || undefined,
        labels: data.labels,
        assignee: data.assignee || undefined,
        issueType: data.issueType || undefined
      }
    })

    isEditing.value = false
    emit('refresh')
  } catch (e: any) {
    saveError.value = e.message || 'Errore durante il salvataggio'
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <!-- Loading -->
    <div
      v-if="loading"
      class="flex-1 flex items-center justify-center"
    >
      <div class="text-center">
        <UIcon
          name="i-lucide-loader-2"
          class="w-8 h-8 animate-spin text-[var(--ui-text-muted)] mb-2"
        />
        <p class="text-sm text-[var(--ui-text-muted)]">
          Caricamento...
        </p>
      </div>
    </div>

    <!-- Empty State -->
    <div
      v-else-if="!issue"
      class="flex-1 flex flex-col items-center justify-center p-8"
    >
      <div class="w-20 h-20 bg-[var(--ui-bg-muted)] flex items-center justify-center mb-4">
        <UIcon
          name="i-lucide-file-text"
          class="w-10 h-10 text-[var(--ui-text-dimmed)]"
        />
      </div>
      <p class="text-lg font-medium text-[var(--ui-text-muted)]">
        Seleziona una issue
      </p>
      <p class="text-sm text-[var(--ui-text-dimmed)] mt-1">
        Clicca su una issue dalla lista per vedere i dettagli
      </p>
    </div>

    <!-- Issue Detail -->
    <template v-else>
      <!-- Header -->
      <div class="shrink-0 border-b border-[var(--ui-border)]">
        <!-- Top Bar -->
        <div class="px-6 py-3 flex items-center justify-between bg-[var(--ui-bg-muted)]">
          <div class="flex items-center gap-3">
            <UBadge
              :color="getStatusColor(issue.status)"
              variant="solid"
              size="sm"
            >
              {{ issue.status }}
            </UBadge>
            <code class="px-2 py-0.5 text-xs font-mono bg-[var(--ui-bg-accent)] text-[var(--ui-text)]">
              {{ issue.key }}
            </code>
            <UBadge
              v-if="issue.issueType"
              color="neutral"
              variant="subtle"
              size="xs"
            >
              {{ issue.issueType }}
            </UBadge>
          </div>

          <!-- Actions -->
          <div class="flex items-center gap-2">
            <UButton
              v-if="!isEditing"
              color="primary"
              variant="soft"
              size="sm"
              icon="i-lucide-pencil"
              @click="startEditing"
            >
              Modifica Issue
            </UButton>
            <UTooltip
              v-if="!isEditing"
              text="Apri in Jira"
            >
              <UButton
                :to="issue.url"
                target="_blank"
                color="neutral"
                variant="ghost"
                size="sm"
                icon="i-lucide-external-link"
              />
            </UTooltip>
          </div>
        </div>

        <!-- Title (view mode only) -->
        <div
          v-if="!isEditing"
          class="px-6 py-4"
        >
          <h2 class="text-xl font-semibold leading-tight text-[var(--ui-text)]">
            {{ issue.summary }}
          </h2>
        </div>
      </div>

      <!-- Content -->
      <div class="flex-1 min-h-0 overflow-y-auto">
        <div class="p-6">
          <!-- Edit Mode: Full Form -->
          <div
            v-if="isEditing"
            class="space-y-4"
          >
            <!-- Error Alert -->
            <UAlert
              v-if="saveError"
              color="error"
              variant="subtle"
              icon="i-lucide-alert-circle"
              :close-button="{ icon: 'i-lucide-x', color: 'error', variant: 'ghost', size: 'xs' }"
              @close="saveError = null"
            >
              <template #title>
                Errore nel salvataggio
              </template>
              <template #description>
                {{ saveError }}
              </template>
            </UAlert>

            <JiraIssueForm
              :initial-data="editFormData"
              :loading="isSaving"
              submit-label="Salva modifiche"
              submit-icon="i-lucide-save"
              mode="edit"
              @submit="handleFormSubmit"
              @cancel="cancelEditing"
            />
          </div>

          <!-- View Mode -->
          <div
            v-else
            class="space-y-6"
          >
            <!-- Metadata Grid -->
            <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <!-- Priority -->
              <JiraIssueMetadataCard
                icon="i-lucide-signal"
                label="Priorità"
              >
                <UBadge
                  :color="getPriorityColor(issue.priority)"
                  variant="subtle"
                  size="sm"
                >
                  <UIcon
                    :name="getPriorityIcon(issue.priority)"
                    class="w-3.5 h-3.5 mr-1"
                  />
                  {{ issue.priority || 'Nessuna' }}
                </UBadge>
              </JiraIssueMetadataCard>

              <!-- Assignee -->
              <JiraIssueMetadataCard
                icon="i-lucide-user-check"
                label="Assegnatario"
              >
                <div class="flex items-center gap-2">
                  <UAvatar
                    :src="getAssigneeAvatar(issue.assignee)"
                    :alt="getAssigneeName(issue.assignee) || 'N/A'"
                    size="xs"
                  />
                  <span class="text-sm font-medium truncate">
                    {{ getAssigneeName(issue.assignee) || 'Non assegnato' }}
                  </span>
                </div>
              </JiraIssueMetadataCard>

              <!-- Reporter -->
              <JiraIssueMetadataCard
                icon="i-lucide-user"
                label="Reporter"
              >
                <div class="flex items-center gap-2">
                  <UAvatar
                    :src="getReporterAvatar(issue.reporter)"
                    :alt="getReporterName(issue.reporter) || 'N/A'"
                    size="xs"
                  />
                  <span class="text-sm font-medium truncate">
                    {{ getReporterName(issue.reporter) || '-' }}
                  </span>
                </div>
              </JiraIssueMetadataCard>

              <!-- Updated -->
              <JiraIssueMetadataCard
                icon="i-lucide-clock"
                label="Aggiornato"
              >
                <UTooltip :text="formatDate(issue.updated)">
                  <span class="text-sm font-medium">
                    {{ formatRelativeDate(issue.updated) }}
                  </span>
                </UTooltip>
              </JiraIssueMetadataCard>
            </div>

            <!-- Labels -->
            <div class="space-y-3">
              <h3 class="text-sm font-semibold text-[var(--ui-text)] flex items-center gap-2">
                <UIcon
                  name="i-lucide-tags"
                  class="w-4 h-4 text-[var(--ui-text-muted)]"
                />
                Labels
              </h3>
              <div class="flex flex-wrap gap-2">
                <UBadge
                  v-for="label in issue.labels"
                  :key="label"
                  color="neutral"
                  variant="subtle"
                  size="sm"
                >
                  {{ label }}
                </UBadge>
                <span
                  v-if="!issue.labels?.length"
                  class="text-sm text-[var(--ui-text-dimmed)] italic"
                >
                  Nessuna label
                </span>
              </div>
            </div>

            <!-- Description -->
            <div class="space-y-3">
              <h3 class="text-sm font-semibold text-[var(--ui-text)] flex items-center gap-2">
                <UIcon
                  name="i-lucide-align-left"
                  class="w-4 h-4 text-[var(--ui-text-muted)]"
                />
                Descrizione
              </h3>
              <div class="p-4 bg-[var(--ui-bg-muted)] border border-[var(--ui-border)]">
                <JiraDescriptionPreview
                  :content="issue.description"
                  :attachments="attachments"
                />
              </div>
            </div>

            <!-- Comments -->
            <JiraIssueComments
              ref="commentsRef"
              :comments="comments"
              :loading="loadingComments"
              :attachments="attachments"
              @refresh="refreshComments"
              @add="handleAddComment"
            />

            <!-- Footer -->
            <div class="flex items-center justify-between text-xs text-[var(--ui-text-muted)] pt-4 border-t border-[var(--ui-border)]">
              <div class="flex items-center gap-1.5">
                <UIcon
                  name="i-lucide-calendar-plus"
                  class="w-3.5 h-3.5"
                />
                Creato: {{ formatDate(issue.created) }}
              </div>
              <UButton
                :to="issue.url"
                target="_blank"
                size="xs"
                color="neutral"
                variant="link"
                trailing-icon="i-lucide-external-link"
              >
                Vedi su Jira
              </UButton>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
