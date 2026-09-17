<script setup lang="ts">
// 個股瀏覽版 sidebar nav — extracted into its own component 2026-09-17 the same day it was first
// added, once 股息哪裡來/財務報表 got promoted from in-page scroll/mode-switch targets to real
// routes ("整頁滑動的概念完全捨棄...股利怎麼來？他URL是像這樣 stock/2330/新頁面，命名交給你，以利
// SEO。只有Header部分會長相一樣"), then 配股配息 itself the same day too ("配股配息url改名
// stock/2330/dividend") — all 3 items are now real routes (/stock/:code/dividend,
// /dividend-source, /financial-statements; the base /stock/:code path itself is no longer one of
// this nav's own destinations), each needing the exact same 3-item nav, so it's a shared component
// instead of copy-pasted markup per page.
//
// Real bug found + fixed 2026-09-17, in two parts:
//
// 1. Every /stock/:code* page crashed CLIENT-SIDE (only, never server-side — SSR/curl always
//    returned a clean page) with a Nuxt-level "Cannot read properties of null (reading
//    'toString')", invisible to every debugging channel tried (server logs, console, pageerror,
//    even CDP's Runtime.exceptionThrown). Root cause: dividend-source.vue/financial-statements.vue
//    used to sit as SIBLINGS of a separate top-level `pages/stock/[code].vue` file — Nuxt's router
//    registered their routes correctly (confirmed via router.getRoutes()) but a soft navigation to
//    either of them rendered stock/[code].vue's own content instead of theirs. Fixed by moving the
//    parent page to the conventional `pages/stock/[code]/index.vue` location, a real sibling of
//    these files inside the SAME directory — not a same-named file sitting next to the directory,
//    which is the layout that triggered the bug.
//
// 2. A second, narrower crash survived that fix: on a first-ever visit (no `layout-wide` cookie
//    yet — see useDeviceLayout.ts), this app briefly renders the MOBILE layout before swapping to
//    desktop once onNuxtReady's matchMedia check resolves; AppPinnedSidebar (and this component's
//    own Teleport target, `#app-pinned-sidebar-target`) doesn't exist in the DOM at all during that
//    window. Teleport only resolves its `to` target once, at mount — it doesn't retry when the
//    target appears later, so teleporting during that mobile-first window left this component in a
//    broken state once the swap to desktop happened. Fixed by gating the whole Teleport on
//    `useIsWideLayout()` (the exact same flag that decides whether AppPinnedSidebar exists at all)
//    so this component simply doesn't attempt to render until its target is guaranteed to be
//    there — confirmed live with a pre-seeded `layout-wide` cookie (no race) and without one
//    (forces the mobile-first window) alike.
//
// ClientOnly (kept alongside the isWide gate) avoids Nuxt's SSR teleport plumbing entirely — same
// reasoning AppHeaderMenu.vue's own el-autocomplete popper comment documents for a different
// teleport case.
//
// `defer` added 2026-09-18 — a narrower version of the SAME race survived the isWide gate above,
// specific to pages whose own setup has an `await` (company-health.vue/metrics-history.vue/
// financial-statements.vue all `await useFilterSchema()`/similar): `isWide` can flip true (Desktop
// layout committed to) slightly BEFORE AppPinnedSidebar's own DOM node actually finishes mounting,
// and an async page's own extra tick before ITS mount is enough to land inside that gap. Vue's own
// `defer` prop on Teleport exists for exactly this — target-is-a-later-sibling-in-the-same-render-
// pass — so it waits for the parent tree's own mount instead of resolving `to` immediately. Found
// live via Playwright's `pageerror` listener on a cold, cookie-less load of company-health.vue:
// "Failed to locate Teleport target" (harmless on its own, non-fatal) then a SECOND, genuinely
// fatal `Cannot read properties of null (reading 'toString')` thrown from INSIDE Vue's own
// `runtime-core`'s warning-formatter (`warn$1` → `Array.map` → `.toString()` on a null prop while
// building that warning's component-stack string) — a real bug in Vue's dev-mode warning path
// itself, not application code, but real damage regardless (an uncaught exception, not just a
// console message). No hash/route difference between pages that showed it (company-health/
// metrics-history/financial-statements) and those that didn't (dividend/dividend-source) — the
// only difference is exactly this await-before-mount timing.
//
// 配股配息 promoted from a hash-anchor NuxtLink to its own real route 2026-09-17 per direct
// request ("配股配息url改名 stock/2330/dividend") — all items are plain routes, each with their own
// `activePath` matching their own `to` exactly (no more hash-vs-path distinction to account for).
// See dividend.vue's own comment for what content actually lives there now (股東回饋 tab's own
// dividend-coverage/growth-rate/chowder-number cards stayed in the tabs system, moved to
// company-health.vue along with the rest of it — this page's content was designed separately, per
// direct clarification "留在tabs機制裡，配股配息頁面內容另外設計").
//
// 指標歷史／公司健檢 added 2026-09-18 per direct request ("summary 上面的 卡片 表格 會計 顯示設定
// 都拔掉。所有卡片一律呈現。卡片 表格 會計 做在sidebar上面。財務報表 (會計) 指標歷史 (表格) 公司
// 健檢 (卡片)") — the three experienceMode branches stock/[code]/index.vue's own mode-picker used
// to switch between (卡片/表格/會計) are now three sidebar destinations instead: financial-
// statements.vue (會計, already existed), metrics-history.vue (表格, new), company-health.vue
// (卡片, new).
const props = defineProps<{ code: string }>()
const route = useRoute()
const isWide = useIsWideLayout()

const NAV_ITEMS = [
  { label: '配股配息', to: (code: string) => `/stock/${code}/dividend` },
  { label: '股息哪裡來', to: (code: string) => `/stock/${code}/dividend-source` },
  { label: '財務報表', to: (code: string) => `/stock/${code}/financial-statements` },
  { label: '指標歷史', to: (code: string) => `/stock/${code}/metrics-history` },
  { label: '公司健檢', to: (code: string) => `/stock/${code}/company-health` }
]

function isActiveItem(item: (typeof NAV_ITEMS)[number]): boolean {
  return route.path === item.to(props.code)
}
</script>

<template>
  <ClientOnly>
    <Teleport v-if="isWide" defer to="#app-pinned-sidebar-target">
      <nav class="stock-detail-sidebar-nav" aria-label="個股瀏覽導覽">
        <NuxtLink
          v-for="item in NAV_ITEMS"
          :key="item.label"
          :to="item.to(props.code)"
          class="stock-detail-sidebar-nav__item"
          :class="{ 'is-active': isActiveItem(item) }"
        >
          {{ item.label }}
        </NuxtLink>
      </nav>
    </Teleport>
  </ClientOnly>
</template>

<style scoped>
/* Teleported into AppPinnedSidebar's own `#app-pinned-sidebar-target` (see this file's own
   top-of-script comment) — that target is scoped to AppPinnedSidebar.vue, not this file, so its
   own flex:1/overflow rules apply to the wrapping shell, but these item styles still need to live
   HERE (this component's own scoped block), same reasoning already documented elsewhere in this
   app for teleported content (AppHeaderMenu.vue's own popper rules) — a scoped :deep() rule
   written in AppPinnedSidebar.vue would carry ITS data-v-* attribute, which teleported content
   from this file never receives. */
.stock-detail-sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 16px 12px;
}

.stock-detail-sidebar-nav__item {
  display: flex;
  align-items: center;
  padding: 10px 12px;
  border-radius: 8px;
  color: var(--el-text-color-primary);
  font-size: 1rem;
  font-weight: 600;
  text-decoration: none;
}

.stock-detail-sidebar-nav__item:hover {
  background: var(--el-fill-color-light);
}

.stock-detail-sidebar-nav__item.is-active {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}
</style>
