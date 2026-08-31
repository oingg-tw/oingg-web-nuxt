<script setup lang="ts">
const isWide = useIsWideLayout()
const layoutName = computed(() => (isWide.value ? 'desktop' : 'mobile'))

// Mounted once, app-wide, so the mode/color → <html> sync (see useAppTheme.ts) is live from
// the very first page regardless of which one that happens to be.
useAppTheme()

// Flips exactly once per browser session, right after the initial SSR hydration finishes —
// see useHasHydrated.ts for what pages use this for and why.
const hasHydrated = useHasHydrated()
onMounted(() => {
  hasHydrated.value = true
})
</script>

<template>
  <div>
    <NuxtRouteAnnouncer />
    <NuxtLayout :name="layoutName">
      <NuxtPage />
    </NuxtLayout>
    <UserLoginDialog />
  </div>
</template>
