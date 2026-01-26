<script setup lang="ts">
defineProps<{
  icon: string
  label: string
  editable?: boolean
  editing?: boolean
}>()
</script>

<template>
  <div 
    class="metadata-card p-4 bg-[var(--ui-bg-muted)] border border-[var(--ui-border)] transition-all duration-200"
    :class="{ 
      'border-[var(--ui-border-accented)]': editing && editable,
      'hover:border-[var(--ui-border-accented)]': !editing
    }"
  >
    <p class="text-xs font-medium text-[var(--ui-text-muted)] mb-2 flex items-center gap-1.5 uppercase tracking-wide">
      <UIcon :name="icon" class="w-3.5 h-3.5" />
      {{ label }}
    </p>
    <slot />
  </div>
</template>
