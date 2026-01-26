<script setup lang="ts">
import type { JiraIssue } from '~/composables/useJiraHelpers'

const props = defineProps<{
  issue: JiraIssue
  selected?: boolean
}>()

defineEmits<{
  select: [key: string]
}>()

const { 
  getAssigneeName, 
  getStatusDotClass, 
  getPriorityColor, 
  getPriorityIcon,
  formatRelativeDate 
} = useJiraHelpers()
</script>

<template>
  <button
    type="button"
    class="issue-item w-full text-left p-4 transition-all duration-200 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 focus:outline-none focus:bg-neutral-50 dark:focus:bg-neutral-800/50"
    :class="[
      selected
        ? 'selected bg-neutral-100 dark:bg-neutral-800 ring-2 ring-inset ring-blue-500'
        : ''
    ]"
    @click="$emit('select', issue.key)"
  >
    <div class="flex items-start gap-3">
      <!-- Status Indicator -->
      <div class="shrink-0 mt-1.5">
        <UTooltip :text="issue.status">
          <span
            class="block w-2.5 h-2.5 rounded-full ring-2 ring-white dark:ring-neutral-900"
            :class="getStatusDotClass(issue.status)"
          />
        </UTooltip>
      </div>

      <!-- Content -->
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 mb-1">
          <span class="text-xs font-mono font-medium text-blue-600 dark:text-blue-400">
            {{ issue.key }}
          </span>
          <UBadge
            v-if="issue.priority"
            :color="getPriorityColor(issue.priority)"
            variant="subtle"
            size="xs"
          >
            <UIcon :name="getPriorityIcon(issue.priority)" class="w-3 h-3" />
          </UBadge>
        </div>

        <p class="text-sm font-medium line-clamp-2 mb-2">
          {{ issue.summary }}
        </p>

        <div class="flex items-center gap-3 text-xs text-neutral-500 dark:text-neutral-400">
          <span v-if="getAssigneeName(issue.assignee)" class="flex items-center gap-1">
            <UIcon name="i-lucide-user" class="w-3 h-3" />
            {{ getAssigneeName(issue.assignee) }}
          </span>
          <span class="flex items-center gap-1">
            <UIcon name="i-lucide-clock" class="w-3 h-3" />
            {{ formatRelativeDate(issue.updated) }}
          </span>
        </div>

        <!-- Labels -->
        <div v-if="issue.labels?.length" class="flex flex-wrap gap-1 mt-2">
          <UBadge
            v-for="label in issue.labels.slice(0, 2)"
            :key="label"
            color="neutral"
            variant="subtle"
            size="xs"
          >
            {{ label }}
          </UBadge>
          <UBadge
            v-if="issue.labels.length > 2"
            color="neutral"
            variant="subtle"
            size="xs"
          >
            +{{ issue.labels.length - 2 }}
          </UBadge>
        </div>
      </div>
    </div>
  </button>
</template>
