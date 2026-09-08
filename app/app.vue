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

// Both moved here 2026-09-09 from the page components that used to call them
// (dashboard.vue/stock/[code].vue) — see useDashboardCardsSync.ts's own comment for the real
// bug this fixes: a watcher registered inside onMounted is tied to the component instance that
// registered it, and gets stopped when that instance unmounts. A page-level component unmounts
// every time the user navigates away from it, silently killing the PUT-on-change sync watcher
// after the user's first visit — this is why saved card-visibility toggles stopped persisting.
// app.vue never unmounts during SPA navigation (same reasoning as useAppTheme() above), so
// registering here instead keeps the sync alive for the whole session.
useDashboardCardsSync()
useStockDetailPreferencesSync()

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
    <AppPostLoginLoader />
  </div>
</template>
