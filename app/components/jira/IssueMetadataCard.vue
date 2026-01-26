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
    class="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 transition-all duration-200"
    :class="{ 
      'border-blue-300 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-900/20': editing && editable,
      'hover:border-neutral-300 dark:hover:border-neutral-600': !editing
    }"
  >
    <p class="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-2 flex items-center gap-1.5 uppercase tracking-wide">
      <UIcon :name="icon" class="w-3.5 h-3.5" />
      {{ label }}
    </p>
    <slot />
  </div>
</template>
