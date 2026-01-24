<script setup lang="ts">
const { loggedIn, user, signOut } = useAuth()

const clickSignOut = () => {
  signOut({ redirectTo: '/sign-in' })
}

const route = useRoute()

const navigation = [
  { to: '/', icon: 'i-lucide-home', label: 'Dashboard' },
  { to: '/analysis', icon: 'i-lucide-search', label: 'Analisi' },
  { to: '/settings', icon: 'i-lucide-settings', label: 'Settings' }
]

const isActiveRoute = (to: string) => {
  if (to === '/') return route.path === '/'
  return route.path.startsWith(to)
}
</script>

<template>
  <div class="min-h-screen bg-[var(--ui-bg)] flex">
    <NuxtRouteAnnouncer />
    <NuxtLoadingIndicator color="var(--ui-primary)" />

    <!-- Sidebar -->
    <aside class="w-16 min-h-screen bg-[var(--ui-bg)] border-r border-[var(--ui-border)] flex flex-col fixed z-50">
      <!-- Logo -->
      <div class="h-16 flex items-center justify-center border-b border-[var(--ui-border)]">
        <UTooltip
          text="Jira Checker"
          :delay-open="0"
        >
          <div class="w-9 h-9 bg-[var(--ui-primary)] rounded-lg flex items-center justify-center shadow-sm">
            <UIcon
              name="i-lucide-check-square"
              class="w-5 h-5 text-[var(--ui-bg)]"
            />
          </div>
        </UTooltip>
      </div>

      <!-- Navigation -->
      <nav class="flex-1 py-4 flex flex-col items-center gap-1">
        <UTooltip
          v-for="item in navigation"
          :key="item.to"
          :text="item.label"
          :delay-open="0"
          side="right"
        >
          <NuxtLink
            :to="item.to"
            class="w-10 h-10 flex items-center justify-center rounded-lg transition-all duration-200"
            :class="isActiveRoute(item.to)
              ? 'bg-[var(--ui-bg-elevated)] text-[var(--ui-text)] shadow-sm'
              : 'text-[var(--ui-text-muted)] hover:bg-[var(--ui-bg-elevated)] hover:text-[var(--ui-text)]'"
          >
            <UIcon
              :name="item.icon"
              class="w-5 h-5"
            />
          </NuxtLink>
        </UTooltip>
      </nav>

      <!-- User section -->
      <div class="py-4 flex flex-col items-center gap-2 border-t border-[var(--ui-border)]">
        <UColorModeButton
          size="xs"
          color="neutral"
          variant="ghost"
        />

        <UTooltip
          v-if="loggedIn"
          :text="user?.email || 'Logout'"
          :delay-open="0"
          side="right"
        >
          <UButton
            color="neutral"
            variant="ghost"
            size="sm"
            class="w-9 h-9 rounded-full p-0"
            @click="clickSignOut"
          >
            <UAvatar
              :text="user?.email?.[0]?.toUpperCase() || 'U'"
              size="xs"
            />
          </UButton>
        </UTooltip>
      </div>
    </aside>

    <!-- Main content -->
    <main class="flex-1 ml-16">
      <div class="max-w-6xl mx-auto px-8 py-8">
        <slot />
      </div>
    </main>
  </div>
</template>
