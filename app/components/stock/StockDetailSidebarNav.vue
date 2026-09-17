<script setup lang="ts">
// 個股瀏覽版 sidebar nav — extracted into its own component 2026-09-17 the same day it was first
// added, once 股息哪裡來/財務報表 got promoted from in-page scroll/mode-switch targets to real
// routes ("整頁滑動的概念完全捨棄...股利怎麼來？他URL是像這樣 stock/2330/新頁面，命名交給你，以利
// SEO。只有Header部分會長相一樣") — every one of these routes (the base /stock/:code page plus the
// new dividend-source/financial-statements pages) needs the exact same 3-item nav, so it's a
// shared component instead of copy-pasted markup per page.
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
// 配股配息 links to the base stock page's own #stock-section-股東回饋 anchor via a plain hash
// NuxtLink — Nuxt's default router scroll behavior handles the hash scroll natively, on this exact
// page (no-op navigation, still scrolls) or from a different one (navigates, then scrolls), so no
// manual scrollIntoView/mode-switch JS is needed here the way the first version of this sidebar
// (see git history) used to need for the two items that have since moved to real routes.
// `.stock-detail-page__section`'s own `scroll-margin-top` (defined in
// pages/stock/[code]/index.vue) already compensates for the fixed header, so the landing position
// is correct either way. Its own active state is keyed off the base path alone (ignoring the
// hash) — matches whenever you're anywhere on /stock/:code, same "which page am I on" granularity
// the other 2 items get from route.path.
const props = defineProps<{ code: string }>()
const route = useRoute()
const isWide = useIsWideLayout()

const NAV_ITEMS = [
  { label: '配股配息', to: (code: string) => `/stock/${code}#stock-section-股東回饋`, activePath: (code: string) => `/stock/${code}` },
  { label: '股息哪裡來', to: (code: string) => `/stock/${code}/dividend-source`, activePath: (code: string) => `/stock/${code}/dividend-source` },
  { label: '財務報表', to: (code: string) => `/stock/${code}/financial-statements`, activePath: (code: string) => `/stock/${code}/financial-statements` }
]

function isActiveItem(item: (typeof NAV_ITEMS)[number]): boolean {
  return route.path === item.activePath(props.code)
}
</script>

<template>
  <ClientOnly>
    <Teleport v-if="isWide" to="#app-pinned-sidebar-target">
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
