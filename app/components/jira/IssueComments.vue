<script setup lang="ts">
import type { JiraComment } from '~/composables/useJiraHelpers'

const props = defineProps<{
  comments: JiraComment[]
  loading?: boolean
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
      <h3 class="text-sm font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
        <UIcon name="i-lucide-message-square" class="w-4 h-4 text-neutral-500" />
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

    <div v-else-if="comments.length === 0" class="text-center py-10 bg-neutral-50 dark:bg-neutral-800/30 rounded-xl">
      <UIcon name="i-lucide-message-square-dashed" class="w-12 h-12 text-neutral-300 dark:text-neutral-600 mx-auto mb-3" />
      <p class="text-sm font-medium text-neutral-500 dark:text-neutral-400">Nessun commento</p>
      <p class="text-xs text-neutral-400 dark:text-neutral-500 mt-1">Aggiungi il primo commento qui sotto</p>
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
              <span class="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                {{ comment.author.displayName }}
              </span>
              <UTooltip :text="formatDate(comment.created)">
                <span class="text-xs text-neutral-400 dark:text-neutral-500">
                  {{ formatRelativeDate(comment.created) }}
                </span>
              </UTooltip>
            </div>
            
            <!-- Body -->
            <div class="p-3 bg-neutral-100 dark:bg-neutral-800 rounded-lg rounded-tl-none">
              <p class="text-sm text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap leading-relaxed">{{ comment.body }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Add Comment Form -->
    <div class="pt-4 border-t border-neutral-200 dark:border-neutral-700">
      <div class="flex gap-3">
        <UAvatar size="sm" class="shrink-0 mt-1" />
        <div class="flex-1 space-y-3">
          <UTextarea
            v-model="newComment"
            placeholder="Scrivi un commento..."
            :rows="3"
            autoresize
            :maxrows="8"
            :disabled="addingComment"
            class="w-full"
          />
          <div class="flex items-center justify-between">
            <p class="text-xs text-neutral-400 dark:text-neutral-500">
              Premi Ctrl+Invio per inviare
            </p>
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
