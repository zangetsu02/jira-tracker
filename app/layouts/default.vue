<script setup lang="ts">
const { loggedIn, user, signOut } = useAuth()

const clickSignOut = () => {
  signOut({ redirectTo: '/sign-in' })
}

const route = useRoute()

const navigation = [
  { to: '/', icon: 'i-lucide-layout-dashboard', label: 'Dashboard' },
  { to: '/jira', icon: 'i-simple-icons-jira', label: 'Jira Issues' },
  { to: '/prompts', icon: 'i-lucide-file-text', label: 'Prompt' },
  { to: '/settings', icon: 'i-lucide-settings-2', label: 'Impostazioni' }
]

const isActiveRoute = (to: string) => {
  if (to === '/') return route.path === '/'
  return route.path.startsWith(to)
}

const currentTime = ref('')
const updateTime = () => {
  currentTime.value = new Date().toLocaleTimeString('it-IT', {
    hour: '2-digit',
    minute: '2-digit'
  })
}

onMounted(() => {
  updateTime()
  setInterval(updateTime, 1000)
})
</script>

<template>
  <div class="min-h-screen bg-[var(--ui-bg)]">
    <NuxtRouteAnnouncer />
    <NuxtLoadingIndicator color="var(--accent)" />

    <!-- Sidebar -->
    <aside
      class="fixed left-0 top-0 bottom-0 w-[var(--sidebar-width)] bg-[var(--ui-bg-elevated)] border-r border-[var(--ui-border)] flex flex-col z-50"
    >
      <!-- Logo -->
      <div class="h-[var(--header-height)] flex items-center justify-center border-b border-[var(--ui-border)]">
        <NuxtLink
          to="/"
          class="group"
        >
          <div
            class="w-10 h-10 bg-[var(--ui-text)] flex items-center justify-center transition-transform duration-200 group-hover:scale-105"
          >
            <UIcon
              name="i-lucide-scan-search"
              class="w-5 h-5 text-[var(--ui-bg)]"
            />
          </div>
        </NuxtLink>
      </div>

      <!-- Navigation -->
      <nav class="flex-1 py-6 flex flex-col items-center gap-2">
        <UTooltip
          v-for="item in navigation"
          :key="item.to"
          :text="item.label"
          :delay-open="0"
          side="right"
        >
          <NuxtLink
            :to="item.to"
            class="relative w-11 h-11 flex items-center justify-center transition-all duration-200"
            :class="isActiveRoute(item.to)
              ? 'bg-[var(--ui-text)] text-[var(--ui-bg)]'
              : 'text-[var(--ui-text-muted)] hover:bg-[var(--ui-bg-muted)] hover:text-[var(--ui-text)]'"
          >
            <UIcon
              :name="item.icon"
              class="w-5 h-5"
            />
          </NuxtLink>
        </UTooltip>
      </nav>

      <!-- Bottom Section -->
      <div class="py-6 flex flex-col items-center gap-3 border-t border-[var(--ui-border)]">
        <!-- Time -->
        <div class="text-[10px] font-mono text-[var(--ui-text-dimmed)] tracking-wider">
          {{ currentTime }}
        </div>

        <!-- Theme Toggle -->
        <UColorModeButton
          size="sm"
          color="neutral"
          variant="ghost"
          class="w-11 h-11"
        />

        <!-- User Avatar -->
        <UTooltip
          v-if="loggedIn"
          :text="`Logout (${user?.email})`"
          :delay-open="0"
          side="right"
        >
          <button
            class="w-11 h-11 flex items-center justify-center bg-[var(--ui-bg-muted)] hover:bg-[var(--ui-bg-accent)] transition-colors duration-200"
            @click="clickSignOut"
          >
            <span class="text-sm font-medium text-[var(--ui-text)]">
              {{ user?.email?.[0]?.toUpperCase() || 'U' }}
            </span>
          </button>
        </UTooltip>
      </div>
    </aside>

    <!-- Main Content -->
    <main class="ml-[var(--sidebar-width)] h-screen flex flex-col">
      <div class="flex-1 min-h-0 px-6 py-6 lg:px-8 lg:py-6 flex flex-col">
        <slot />
      </div>
    </main>
  </div>
</template>
