<script setup lang="ts">

const route = useRoute()
const router = useRouter()

const code = computed(() => String(route.params.code))

// Real bug fixed 2026-09-14 (reported live: "summary-card 殖利率 1.6% 與 股利資訊卡片的 0.91%
// 對不起來") — `stock` used to come from getStockByCode(useStockUniverse().data, code), and
// useStockUniverse() silently falls back to a hardcoded ~20-stock MOCK_STOCK_UNIVERSE whenever
// GET /api/stocks fails — which it always does, since that endpoint has never existed (see
// useStocks.ts's own comment). 2330's dividendYield was a stale fixture number (1.6), not a real
// one; StockDividendInfoCard.vue's 0.91% was the real one, from an actual metric query. Worse,
// any symbol NOT in that 20-stock list made the whole page show "找不到這檔股票" outright — this
// broke the vast majority of the real market, not just wrong-but-present numbers for a few names.
//
// Extracted into useStockDetailSummary.ts 2026-09-17 ("整頁滑動的概念完全捨棄...只有Header部分會
// 長相一樣") — dividend-source.vue/financial-statements.vue need this exact same StockSummaryCard
// header, so it's a shared composable now instead of only living here; see that file's own
// comment for the full original reasoning (dividendYield/change/volume real-source fixes), all
// unchanged, just relocated. -->
const { stock, profile, stockShortName, stockPending, isFavorite, toggleFavorite } = useStockDetailSummary(code)

// StockRevenueToDividendBridge (股利怎麼來？) removed from this page's own persistent card
// stack 2026-09-17, moved to its own route (dividend-source.vue) per direct request
// ("整頁滑動的概念完全捨棄"). See that page's own comment and this card's git history for the
// full on/off/on saga this flag used to track — no longer needed here.

// Self-referencing canonical, always pointing at the bare `/stock/{code}` path with no query
// string — added 2026-09-12 per the SEO governance research doc's own requirement that view-
// state query params (this page's `mode`/`tab`, both written via router.replace further below)
// not be left to accidentally get indexed as separate pages from the real canonical one. No
// existing module here does this automatically (@nuxtjs/robots/@nuxtjs/sitemap don't touch
// per-page <link rel="canonical">), so it's set by hand, matching blog/[slug].vue's own existing
// useRequestURL()-based pattern for building an absolute URL.
const requestUrl = useRequestURL()
useHead({
  link: [{ rel: 'canonical', href: computed(() => `${requestUrl.origin}/stock/${code.value}`) }]
})

const { isVisible } = useStockCards()
// useFilterSchema()/StockGuruBadgeCategoryCard removed from this page entirely 2026-09-17,
// moved to financial-statements.vue along with the rest of tabs機制 (see that file's own comment)
// — nothing left on this page consumes filter-schema data.
// useExDividendNotices()/StockExDividendCard removed the same day too — moved to dividend.vue
// along with StockDividendStabilityCard (see that page's own comment) — nothing left on this
// page consumes ex-dividend notices either.

// Own three-way mode (卡片/表格/會計), NOT shared with dashboard.vue's two-way novice/pro toggle
// — see useStockExperienceMode.ts's own comment for why. The toggle control itself lives in
// StockDetailActions.vue as its own always-visible radio-group (moved back out of the 顯示設定
// dialog 2026-09-12 per direct request; 'TABLE' added between the other two 2026-09-13) — this
// page only reads the mode to decide what to render.
//
// Mirrored into the URL's own `mode` query param 2026-09-10 per direct request ("卡片模式與會計
// 模式的切換 也要做成網頁參數 這樣上一頁的時候才會回到原地") — same treatment, same reasoning,
// as activeCategory's own `tab` query param just below (useState alone survives SPA navigation
// but not a real reload, and carries no information for the browser's own back/forward history
// to restore).
//
// Switched from `replace` to `push` 2026-09-14 (reported live: "希望從 表格切過去 會計，再上一頁
// 可以回到 表格呈現頁，現在他會跳回去Dashboard") — `replace` was a deliberate original choice
// ("toggling the mode itself doesn't need its own back-button undo step"), but that meant every
// mode switch overwrote the SAME history entry, so pressing back from 會計模式 skipped past
// every mode this page had ever been in and landed on whatever page was open before this one
// (e.g. Dashboard) — including the 表格模式→會計模式 jump StockIndicatorAuditTable's audit-chain
// link performs (jumpToStatementRow in useStatementRowFocus.ts also just sets this same
// `experienceMode` ref). `push` gives each mode switch its own back-button step, at the cost of
// growing history one entry per switch — accepted tradeoff per the direct request above.
//
// A `push` alone only writes the URL forward; the browser's own back/forward buttons change the
// URL out from under this ref without touching it, so a second watcher (below) reads any EXTERNAL
// `mode` change back into `experienceMode` — without it, pressing back would change the address
// bar but leave the page still rendering whatever mode was active before. Guarded by comparing
// against the CURRENT route so the two watchers don't loop: this second watcher setting
// `experienceMode` re-fires the first one, which sees `route.query.mode` already matches and
// skips its own push.
const { mode: experienceMode } = useStockExperienceMode()
const initialModeFromQuery = route.query.mode === 'CARD' || route.query.mode === 'TABLE' || route.query.mode === 'ACCOUNTING' ? route.query.mode : undefined
if (initialModeFromQuery) experienceMode.value = initialModeFromQuery

watch(experienceMode, newMode => {
  if (route.query.mode === newMode) return
  // `hash` preserved explicitly 2026-09-17 (real bug found: a hash-anchor NuxtLink from
  // StockDetailSidebarNav.vue landing on THIS page, e.g. "#stock-section-股東回饋", got silently
  // wiped the moment this watcher's own router.push fired — vue-router does not carry over the
  // current route's hash into a raw location object unless it's included explicitly, since a
  // query/params-only object is otherwise treated as a fresh location with no hash at all).
  router.push({ query: { ...route.query, mode: newMode }, hash: route.hash })
  // Per docs/3_audiences/前端工程師/個股瀏覽/整體設計.md 3.4節 ("切換後捲動位置重置") — 卡片視圖
  // 與會計視圖的區塊順序完全不同（估值/財務體質/公司資料 vs 損益表/資產負債表/現金流量表），
  // 保留切換前的捲動深度百分比對應不到有意義的位置，維持在原本的捲動位置只會讓使用者看到跟
  // 上一秒毫無關聯的內容。真正的頁面形態轉換，比照該節原則重置回頂部。
  window.scrollTo({ top: 0, behavior: 'smooth' })
})

watch(
  () => route.query.mode,
  newMode => {
    if ((newMode === 'CARD' || newMode === 'TABLE' || newMode === 'ACCOUNTING') && experienceMode.value !== newMode) {
      experienceMode.value = newMode
    }
  }
)

// Sync (GET/PUT /users/me/stock-detail-preferences) moved to app.vue 2026-09-09 — see
// useStockDetailPreferencesSync.ts's own comment for the real bug this fixes (a watcher
// registered inside this page's own onMounted was silently stopped the first time the user
// navigated away, since this component unmounts on route change; app.vue never does).

// Gates the card-mode content below — fixes a reported bug ("個股瀏覽 造訪時 卡片會先都出現
// 再消失 造成畫面抖動"): visibleCardIds' own useState starts as the full default card list, so
// every card rendered on first paint; for a signed-in account with a smaller saved set, the
// preferences fetch above then overwrote it a moment later and the extra cards visibly
// vanished. Also gated on hasHydrated, not just preferencesReady alone — preferencesReady is
// derived from Firebase auth, which resolves asynchronously and unpredictably relative to
// hydration, so a plain v-if on it risks the same "Hydration node mismatch" screener.vue's own
// tabsReady comment already ran into; hasHydrated is false on both server and the client's
// first render regardless, so there's nothing to mismatch during that window.
const preferencesReady = useStockDetailPreferencesReady()
const hasHydrated = useHasHydrated()

</script>

<template>
  <!-- 個股瀏覽版 sidebar — first built 2026-09-17 directly in this file (scroll/mode-switch
       button handlers), then re-architected the SAME day into real per-stock routes per direct
       follow-up ("整頁滑動的概念完全捨棄...股利怎麼來？他URL是像這樣 stock/2330/新頁面，命名交給
       你，以利SEO。只有Header部分會長相一樣") — 股息哪裡來/財務報表 moved out to
       dividend-source.vue/financial-statements.vue as real pages instead of scroll targets/mode
       switches on this one; 配股配息 stays here (no separate route was requested for it) as a
       hash-anchor NuxtLink instead. All 3 items now live in one shared component
       (StockDetailSidebarNav.vue) so every one of these routes renders the identical nav — see
       that component's own comment for the Teleport/ClientOnly mechanics. -->
  <StockDetailSidebarNav :code="code" />

  <div v-loading="stockPending" class="stock-detail-page">
    <!-- Three-way branch (pending/not-found/found), not a plain v-if/v-else pair — same fix
         preferred-stocks/[code].vue already needed for the identical reason (see that file's own
         comment): stock is now a real async fetch (useStockSummary/useCompanyProfile), so a bare
         "找不到這檔股票" would flash on every first paint while those are still in flight, not
         just for a genuinely wrong code. -->
    <template v-if="stockPending" />
    <el-result
      v-else-if="!stock"
      icon="warning"
      title="找不到這檔股票"
      sub-title="請確認股票代號是否正確"
    >
      <template #extra>
        <el-button type="primary" @click="router.push('/')">回首頁</el-button>
      </template>
    </el-result>

    <template v-else>
      <StockSummaryCard :stock="stock" :website="profile?.website ?? null" :is-favorite="isFavorite" :short-name="stockShortName" @toggle-favorite="toggleFavorite" />
      <!-- 顯示設定 (StockDetailActions) 與 tabs機制 (8-category anchor-nav + their cards)
           moved to financial-statements.vue 2026-09-17 per direct request ("請把 顯示設定 以及
           tabs機制，移動到財務報表底下") — see that page's own comment for the full history this
           mechanism carried before the move (tabs enable/disable saga, scroll-spy, etc.), all
           unchanged, just relocated. -->

      <!-- 本益比河流圖／本淨比河流圖 pulled out of the (currently disabled) 市場評價 tab and made
           persistent 2026-09-15 per direct request ("本益比河流圖 本淨比河流圖也抓出來"), then
           moved above 股利資訊 the same day per direct follow-up ("河流圖放上面") — then moved
           BACK into the 市場評價 tab the same day per direct follow-up ("我指令下的不好，請把
           河流圖放回市場評價中") — see that tab-pane's own comment (line ~356). No longer
           persistent, removed from here entirely; only rendered inside the tab now. -->


      <!-- 會計模式's year/quarter picker ("會計模式要有地方可以選擇年分與季度" — corrected from
           an earlier "專家模式" instruction) plus its three-statement tables ("先來三表的表格，
           因為我力求呈現與財報一致"), now wired to bff-ts's real GET
           /stocks/:symbol/financial-statement (confirmed live 2026-09-06 — see
           useFinancialStatement.ts's own comment). Mutually exclusive with the card sections
           below (per direct confirmation "切到會計的時候，所有卡片都要隱藏") — 會計模式 is a
           raw-statement mirror of the actual filing, not another layer stacked on top of the
           card view, so switching to it replaces the page's content instead of prepending to
           it. -->
      <Transition name="stock-detail-page__mode-fade" mode="out-in">
      <template v-if="experienceMode === 'ACCOUNTING'" key="accounting">
        <div class="stock-detail-page__accounting">
          <StockPeriodSelector :symbol="stock.code" />
          <StockFinancialStatementsCard :symbol="stock.code" />
        </div>
      </template>

      <!-- 表格模式 (2026-09-13, "卡片 會計 顯示模式 中間又要把 表格 加上去了") — bridges the two
           other modes: StockHistoricalStatisticsTable.vue shows ROE-family ratios whose values jump
           straight into 會計模式 at the exact filed figure they're computed from ("這些數字才又
           可以指向會計。變成稽核鏈"). Own Transition branch, same "replaces the page's content"
           treatment as 會計模式 above — this isn't a card, it doesn't belong stacked alongside them. -->
      <template v-else-if="experienceMode === 'TABLE'" key="table">
        <!-- Single wrapping div required — <Transition> (see its own tag further up) only
             accepts exactly one child per branch. StockIndicatorTrendChart.vue (指標走勢比較圖) and
             the table's own 圖表 checkbox column REMOVED 2026-09-14 per direct request ("我放棄
             我有點 複雜化了，把 指標走勢比較圖 拿掉。勾選的機制也自然拿掉") — this table is back to
             just plain numbers, no charting affordance ("就讓它是純數字"). -->
        <!-- Same .stock-detail-page__mode-stack fix as the CARD-mode wrapper div below (see its
             own comment) — this div needs the same flex+gap treatment so 公司基本資訊 doesn't
             lose its spacing under the table now that .stock-detail-page__profile's own
             margin-top is gone. -->
        <div class="stock-detail-page__mode-stack">
          <StockHistoricalStatisticsTable :symbol="stock.code" />
          <template v-if="isVisible('profile')">
            <StockProfileCard v-if="profile" :profile="profile" class="stock-detail-page__profile" />
            <StockProfileCardShell v-else class="stock-detail-page__profile" />
          </template>
        </div>
      </template>

      <template v-else-if="experienceMode === 'CARD' && hasHydrated && preferencesReady" key="cards">
      <!-- CARD-mode persistent content — the 8-category tabs system this comment used to
           describe living directly here moved to financial-statements.vue 2026-09-17 (see this
           file's own template-top sidebar comment); this branch now only renders 公司基本資訊
           (below), unconditionally persistent regardless of which category a user last viewed in
           the tabs, same as it was when tabs still lived here. -->
      <!-- Real bug fixed 2026-09-15 (reported live: "公司基本資訊 上緣 間距 不見了" right after
           removing .stock-detail-page__profile's own margin-top above) — this div is a plain
           unstyled Transition-wrapper (Transition needs exactly one child per branch), so once
           REVENUE_TO_DIVIDEND_BRIDGE_ENABLED card and 公司基本資訊 stopped carrying their own
           margin, there was nothing left spacing them apart — the OUTER .stock-detail-page's own
           `gap: 24px` only spaces ITS direct children (this whole div counts as a single one of
           those from the outside), not the elements nested inside it. Giving this div the same
           flex+gap treatment as its parent restores consistent spacing for whatever ends up
           inside it. Tabs used to also live in here (moved out 2026-09-15, see TABS_ENABLED's
           own template comment — "Tabs移到summary下面") — this div's own remaining content is
           just the bridge card + 公司基本資訊 now. -->
      <div class="stock-detail-page__mode-stack">

      <!-- 營收到股利瀑布圖 (StockRevenueToDividendBridge) moved to its own route
           (dividend-source.vue) 2026-09-17, per this page's own template-top sidebar comment —
           no longer rendered here. -->

      <!-- 公司基本資訊 moved out of the 公司資訊 tab 2026-09-10 per direct request ("基本資料卡片
           要搬移。移到整個Footer上面，不隨著分頁切換") — used to disappear whenever a different
           tab was active like every other card here; now renders once, persistently, below every
           tab's own content regardless of which one is selected. Still gated on isVisible so
           unchecking it in 顯示卡片 hides it here too. -->
      <template v-if="isVisible('profile')">
        <StockProfileCard v-if="profile" :profile="profile" class="stock-detail-page__profile" />
        <StockProfileCardShell v-else class="stock-detail-page__profile" />
      </template>
      </div>
      </template>

      <!-- Loading skeleton for the brief window before preferencesReady/hasHydrated resolve —
           see this file's own comment at their declaration for why this exists (avoids every
           card flashing visible-then-hidden while a signed-in account's saved card selection
           is still being fetched). -->
      <template v-else key="loading">
        <div v-loading="true" class="stock-detail-page__cards-loading" />
      </template>
      </Transition>
    </template>
  </div>
</template>

<style scoped>
/* No max-width/margin here on purpose (was a hardcoded 980px, ignoring the toggle entirely)
   — every other page gets its width from desktop.vue/mobile.vue's own .app-shell__inner /
   .app-shell__inner--centered wrapper (the 置中/滿版 switch), so this page should too rather
   than fighting it with a second, independent cap. Reported live ("版面寬度也要幫我調整"). */
/* container-type: inline-size added 2026-09-14 (real bug fixed live: "現在非滿版也變成三欄了")
   — the 3-column grid rule below originally used a viewport @media query, which fires purely off
   window width regardless of how wide this page's own content actually renders. That's wrong for
   this app specifically because 滿版顯示 (full-width) is a user TOGGLE (useContentWidthMode.ts) —
   in centered mode the content area is capped at --app-content-max-width (1440px) by
   app/layouts/desktop.vue's own .app-shell__inner--centered rule regardless of how wide the
   actual window/monitor is, so a viewport query crossing 1440px squeezed 3 columns into a
   container that never actually grew past its own 1440px cap. A container query measures this
   element's own rendered inline-size instead — correctly stays 2-column in centered mode (the
   cap keeps it under the threshold after subtracting sidebar/padding) and only goes 3-column when
   滿版顯示 is on AND the window is genuinely wide enough. */
.stock-detail-page {
  display: flex;
  flex-direction: column;
  gap: 24px;
  container-type: inline-size;
}

/* Same flex+gap as .stock-detail-page itself, added 2026-09-15 for the two plain Transition-
   wrapper divs (TABLE mode's and CARD mode's own, see each one's own template comment) — a bare
   `<div>` has no layout of its own, so anything nested inside it needs its own spacing now that
   .stock-detail-page__profile no longer carries a margin-top (see that class's own comment). */
.stock-detail-page__mode-stack {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* Needs an explicit height for v-loading's spinner overlay to have somewhere to center in —
   an empty div collapses to 0 height otherwise and the spinner never appears. */
.stock-detail-page__cards-loading {
  min-height: 240px;
}

/* .stock-detail-page__section-nav/__section/__grid (the 8-category tabs system's own CSS) moved
   to financial-statements.vue 2026-09-17 along with the rest of tabs機制 (see this file's own
   template-top sidebar comment) — nothing here references those classes any more. */

/* .stock-detail-page__sidebar/__sidebar-item moved into StockDetailSidebarNav.vue's own scoped
   block 2026-09-17, once the sidebar became a shared component instead of markup living directly
   in this file (see this file's own template-top comment) — nothing here references those
   classes any more. */

</style>
