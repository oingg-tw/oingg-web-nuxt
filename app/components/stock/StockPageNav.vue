<script setup lang="ts">
// 個股頁面導覽 — the links between /stock/:code's own sub-pages (the list itself is
// StockPageNavList.vue). Two homes, one component:
//
// - Server-rendered, in the page body, on EVERY width: that is the `#fallback` below — what a
//   crawler and a no-JS visitor get, in DOM order right after the summary card. (The previous
//   desktop-only sidebar was `<ClientOnly>` + `<Teleport v-if="isWide">` and therefore never in
//   the SSR HTML at all, and absent on mobile entirely.)
// - After hydration on a wide viewport (≥1280px, useIsWideLayout's live matchMedia value), the
//   same list is teleported into the desktop rail (AppPinnedSidebar.vue's
//   `#app-pinned-sidebar-target`) as a vertical column — per direct decision 2026-09-19（「我本來
//   想的是 stock-page-nav 那一排會用 sidebar 呈現」）. On narrower viewports the Teleport is
//   `disabled`, which renders the list in place, i.e. exactly where the fallback was. The rail
//   element exists on every width since layouts/default.vue (hidden by CSS below 1280px), so the
//   target is always there; resizing across the breakpoint moves the list live.
//
// Tab order on desktop follows the visual order — header → rail (these links) → page content —
// because layouts/default.vue mounts the rail between the header and <main>.
//
// Static, not sticky, in the body; the rail is fixed on its own. 股息哪裡來 is no longer a page of
// its own (merged into 配股配息 2026-09-19); /f-score is deliberately not listed while it's a pilot
// (shared/utils/f-score-pilot.ts) — it's linked from 公司健檢's 獲利品質 section instead.
const props = defineProps<{ code: string }>()

const isWide = useIsWideLayout()
</script>

<template>
  <ClientOnly>
    <Teleport to="#app-pinned-sidebar-target" :disabled="!isWide">
      <StockPageNavList :code="props.code" :vertical="isWide" />
    </Teleport>
    <template #fallback>
      <StockPageNavList :code="props.code" />
    </template>
  </ClientOnly>
</template>
