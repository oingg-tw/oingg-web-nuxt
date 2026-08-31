<script setup lang="ts">
const isWide = useIsWideLayout()
const route = useRoute()
// A page can opt out of the desktop/mobile app-shell split entirely via
// definePageMeta({ layout: 'landing' }) (currently just index.vue) — everything else keeps
// picking between the two app-shell layouts by viewport as before.
const layoutName = computed(() => (route.meta.layout as string | undefined) ?? (isWide.value ? 'desktop' : 'mobile'))

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
