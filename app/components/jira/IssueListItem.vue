<script setup lang="ts">
import type { JiraIssue } from '~/composables/useJiraHelpers'

const props = defineProps<{
  issue: JiraIssue
  selected?: boolean
  focused?: boolean
}>()

defineEmits<{
  select: [key: string]
}>()

const { 
  getAssigneeName, 
  getAssigneeAvatar,
  getStatusDotClass,
  getStatusColor,
  getPriorityColor, 
  getPriorityIcon,
  formatRelativeDate 
} = useJiraHelpers()
</script>

<template>
  <button
    type="button"
    class="issue-item w-full text-left p-4 transition-all duration-150 hover:bg-[var(--ui-bg-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--ui-border-accented)]"
    :class="[
      selected
        ? 'selected bg-[var(--ui-bg-accented)]'
        : '',
      focused && !selected
        ? 'bg-[var(--ui-bg-muted)]'
        : ''
    ]"
    :aria-current="selected ? 'true' : undefined"
    @click="$emit('select', issue.key)"
  >
    <div class="flex items-start gap-3">
      <!-- Status Indicator -->
      <div class="shrink-0 mt-1">
        <UTooltip :text="issue.status">
          <span
            class="block w-2.5 h-2.5 rounded-full ring-2 ring-[var(--ui-bg)] transition-transform"
            :class="[
              getStatusDotClass(issue.status),
              selected ? 'scale-110' : ''
            ]"
            role="img"
            :aria-label="`Stato: ${issue.status}`"
          />
        </UTooltip>
      </div>

      <!-- Content -->
      <div class="flex-1 min-w-0">
        <!-- Header Row -->
        <div class="flex items-center justify-between gap-2 mb-1">
          <div class="flex items-center gap-2 min-w-0">
            <code class="text-xs font-mono font-medium text-[var(--ui-text-muted)] shrink-0">
              {{ issue.key }}
            </code>
            <UBadge
              v-if="issue.issueType"
              color="neutral"
              variant="subtle"
              size="xs"
              class="shrink-0"
            >
              {{ issue.issueType }}
            </UBadge>
          </div>
          <UBadge
            v-if="issue.priority"
            :color="getPriorityColor(issue.priority)"
            variant="subtle"
            size="xs"
            class="shrink-0"
          >
            <UIcon :name="getPriorityIcon(issue.priority)" class="w-3 h-3" />
            <span class="sr-only">Priorità: {{ issue.priority }}</span>
          </UBadge>
        </div>

        <!-- Title -->
        <p 
          class="text-sm font-medium line-clamp-2 mb-2 text-[var(--ui-text)]"
          :title="issue.summary"
        >
          {{ issue.summary }}
        </p>

        <!-- Meta Row -->
        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-3 text-xs text-[var(--ui-text-muted)] min-w-0">
            <!-- Assignee -->
            <span 
              v-if="getAssigneeName(issue.assignee)" 
              class="flex items-center gap-1.5 min-w-0"
            >
              <UAvatar
                :src="getAssigneeAvatar(issue.assignee)"
                :alt="getAssigneeName(issue.assignee) || ''"
                size="3xs"
                class="shrink-0"
              />
              <span class="truncate max-w-[100px]">
                {{ getAssigneeName(issue.assignee) }}
              </span>
            </span>
            <!-- Updated -->
            <span class="flex items-center gap-1 shrink-0">
              <UIcon name="i-lucide-clock" class="w-3 h-3" aria-hidden="true" />
              <time :datetime="issue.updated">
                {{ formatRelativeDate(issue.updated) }}
              </time>
            </span>
          </div>

          <!-- Status Badge (mobile) -->
          <UBadge
            :color="getStatusColor(issue.status)"
            variant="subtle"
            size="xs"
            class="shrink-0 lg:hidden"
          >
            {{ issue.status }}
          </UBadge>
        </div>

        <!-- Labels -->
        <div 
          v-if="issue.labels?.length" 
          class="flex flex-wrap gap-1 mt-2"
          role="list"
          aria-label="Labels"
        >
          <UBadge
            v-for="label in issue.labels.slice(0, 3)"
            :key="label"
            color="neutral"
            variant="subtle"
            size="xs"
            role="listitem"
          >
            {{ label }}
          </UBadge>
          <UBadge
            v-if="issue.labels.length > 3"
            color="neutral"
            variant="subtle"
            size="xs"
          >
            +{{ issue.labels.length - 3 }}
          </UBadge>
        </div>
      </div>
    </div>
  </button>
</template>

<style scoped>
.issue-item {
  /* Smooth transition for selection state */
  transition: background-color 150ms ease, box-shadow 150ms ease;
}

.issue-item.selected {
  /* Left accent border for selected item */
  box-shadow: inset 3px 0 0 0 var(--ui-border-accented);
}

/* Reduced motion preference */
@media (prefers-reduced-motion: reduce) {
  .issue-item {
    transition: none;
  }
}
</style>
