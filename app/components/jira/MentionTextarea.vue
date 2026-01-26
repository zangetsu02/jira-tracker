<script setup lang="ts">
import { refDebounced } from '@vueuse/core'

interface JiraUser {
  accountId: string
  name?: string
  displayName: string
  avatarUrl?: string
  avatar?: string
}

const props = withDefaults(defineProps<{
  placeholder?: string
  rows?: number
  maxrows?: number
  disabled?: boolean
  autoresize?: boolean
}>(), {
  placeholder: '',
  rows: 3,
  maxrows: 8,
  autoresize: true
})

const modelValue = defineModel<string>({ default: '' })

const emit = defineEmits<{
  'textarea-ref': [el: HTMLTextAreaElement | null]
}>()

// Mention state
const showMentions = ref(false)
const mentionQuery = ref('')
const mentionQueryDebounced = refDebounced(mentionQuery, 300)
const mentionStartIndex = ref(0)
const users = ref<JiraUser[]>([])
const loadingUsers = ref(false)
const selectedIndex = ref(0)
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const mentionListRef = ref<HTMLElement | null>(null)

// Fetch users when mention query changes
watch(mentionQueryDebounced, async (query) => {
  if (!showMentions.value || query.length < 1) {
    users.value = []
    return
  }

  loadingUsers.value = true
  try {
    const result = await $fetch<JiraUser[]>(`/api/jira/users`, {
      params: { q: query }
    })
    users.value = result || []
    selectedIndex.value = 0
  } catch (e) {
    console.error('Error fetching users:', e)
    users.value = []
  } finally {
    loadingUsers.value = false
  }
})

// Handle input to detect @ mentions
const handleInput = (event: Event) => {
  const textarea = event.target as HTMLTextAreaElement
  const value = textarea.value
  const cursorPos = textarea.selectionStart

  // Find if we're in a mention context (after @ without space)
  const textBeforeCursor = value.substring(0, cursorPos)
  const lastAtIndex = textBeforeCursor.lastIndexOf('@')
  
  if (lastAtIndex !== -1) {
    const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1)
    // Check if there's no space after @ (still typing mention)
    if (!textAfterAt.includes(' ') && !textAfterAt.includes('\n')) {
      showMentions.value = true
      mentionQuery.value = textAfterAt
      mentionStartIndex.value = lastAtIndex
      return
    }
  }
  
  showMentions.value = false
  mentionQuery.value = ''
}

// Handle keyboard navigation in mention list
const handleKeydown = (event: KeyboardEvent) => {
  if (!showMentions.value || users.value.length === 0) return

  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault()
      selectedIndex.value = (selectedIndex.value + 1) % users.value.length
      scrollToSelected()
      break
    case 'ArrowUp':
      event.preventDefault()
      selectedIndex.value = (selectedIndex.value - 1 + users.value.length) % users.value.length
      scrollToSelected()
      break
    case 'Enter':
    case 'Tab':
      if (users.value.length > 0) {
        event.preventDefault()
        selectUser(users.value[selectedIndex.value])
      }
      break
    case 'Escape':
      event.preventDefault()
      closeMentions()
      break
  }
}

const scrollToSelected = () => {
  nextTick(() => {
    const list = mentionListRef.value
    const selected = list?.querySelector('.selected') as HTMLElement
    if (selected && list) {
      selected.scrollIntoView({ block: 'nearest' })
    }
  })
}

// Select a user and insert mention
const selectUser = (user: JiraUser) => {
  const value = modelValue.value
  const beforeMention = value.substring(0, mentionStartIndex.value)
  const afterMention = value.substring(mentionStartIndex.value + 1 + mentionQuery.value.length)
  
  // Insert Jira mention format [~username] or [~accountId]
  const mentionText = `[~${user.accountId || user.name}]`
  modelValue.value = beforeMention + mentionText + afterMention
  
  closeMentions()
  
  // Focus and set cursor after mention
  nextTick(() => {
    if (textareaRef.value) {
      const newCursorPos = beforeMention.length + mentionText.length
      textareaRef.value.focus()
      textareaRef.value.setSelectionRange(newCursorPos, newCursorPos)
    }
  })
}

const closeMentions = () => {
  showMentions.value = false
  mentionQuery.value = ''
  users.value = []
  selectedIndex.value = 0
}

// Close mentions when clicking outside
const handleClickOutside = (event: MouseEvent) => {
  const target = event.target as HTMLElement
  if (!target.closest('.mention-container')) {
    closeMentions()
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  // Emit textarea ref for parent components
  emit('textarea-ref', textareaRef.value)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})

// Also emit when ref changes
watch(textareaRef, (el) => {
  emit('textarea-ref', el)
})
</script>

<template>
  <div class="mention-container relative">
    <textarea
      ref="textareaRef"
      v-model="modelValue"
      :placeholder="placeholder"
      :rows="rows"
      :disabled="disabled"
      class="w-full px-3 py-2 bg-[var(--ui-bg-elevated)] border border-[var(--ui-border)] text-sm text-[var(--ui-text)] placeholder-[var(--ui-text-dimmed)] resize-none focus:outline-none focus:border-[var(--accent)] transition-all"
      :class="{ 'opacity-50 cursor-not-allowed': disabled }"
      @input="handleInput"
      @keydown="handleKeydown"
    />
    
    <!-- Mention dropdown -->
    <Transition
      enter-active-class="transition duration-100 ease-out"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition duration-75 ease-in"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div
        v-if="showMentions"
        ref="mentionListRef"
        class="absolute z-50 bottom-full left-0 mb-1 w-72 max-h-48 overflow-y-auto bg-[var(--ui-bg-elevated)] border border-[var(--ui-border)] shadow-[var(--shadow-lg)]"
      >
        <!-- Loading -->
        <div v-if="loadingUsers" class="p-3 text-center">
          <UIcon name="i-lucide-loader-2" class="w-5 h-5 animate-spin text-[var(--accent)] mx-auto" />
          <p class="text-xs text-[var(--ui-text-muted)] mt-1">Ricerca utenti...</p>
        </div>
        
        <!-- No results -->
        <div v-else-if="users.length === 0 && mentionQuery.length > 0" class="p-3 text-center">
          <UIcon name="i-lucide-user-x" class="w-5 h-5 text-[var(--ui-text-dimmed)] mx-auto" />
          <p class="text-xs text-[var(--ui-text-muted)] mt-1">Nessun utente trovato</p>
        </div>
        
        <!-- Hint to type -->
        <div v-else-if="users.length === 0" class="p-3 text-center">
          <UIcon name="i-lucide-at-sign" class="w-5 h-5 text-[var(--ui-text-dimmed)] mx-auto" />
          <p class="text-xs text-[var(--ui-text-muted)] mt-1">Digita per cercare utenti...</p>
        </div>
        
        <!-- User list -->
        <div v-else class="py-1">
          <button
            v-for="(user, index) in users"
            :key="user.accountId || user.name"
            type="button"
            class="w-full px-3 py-2 flex items-center gap-3 text-left hover:bg-[var(--ui-bg-muted)] transition-colors"
            :class="{ 'selected bg-[var(--accent-soft)]': index === selectedIndex }"
            @click="selectUser(user)"
            @mouseenter="selectedIndex = index"
          >
            <UAvatar
              :src="user.avatarUrl || user.avatar"
              :alt="user.displayName"
              size="xs"
            />
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-[var(--ui-text)] truncate">
                {{ user.displayName }}
              </p>
              <p v-if="user.name" class="text-xs text-[var(--ui-text-muted)] truncate">
                @{{ user.name }}
              </p>
            </div>
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
textarea {
  font-family: inherit;
  line-height: 1.5;
}

/* Auto-resize support via JS would go here, but UTextarea handles it */
</style>
