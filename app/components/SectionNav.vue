<script setup lang="ts">
// 一個區塊的導覽（2026-10-05 從 MacroNav.vue 一般化出來，持股管理是第二個使用者）：同一份清單在 DOM
// 裡有兩份，窄螢幕是換行的膠囊列、寬螢幕是釘選的側欄，純 CSS 決定顯示哪一份。下面是當初在
// MacroNav.vue 寫下的設計理由，原封搬過來——它們講的是這個元件的形狀，不是總經的內容。
//
// 總經特區's own nav. TWO real copies, always both in the SSR HTML, pure CSS decides which is
// visible — the same "duplicate, don't relocate" arrangement StockPageNav.vue settled on (see its
// own top comment for why a Teleport is not an option: Vue's SSR genuinely does not render
// Teleport content into an in-app named target, measured).
//
// The desktop copy became a pinned rail 2026-09-22（「macro-nav 能做成sidebar嗎」）, replacing a
// single wrapping pill row that was all this component used to be. The original reasoning for that
// row — recorded here at the time — was that this zone is flat（seven siblings, no groups, no
// depth）and so had no need for the stock pages' rail. That argument was about the DEPTH of the
// list and it still holds; what it missed is the LAYOUT: layouts/default.vue reserves
// --app-sidebar-width on every page at ≥1280px unconditionally, whether or not anything occupies
// it（see its own comment）, so these seven pages were rendering a 240px empty gutter and then
// spending content-column width on a pill row. The rail costs nothing that was not already
// reserved, and a visitor comparing indicators can switch between them without scrolling back up.
//
// The narrow copy stays a wrapping pill row rather than becoming a vertical list（which is what
// StockPageNavList does at that width）: seven short labels wrap into two or three compact rows,
// where a vertical list would push the page's own first heading most of a screen down. That
// difference is exactly why the two-copy split lives in each nav component rather than in
// AppNavRail.vue — the rail owns its chrome, the caller owns what its narrow layout should be.
//
// Real <a href> on every destination, for the reason AppNavMenu.vue records: el-menu's router mode
// emits no anchors at all, and scripts/check-click-depth.mjs walks these hrefs to prove every
// sitemap URL is reachable. That is also why the rail copy is a plain list rather than the el-menu
// StockPageNavList uses — el-menu buys nested groups and expand/collapse state, and a flat list of
// seven has neither.
//
// aria-current="page" comes from vue-router's own exact-active match and is styled with weight +
// underline + background, never colour alone.
//
// No `current` prop: the pages passed one from the day this component was written and nothing ever
// read it — the active state has always come from the router. Dropped 2026-09-22 along with the
// three call sites that were feeding it.
defineProps<{
  // 地標名稱，例如「總經特區」；釘選那份會接上「導覽（釘選）」
  label: string
  items: { label: string; to: string }[]
}>()
</script>

<template>
  <!-- Narrow widths. The list markup is repeated below rather than extracted into a third
       component: it is five lines, and both copies must exist in the DOM simultaneously. -->
  <nav class="section-nav section-nav--inline" :aria-label="label">
    <ul class="section-nav__list">
      <li v-for="item in items" :key="item.to">
        <NuxtLink :to="item.to" class="section-nav__link">{{ item.label }}</NuxtLink>
      </li>
    </ul>
  </nav>

  <AppNavRail :label="`${label}導覽（釘選）`">
    <nav class="section-nav section-nav--rail" :aria-label="label">
      <ul class="section-nav__list">
        <li v-for="item in items" :key="item.to">
          <NuxtLink :to="item.to" class="section-nav__link">{{ item.label }}</NuxtLink>
        </li>
      </ul>
    </nav>
  </AppNavRail>
</template>

<style scoped>
.section-nav__list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

/* ≥48px targets, this app's own floor for an older audience — above WCAG's 24×24. */
.section-nav__link {
  display: flex;
  align-items: center;
  min-height: 48px;
  padding: 0 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  color: var(--el-text-color-primary);
  text-decoration: none;
}

.section-nav__link[aria-current='page'] {
  font-weight: 700;
  color: var(--el-color-primary-dark-2);
  background: var(--el-color-primary-light-9);
  text-decoration: underline;
  text-underline-offset: 4px;
  text-decoration-thickness: 2px;
}

/* The inline copy hides where the rail takes over, and vice versa — the rail's own
   display:none/flex pair lives in AppNavRail.vue, so only this side needs stating here. */
/* 見 layouts/default.vue 的同一條查詢——平板直向吃手機、橫向吃桌面。八處必須一致。 */
@media (min-width: 1280px), (min-width: 1024px) and (orientation: landscape) {
  .section-nav--inline {
    display: none;
  }
}

@media print {
  .section-nav--inline {
    display: none;
  }
}

/* Rail copy: one full-width row per link, stacked. Drops the pill's border and rounding — inside a
   240px panel those read as seven boxed buttons rather than a list; the active row's own weight,
   underline and background tint carry the state on their own, matching what the el-menu rows in
   StockPageNavList look like beside it. */
.section-nav--rail .section-nav__list {
  flex-direction: column;
  flex-wrap: nowrap;
  gap: 0;
  padding: 8px 0;
}

.section-nav--rail .section-nav__link {
  border: none;
  border-radius: 0;
  padding: 0 20px;
}
</style>
