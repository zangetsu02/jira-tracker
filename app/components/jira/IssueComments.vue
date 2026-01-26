<script setup lang="ts">
import type { JiraComment, JiraAttachment } from '~/composables/useJiraHelpers'

const props = defineProps<{
  comments: JiraComment[]
  loading?: boolean
  attachments?: JiraAttachment[]
}>()

const emit = defineEmits<{
  refresh: []
  add: [body: string]
}>()

const { formatRelativeDate, formatDate } = useJiraHelpers()

const newComment = ref('')
const addingComment = ref(false)

// Comments sorted chronologically (oldest first, newest last)
const sortedComments = computed(() => {
  return [...props.comments].sort((a, b) => 
    new Date(a.created).getTime() - new Date(b.created).getTime()
  )
})

const handleAddComment = async () => {
  if (!newComment.value.trim()) return
  
  addingComment.value = true
  try {
    emit('add', newComment.value.trim())
    newComment.value = ''
  } finally {
    addingComment.value = false
  }
}

// Expose for parent to control loading state
defineExpose({
  setAddingComment: (val: boolean) => { addingComment.value = val }
})
</script>

<template>
  <div class="space-y-5">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <h3 class="text-sm font-semibold text-[var(--ui-text)] flex items-center gap-2">
        <UIcon name="i-lucide-message-square" class="w-4 h-4 text-[var(--ui-text-muted)]" />
        Commenti
        <UBadge v-if="comments.length" color="neutral" variant="subtle" size="xs">
          {{ comments.length }}
        </UBadge>
      </h3>
      <UButton
        v-if="comments.length > 0"
        size="xs"
        color="neutral"
        variant="ghost"
        icon="i-lucide-refresh-cw"
        :loading="loading"
        @click="$emit('refresh')"
      />
    </div>

    <!-- Comments List (chronological: oldest first) -->
    <div v-if="loading && comments.length === 0" class="space-y-4">
      <USkeleton v-for="i in 2" :key="i" class="h-24 w-full rounded-xl" />
    </div>

    <div v-else-if="comments.length === 0" class="text-center py-10 bg-[var(--ui-bg-muted)]">
      <UIcon name="i-lucide-message-square-dashed" class="w-12 h-12 text-[var(--ui-text-dimmed)] mx-auto mb-3" />
      <p class="text-sm font-medium text-[var(--ui-text-muted)]">Nessun commento</p>
      <p class="text-xs text-[var(--ui-text-dimmed)] mt-1">Aggiungi il primo commento qui sotto</p>
    </div>

    <div v-else class="space-y-4 max-h-[400px] overflow-y-auto pr-2">
      <div
        v-for="comment in sortedComments"
        :key="comment.id"
        class="comment-card group relative"
      >
        <div class="flex gap-3">
          <!-- Avatar -->
          <UAvatar
            :src="comment.author.avatarUrl"
            :alt="comment.author.displayName"
            size="sm"
            class="shrink-0 mt-0.5"
          />
          
          <!-- Content -->
          <div class="flex-1 min-w-0">
            <!-- Header -->
            <div class="flex items-baseline gap-2 mb-1.5">
              <span class="text-sm font-medium text-[var(--ui-text)]">
                {{ comment.author.displayName }}
              </span>
              <UTooltip :text="formatDate(comment.created)">
                <span class="text-xs text-[var(--ui-text-dimmed)]">
                  {{ formatRelativeDate(comment.created) }}
                </span>
              </UTooltip>
            </div>
            
            <!-- Body with Jira formatting -->
            <div class="p-3 bg-[var(--ui-bg-muted)] border border-[var(--ui-border)]">
              <JiraDescriptionPreview :content="comment.body" :attachments="attachments" />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Add Comment Form -->
    <div class="pt-4 border-t border-[var(--ui-border)]">
      <div class="flex gap-3">
        <UAvatar size="sm" class="shrink-0 mt-1" />
        <div class="flex-1 space-y-3">
          <div class="flex items-center justify-between mb-1">
            <span class="text-xs font-medium text-[var(--ui-text-muted)]">Nuovo commento</span>
          </div>

          <!-- Comment Editor with toolbar -->
          <JiraCommentEditor
            v-model="newComment"
            placeholder="Scrivi un commento... Usa @ per menzionare utenti"
            :rows="3"
            :disabled="addingComment"
            :attachments="attachments"
          />

          <div class="flex items-center justify-end">
            <UButton
              color="primary"
              size="sm"
              icon="i-lucide-send"
              :loading="addingComment"
              :disabled="!newComment.trim()"
              @click="handleAddComment"
            >
              Invia commento
            </UButton>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.comment-card {
  animation: commentFadeIn 0.3s ease-out forwards;
}

@keyframes commentFadeIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
