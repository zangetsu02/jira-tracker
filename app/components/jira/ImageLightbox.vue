<script setup lang="ts">
const props = defineProps<{
  src: string
  alt?: string
}>()

const isOpen = defineModel<boolean>('open', { default: false })

const close = () => {
  isOpen.value = false
}

// Close on escape key
const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    close()
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="isOpen"
        class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm"
        @click.self="close"
      >
        <!-- Close button -->
        <button
          type="button"
          class="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 text-white transition-colors"
          @click="close"
        >
          <UIcon name="i-lucide-x" class="w-6 h-6" />
        </button>

        <!-- Image container -->
        <Transition
          enter-active-class="transition duration-300 ease-out"
          enter-from-class="opacity-0 scale-90"
          enter-to-class="opacity-100 scale-100"
          leave-active-class="transition duration-200 ease-in"
          leave-from-class="opacity-100 scale-100"
          leave-to-class="opacity-0 scale-90"
        >
          <div v-if="isOpen" class="relative max-w-[90vw] max-h-[90vh]">
            <img
              :src="src"
              :alt="alt || 'Image'"
              class="max-w-full max-h-[90vh] object-contain shadow-2xl border border-white/10"
            />
            
            <!-- Alt text / filename -->
            <p v-if="alt" class="absolute -bottom-8 left-0 right-0 text-center text-sm text-white/70 font-mono">
              {{ alt }}
            </p>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>
