<script setup lang="ts">
const route = useRoute()
// One app-shell layout for every width (layouts/default.vue, 2026-09-19 — see its own comment
// for why the former desktop/mobile split, chosen here from a cookie-seeded isWide, re-mounted
// the whole page on every cookie-less first visit). A page can still opt into the standalone
// landing layout via definePageMeta({ layout: 'landing' }) (index.vue, blog, design).
const layoutName = computed(() => (route.meta.layout as 'landing' | undefined) ?? 'default')

// Mounted once, app-wide, so the mode/color → <html> sync (see useAppTheme.ts) is live from
// the very first page regardless of which one that happens to be.
useAppTheme()

// Same reasoning as useAppTheme() immediately above — real bug found live 2026-09-16 while
// verifying 字型大小 on a page other than /appearance: useTextScale()'s own useHead() call only
// ever runs when SOME component actually calls the composable, and it was previously only
// called from appearance.vue itself, so `data-text-scale` never made it onto <html> anywhere
// else in the app (confirmed via Playwright: cookie correctly set to '200', attribute still
// null on /stock/2330). Calling it here, app-wide and exactly once, is what makes the CSS rule
// in main.css (`html[data-text-scale='...']`) actually apply everywhere, not just on the one
// page with the control that changes it — matches why useDashboardCardsSync()/
// useStockDetailPreferencesSync() below both moved here from page components for the same
// "app.vue never unmounts" reason.
//
// `elSize` (added 2026-09-16, see useTextScale.ts's own comment) is fed into <el-config-provider>
// below so it cascades to every Element Plus component's own size prop app-wide, same "call once
// at the root" reasoning as the rem cascade right above it.
const { elSize } = useTextScale()

// Brand suffix on every page title (2026-09-19, SEO groundwork for the stock-detail redesign):
// a page that sets `title: '台積電 2330 公司健檢'` renders as「台積電 2330 公司健檢｜安盈選股」;
// a page that sets no title at all keeps nuxt.config.ts's bare「安盈選股」fallback (which is why
// this is a function, not a '%s｜安盈選股' string — that form would render a dangling
// 「｜安盈選股」for title-less pages). Lives here, app-wide, for the same "app.vue never
// unmounts" reason every other root-level useHead/useTextScale call above does, and because
// nuxt.config.ts's `app.head` can't carry a function. Pages that previously hand-wrote the
// suffix (blog/index, blog/[slug]) dropped it the same day; the landing page opts out via its
// own `titleTemplate: '%s'` since its title already leads with the brand.
// The brand-name check (not just a truthiness check) is load-bearing: nuxt.config.ts's own
// `title: '安盈選股'` fallback is handed to this template as the title chunk for title-less
// pages, which rendered as「安盈選股｜安盈選股」on first try (confirmed live on /screener).
useHead({
  titleTemplate: (title?: string) => (title && title !== '安盈選股' ? `${title}｜安盈選股` : '安盈選股')
})

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
  <el-config-provider :size="elSize">
    <div>
      <NuxtRouteAnnouncer />
      <NuxtLayout :name="layoutName">
        <NuxtPage />
      </NuxtLayout>
      <UserLoginDialog />
      <AppPostLoginLoader />
    </div>
  </el-config-provider>
</template>
