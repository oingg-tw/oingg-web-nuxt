<script setup lang="ts">
import zhTw from 'element-plus/es/locale/lang/zh-tw'
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
// page with the control that changes it — the same "app.vue never unmounts" reason the sync
// composables below live here.
//
// `elSize` (added 2026-09-16, see useTextScale.ts's own comment) is fed into <el-config-provider>
// below so it cascades to every Element Plus component's own size prop app-wide, same "call once
// at the root" reasoning as the rem cascade right above it.
const { elSize } = useTextScale()

// zh-tw 語系檔裡 el-table 的無障礙名稱沒翻譯（"Sort by {column}" 等），螢幕閱讀器會念英文。2026-10-08 覆寫。
const elLocale = { ...zhTw, el: { ...zhTw.el, table: { ...zhTw.el.table,
  sortLabel: '依「{column}」排序',
  filterLabel: '篩選「{column}」',
  selectAllLabel: '全選',
  selectRowLabel: '選取這一列',
  expandRowLabel: '展開這一列',
  collapseRowLabel: '收合這一列' } } }

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

// 後端同步的 watcher 一律在這裡註冊（2026-09-09 的真實 bug：註冊在頁面元件上的 watcher 會在離開該頁時被 Vue
// 停掉，存檔因此默默失效；app.vue 不會卸載）。觀察清單 2026-09-28，見 useWatchlistSync.ts。
useWatchlistSync()
// 方案與額度（2026-10-06）。登入時先 GET /users/me 建立帳號（14 天試用從這裡起算），再讀 entitlement。
// 同一條規則：必須在 app.vue。見 useEntitlement.ts。
useEntitlementSync()

// Flips exactly once per browser session, right after the initial SSR hydration finishes —
// see useHasHydrated.ts for what pages use this for and why.
const hasHydrated = useHasHydrated()
onMounted(() => {
  hasHydrated.value = true
})
</script>

<template>
  <el-config-provider :size="elSize" :locale="elLocale">
    <div>
      <NuxtRouteAnnouncer />
      <NuxtLayout :name="layoutName">
        <NuxtPage />
      </NuxtLayout>
      <UserLoginDialog />
      <AppPostLoginLoader />
      <AppLoadFailureDialog />
    </div>
  </el-config-provider>
</template>
