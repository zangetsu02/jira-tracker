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

const isStatusOpen = computed(() => {
  const s = props.issue.status?.toLowerCase()
  return s === 'aperto' || s === 'open' || s === 'to do'
})

const isStatusProgress = computed(() => {
  const s = props.issue.status?.toLowerCase()
  return s === 'in progress' || s === 'in corso'
})

const isStatusDone = computed(() => {
  const s = props.issue.status?.toLowerCase()
  return s === 'done' || s === 'chiuso' || s === 'resolved'
})
</script>

<template>
  <button
    type="button"
    class="jira-issue-item w-full text-left"
    :class="[
      selected ? 'jira-issue-item--selected' : '',
      focused && !selected ? 'jira-issue-item--focused' : ''
    ]"
    :aria-current="selected ? 'true' : undefined"
    @click="$emit('select', issue.key)"
  >
    <!-- Header -->
    <div class="jira-issue-item__header">
      <span class="jira-issue-item__key">{{ issue.key }}</span>
      <span
        class="jira-issue-item__status"
        :class="{
          'jira-issue-item__status--open': isStatusOpen,
          'jira-issue-item__status--progress': isStatusProgress,
          'jira-issue-item__status--done': isStatusDone
        }"
      >
        <span class="jira-issue-item__status-dot" />
        {{ issue.status }}
      </span>
    </div>

    <!-- Summary -->
    <p class="jira-issue-item__summary" :title="issue.summary">
      {{ issue.summary }}
    </p>

    <!-- Labels -->
    <div v-if="issue.labels?.length" class="jira-issue-item__tags">
      <span 
        v-for="label in issue.labels.slice(0, 3)" 
        :key="label"
        class="jira-issue-item__tag"
      >
        {{ label }}
      </span>
      <span v-if="issue.labels.length > 3" class="jira-issue-item__tag jira-issue-item__tag--more">
        +{{ issue.labels.length - 3 }}
      </span>
    </div>

    <!-- Footer -->
    <div class="jira-issue-item__footer">
      <div class="jira-issue-item__meta">
        <!-- Priority -->
        <span 
          v-if="issue.priority" 
          class="jira-issue-item__priority-badge"
          :class="`jira-issue-item__priority-badge--${issue.priority?.toLowerCase()}`"
        >
          <UIcon :name="getPriorityIcon(issue.priority)" class="w-3 h-3" />
          <span>{{ issue.priority }}</span>
        </span>
        <!-- Assignee -->
        <span 
          v-if="getAssigneeName(issue.assignee)" 
          class="jira-issue-item__assignee"
        >
          <UAvatar
            :src="getAssigneeAvatar(issue.assignee)"
            :alt="getAssigneeName(issue.assignee) || ''"
            size="3xs"
          />
          <span class="truncate">{{ getAssigneeName(issue.assignee) }}</span>
        </span>
      </div>
      <!-- Updated -->
      <span class="jira-issue-item__time">
        <UIcon name="i-lucide-clock" class="w-3 h-3" />
        <time :datetime="issue.updated">{{ formatRelativeDate(issue.updated) }}</time>
      </span>
    </div>
  </button>
</template>

<style scoped>
.jira-issue-item {
  display: block;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--ui-border);
  transition: all 0.15s ease;
  position: relative;
}

.jira-issue-item::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: var(--ui-info);
  transform: scaleY(0);
  transition: transform 0.2s ease;
}

.jira-issue-item:hover {
  background: var(--ui-bg-muted);
}

.jira-issue-item:hover::before {
  transform: scaleY(1);
}

.jira-issue-item--selected {
  background: var(--ui-bg-accented);
}

.jira-issue-item--selected::before {
  transform: scaleY(1);
  background: var(--ui-info);
}

.jira-issue-item--focused {
  background: var(--ui-bg-muted);
}

.jira-issue-item:focus-visible {
  outline: none;
  box-shadow: inset 0 0 0 2px var(--ui-border-accented);
}

.jira-issue-item__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
}

.jira-issue-item__key {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--ui-info);
  background: var(--ui-info-soft);
  padding: 0.25rem 0.5rem;
}

.jira-issue-item__status {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.625rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  padding: 0.1875rem 0.375rem;
  background: var(--ui-bg-muted);
  color: var(--ui-text-muted);
}

.jira-issue-item__status-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: currentColor;
}

.jira-issue-item__status--open {
  background: var(--ui-info-soft);
  color: var(--ui-info);
}

.jira-issue-item__status--progress {
  background: var(--ui-warning-soft);
  color: var(--ui-warning);
}

.jira-issue-item__status--done {
  background: var(--ui-success-soft);
  color: var(--ui-success);
}

.jira-issue-item__summary {
  font-size: 0.8125rem;
  color: var(--ui-text);
  line-height: 1.4;
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.jira-issue-item__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
  margin-top: 0.625rem;
}

.jira-issue-item__tag {
  display: inline-flex;
  align-items: center;
  font-size: 0.625rem;
  font-weight: 500;
  padding: 0.1875rem 0.5rem;
  background: var(--ui-bg-muted);
  color: var(--ui-text-muted);
  border: 1px solid var(--ui-border);
  transition: all 0.15s ease;
}

.jira-issue-item:hover .jira-issue-item__tag {
  background: var(--ui-bg-accent);
  border-color: var(--ui-border-accented);
}

.jira-issue-item__tag--more {
  background: transparent;
  color: var(--ui-text-dimmed);
  border-style: dashed;
}

.jira-issue-item__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 0.75rem;
  gap: 0.5rem;
}

.jira-issue-item__meta {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  font-size: 0.6875rem;
  color: var(--ui-text-dimmed);
  min-width: 0;
}

.jira-issue-item__priority-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.625rem;
  font-weight: 600;
  padding: 0.1875rem 0.5rem;
  background: var(--ui-bg-muted);
  color: var(--ui-text-muted);
}

.jira-issue-item__priority-badge--highest {
  background: var(--ui-error-soft);
  color: var(--ui-error);
}

.jira-issue-item__priority-badge--high {
  background: var(--ui-error-soft);
  color: var(--ui-error);
}

.jira-issue-item__priority-badge--medium {
  background: var(--ui-warning-soft);
  color: var(--ui-warning);
}

.jira-issue-item__priority-badge--low {
  background: var(--ui-success-soft);
  color: var(--ui-success);
}

.jira-issue-item__priority-badge--lowest {
  background: var(--ui-bg-muted);
  color: var(--ui-text-muted);
}

.jira-issue-item__assignee {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  max-width: 120px;
}

.jira-issue-item__time {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.6875rem;
  color: var(--ui-text-dimmed);
}

/* Reduced motion preference */
@media (prefers-reduced-motion: reduce) {
  .jira-issue-item,
  .jira-issue-item::before {
    transition: none;
  }
}
</style>
