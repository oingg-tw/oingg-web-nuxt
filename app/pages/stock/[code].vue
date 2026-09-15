<script setup lang="ts">
import { GURU_CATEGORY_ICON } from '~/utils/guru-badges'
import type { Stock } from '~/composables/stock/useStocks'

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
// Now built from real per-symbol sources instead: useStockSummary (GET /stocks/{symbol}, bff-ts's
// real quote endpoint) for price/valuation, useCompanyProfile (already real, just recoupled from
// the fake universe — see that composable's own comment) for the company name, and
// useDailyPriceHistory for change/changePercent/volume — see below. No dependency on
// useStockUniverse()/MOCK_STOCK_UNIVERSE left on this page at all.
const { data: summary, pending: summaryPending } = useStockSummary(code)
const { data: profile, pending: profilePending } = useCompanyProfile(code)

// Real bug fixed 2026-09-14 (reported live: "打2330出404") — this used to read change/
// changePercent/volume straight off useStockSummary's own response, assuming a `/summary`
// endpoint+shape that was invented, not real (see useStockSummary.ts's own comment); bff-ts's
// actual GET /stocks/{symbol} never had those 3 fields at all, so the fetch simply 404'd for
// EVERY symbol, not just 2330. Real change/volume come from the daily OHLCV history instead
// (limit 2 — just enough to diff the latest close against the prior day's), the same data source
// StockPriceRevenueChart.vue's own price history already uses elsewhere on this page.
const { data: priceHistory } = useDailyPriceHistory(code, ref(2))
const priceChange = computed<{ amount: number; percent: number; volume: number } | null>(() => {
  const entries = priceHistory.value
  if (!entries || entries.length < 2) return null
  const latest = entries[entries.length - 1]!
  const previous = entries[entries.length - 2]!
  if (previous.close === 0) return null
  const amount = latest.close - previous.close
  return { amount, percent: (amount / previous.close) * 100, volume: latest.volume }
})

// A quote response with no `price` section means analysis-ts has no usable quote for this symbol
// at all — same "not found" treatment as a genuinely wrong code, since there's nothing left to
// show on this page's own summary card either way. valuation is allowed to be individually null
// (a real, narrower backfill gap) — Stock's own per/pbr/dividendYield fields are nullable for
// exactly this, formatStockValue() renders '－' for those. change/changePercent/volume/marketCapB
// are ALWAYS potentially null now too (see Stock's own comment in useStocks.ts) — marketCapB has
// no real backend source at all right now.
const stock = computed<Stock | undefined>(() => {
  const price = summary.value?.price
  if (!price) return undefined
  const valuation = summary.value?.valuation ?? null
  return {
    code: code.value,
    name: profile.value?.name ?? code.value,
    price: price.close,
    change: priceChange.value?.amount ?? null,
    changePercent: priceChange.value?.percent ?? null,
    per: valuation?.peRatio ?? null,
    pbr: valuation?.pbRatio ?? null,
    dividendYield: valuation?.dividendYield ?? null,
    volume: priceChange.value?.volume ?? null,
    marketCapB: null
  }
})
// StockBetaComparisonChart.vue's own card title/legend/tooltip need a SHORT display name (per
// direct example "台積電股價 vs 加權指數"), not stock.name's full legal registered name (e.g.
// "台灣積體電路製造股份有限公司") — that full name was the actual root cause of a 2026-09-14
// ECharts legend overlap bug report (see StockBetaComparisonChart.vue's own comment). Reuses
// NormalizedCompanyProfile's own `shortName` field, already fetched by useCompanyProfile but
// unused everywhere else in this app until now — falls back to the full name/code, same
// "graceful degrade" convention as every other derived field on this page.
const stockShortName = computed(() => profile.value?.shortName ?? stock.value?.name ?? code.value)

// True while either fetch is still in flight AND neither has resolved a usable `stock` yet —
// guards the not-found el-result below from flashing on first paint the same way preferred-
// stocks/[code].vue's own three-way pending/not-found/found branch already does (see that file's
// own comment: a plain `v-if="!stock"` alone can't distinguish "still loading" from "genuinely
// doesn't exist" once this became a real async fetch instead of a synchronous array lookup).
const stockPending = computed(() => !stock.value && (summaryPending.value || profilePending.value))

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

const { cardDefs, categories, visibleCardIds, isVisible } = useStockCards()
// Real bug found live 2026-09-10: StockGuruBadgeCategoryCard.vue's own `formulaLatex` lookup
// (via useFilterSchema()) got stuck permanently serving the offline mock schema — 7 sibling
// category cards all called useAsyncData('filter-schema', ...) simultaneously on mount, and
// that race left the shared cache holding the fallback instead of the real fetch result (same
// key screener.vue awaits once at its own page root without this problem — a single caller
// never races itself). Awaiting it once here, before any of those children mount, resolves the
// real schema into the shared cache first so every child's own (still-present, now harmless)
// call is a guaranteed cache hit instead of a fresh race.
await useFilterSchema()
const { data: exDividendNotices } = useExDividendNotices(computed(() => (stock.value ? [stock.value.code] : [])))

const { watchlistCodes, addStock, removeStock } = useStocks()
const isFavorite = computed(() => !!stock.value && watchlistCodes.value.includes(stock.value.code))

function toggleFavorite() {
  if (!stock.value) return
  if (isFavorite.value) {
    removeStock(stock.value.code)
  } else {
    addStock(stock.value.code)
  }
}

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
  router.push({ query: { ...route.query, mode: newMode } })
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

// Page restructured 2026-09-10 from 7 stacked <section>s (股東回饋→公司資訊, one below the
// other) into real tabs — per direct request ("個股瀏覽，要引入分頁...真正的分頁") after the
// page grew to 30+ cards across those 7 categories over the course of today's build-out, making
// the old scroll-through-everything layout unwieldy. Explicitly NOT capsule/segmented buttons
// (asked directly, user chose real tabs) and NOT the "顯示卡片" picker popover (that's a
// separate, still-unchanged mechanism for toggling individual cards on/off within whichever
// category tab is open). Defaults to the first category — StockGuruBadgeCard stays outside/
// above the tabs entirely, unaffected by this (see its own comment below for why).
// Real bug fixed 2026-09-10 (reported live: "不能存 tab 的偏好了" → clarified via AskUserQuestion:
// "上次打開的那個分頁沒記住") — this was a plain component-local `ref`, so it reset to the first
// category every time this page component remounted (any navigation away and back, including
// switching stocks). Promoted to `useState` so it survives for the rest of the browser session/
// SPA navigation, matching visibleCardIds' own useState pattern in useStockCards.ts — one global
// "last viewed category" preference, not per-symbol, same scope as mode/visibleCardIds. NOT yet
// synced to bff-ts's GET/PUT /users/me/stock-detail-preferences (that contract only has
// mode/visibleCardIds today, no third field) — this fixes "doesn't survive navigating around the
// site," a genuinely different bug from "doesn't survive a fresh sign-in on another device,"
// which would need a backend schema change as a follow-up if actually wanted.
//
// Real follow-up bug fixed 2026-09-10 (reported live: "個股切換tab的時候網址也要變，這樣我重新
// 整理以後還是原本那個tab而不是回到第一個tab") — useState alone only survives client-side SPA
// navigation, not an actual page reload (a fresh page load re-runs this file's own setup from
// scratch with useState back at its default). Now also mirrored into the URL's own `tab` query
// param — read once on initial load (falls back to the useState value, then the first category,
// same priority order as before this fix) and kept in sync via the watcher below. `replace`
// (not `push`) so switching tabs doesn't spam the browser's back-button history with one entry
// per click — the URL is there for reload/share/bookmark, not for back-navigation between tabs.
const initialCategoryFromQuery = typeof route.query.tab === 'string' && (categories as readonly string[]).includes(route.query.tab)
  ? route.query.tab
  : undefined
const activeCategory = useState('stock-detail-active-category', () => initialCategoryFromQuery ?? categories[0])
if (initialCategoryFromQuery) activeCategory.value = initialCategoryFromQuery

watch(activeCategory, newCategory => {
  router.replace({ query: { ...route.query, tab: newCategory } })
})

// Per direct follow-up ("分頁要有 Icon") — same icon assignments MoleculeIndicatorPickerBody.vue
// already uses for the 6 shared financial-analysis dimensions in the screener's own category
// picker (CATEGORY_ICONS_BY_KEY there, keyed by the backend's english category key rather than
// the Chinese label used here). Moved into guru-badges.ts's own GURU_CATEGORY_ICON 2026-09-10
// (see that file's own comment) once guru-indicators.vue's nav row also needed this exact same
// mapping — one shared map instead of two that could quietly drift apart.
const TAB_ICONS = GURU_CATEGORY_ICON

// Per-category badge fraction ("2/3") shown beside each tab label — reported live 2026-09-14
// ("Tab 右邊要顯示徽章達成的數字 比如 2/3"). Each StockGuruBadgeCategoryCard instance writes its
// own already-computed fraction here as it resolves (see useGuruBadgeCategoryFractions.ts's own
// comment); this page just reads it back per tab, no separate fetch of its own.
const categoryFractions = useGuruBadgeCategoryFractions()
</script>

<template>
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
      <StockSummaryCard :stock="stock" :website="profile?.website ?? null" :is-favorite="isFavorite" @toggle-favorite="toggleFavorite">
        <template #actions>
          <StockDetailActions
            v-model:visible-card-ids="visibleCardIds"
            :card-defs="cardDefs"
            :categories="categories"
          />
        </template>
      </StockSummaryCard>

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
        <div>
          <StockHistoricalStatisticsTable :symbol="stock.code" />
          <template v-if="isVisible('profile')">
            <StockProfileCard v-if="profile" :profile="profile" class="stock-detail-page__profile" />
            <StockProfileCardShell v-else class="stock-detail-page__profile" />
          </template>
        </div>
      </template>

      <template v-else-if="experienceMode === 'CARD' && hasHydrated && preferencesReady" key="cards">
      <!-- Section order/grouping matches STOCK_CARD_CATEGORIES in useStockCards.ts — 6
           financial-analysis dimensions (per direct request "卡片分成六區 獲利能力 成長動能
           財物安全 市場評價 獲利品質 股利與現金流", replacing the old 3-way 估值河流圖/財務數據/
           公司資訊 split, where 財務數據 had become an 8-card catch-all that didn't say why
           those cards belonged together) plus 公司資訊 last, unchanged — background info isn't
           a financial-analysis dimension, was never part of the bucket being split. Order/two
           labels changed same day per direct follow-up ("順序變更 股東回饋獲利品質 獲利能力
           成長動能 財務韌性 市場評價") — 股利與現金流→股東回饋, 財務安全→財務韌性, same card
           membership as before. Reuses the same <section> + __section-title convention and 8pt
           spacing tokens already established in dashboard.vue/ky-stocks.vue (not reinvented
           here).

           本益比河流圖/本淨比河流圖/四季 EPS wired 2026-09-07 to bff-ts's real GET
           /stocks/:symbol/metric-history, proxying analysis-ts's own endpoint — only 2330 is
           backfilled as of this date, every other symbol shows the component's own empty
           state rather than a fabricated chart. The two river cards are
           StockValuationRiverChart.vue (price-space: 股價 line over EPS/BVPS × multiple
           bands — see its own comment for why the earlier ratio-with-percentile-envelope
           version was the wrong chart), EPS stays on StockMetricHistoryChart.vue.
           月營收年增率 wired the same day to bff-ts's real GET
           /stocks/:symbol/monthly-revenue-history (see StockRevenueChart.vue's own comment) —
           also 2330-only, and a one-time manual backfill rather than a daily pipeline, so this
           won't silently grow new symbols/months on its own. 下次除權息 (ex-dividend) still
           awaits its own per-stock endpoint and keeps showing StockExDividendCardShell. Was
           previously rendered with seeded-random mock data that looked like a real analysis;
           per explicit product direction, an unbacked chart shows a structure-only shell
           instead of fabricating numbers to fill the layout. The 近5年/近10年 window on the
           real charts reflects docs/investment-knowledge/基本面財報觀察年限分析.md's argument
           for a multi-year valuation-multiple window (the CAPE/Shiller logic) — no longer
           decorative, each tab re-fetches with limit=20/40 (=5/10 years, one entry per quarter)
           for the quarterly charts, or slices client-side at 60/120 months for the monthly
           revenue chart (see that composable's own comment for why it doesn't refetch per tab).

           特別股評價 (docs/investment-knowledge/特別股評價注意事項.md) is out of scope here: this page only covers
           the common-stock universe (useStockUniverse) — preferred stocks are
           preferred-stocks.vue's own concern. -->
      <div>
      <el-tabs v-model="activeCategory" type="border-card" class="stock-detail-page__tabs">
        <!-- Tab-pane order here is a hardcoded, manually-maintained sequence — NOT derived from
             STOCK_CARD_CATEGORIES/FINANCIAL_ANALYSIS_DIMENSIONS at runtime (there's no v-for
             looping over that array). Real bug found live 2026-09-10 ("我沒看到營運周轉的tab" /
             checking why 市場評價 wasn't actually first despite reordering that constant): the
             constant only drives the "顯示卡片" picker's own grouping order and activeCategory's
             default value, NOT this template's rendered tab order, so the two can silently drift
             apart exactly like every other "two independently-ordered lists" bug this session
             has already hit (see FINANCIAL_ANALYSIS_DIMENSIONS's own comment for the screener's
             prior instance of this). Moving 市場評價 first here, per direct request, is a manual
             edit to THIS sequence — reordering the constant again alone would silently do
             nothing, the same trap that just happened. -->
        <el-tab-pane
          v-if="
            isVisible('guru-badges-市場評價') ||
            isVisible('per-river') ||
            isVisible('pbr-river') ||
            isVisible('price-history') ||
            isVisible('beta-comparison') ||
            isVisible('ev-multiples') ||
            isVisible('yield-family')
          "
          label="市場評價"
          name="市場評價"
        >
          <template #label>
            <el-icon><component :is="TAB_ICONS['市場評價']" /></el-icon>
            <span class="stock-detail-page__tab-label-row">
              市場評價
              <span v-if="categoryFractions['市場評價']" class="stock-detail-page__tab-fraction">{{ categoryFractions['市場評價'] }}</span>
            </span>
          </template>
          <div class="stock-detail-page__grid">
            <StockGuruBadgeCategoryCard v-if="isVisible('guru-badges-市場評價')" class="stock-detail-page__grid-badge" :symbol="stock.code" category="市場評價" />
            <!-- 股價與月營收 stays right after the badge card, ahead of every other 市場評價 card
                 below — per direct request 2026-09-14 ("不過在市場評價這個tab，月營收是優先的");
                 keep this position if more cards are ever inserted above it. -->
            <StockPriceRevenueChart v-if="isVisible('price-history')" :symbol="stock.code" />
            <!-- Placed right after 股價與月營收 (per direct request 2026-09-15, "股價與月營收 他的
                 右邊放 股價 vs 加權指數") so the two sit side-by-side in the 2-col grid, instead of
                 after the river charts. -->
            <StockBetaComparisonChart v-if="isVisible('beta-comparison')" :symbol="stock.code" :name="stockShortName" />
            <StockValuationRiverChart
              v-if="isVisible('per-river')"
              :symbol="stock.code"
              kind="pe"
              title="本益比河流圖"
              info-text="色帶＝EPS×本益比倍數，線為股價"
            />
            <StockValuationRiverChart
              v-if="isVisible('pbr-river')"
              :symbol="stock.code"
              kind="pb"
              title="本淨比河流圖"
              info-text="色帶＝每股淨值×本淨比倍數，線為股價"
            />
            <StockEvMultiplesCard v-if="isVisible('ev-multiples')" :symbol="stock.code" />
            <StockYieldFamilyCard v-if="isVisible('yield-family')" :symbol="stock.code" />
          </div>
        </el-tab-pane>

        <el-tab-pane
          v-if="
            isVisible('guru-badges-股東回饋') ||
            isVisible('dividend-info') ||
            isVisible('dividend-coverage') ||
            isVisible('dividend-growth-rate') ||
            isVisible('chowder-number')
          "
          label="股東回饋"
          name="股東回饋"
        >
          <template #label>
            <el-icon><component :is="TAB_ICONS['股東回饋']" /></el-icon>
            <span class="stock-detail-page__tab-label-row">
              股東回饋
              <span v-if="categoryFractions['股東回饋']" class="stock-detail-page__tab-fraction">{{ categoryFractions['股東回饋'] }}</span>
            </span>
          </template>
          <div class="stock-detail-page__grid">
            <StockGuruBadgeCategoryCard v-if="isVisible('guru-badges-股東回饋')" class="stock-detail-page__grid-badge" :symbol="stock.code" category="股東回饋" />
            <template v-if="isVisible('dividend-info')">
              <StockDividendInfoCard v-if="exDividendNotices" :symbol="stock.code" :notices="exDividendNotices[code] ?? []" />
              <StockDividendInfoCardShell v-else />
            </template>
            <StockDividendCoverageChart v-if="isVisible('dividend-coverage')" :symbol="stock.code" />
            <StockDividendGrowthRateCard v-if="isVisible('dividend-growth-rate')" :symbol="stock.code" />
            <StockChowderNumberChart v-if="isVisible('chowder-number')" :symbol="stock.code" />
          </div>
        </el-tab-pane>

        <el-tab-pane
          v-if="
            isVisible('guru-badges-獲利品質') ||
            isVisible('dupont-factor-levels') ||
            isVisible('cash-earnings') ||
            isVisible('accruals-quality')
          "
          label="獲利品質"
          name="獲利品質"
        >
          <template #label>
            <el-icon><component :is="TAB_ICONS['獲利品質']" /></el-icon>
            <span class="stock-detail-page__tab-label-row">
              獲利品質
              <span v-if="categoryFractions['獲利品質']" class="stock-detail-page__tab-fraction">{{ categoryFractions['獲利品質'] }}</span>
            </span>
          </template>
          <div class="stock-detail-page__grid">
            <StockGuruBadgeCategoryCard v-if="isVisible('guru-badges-獲利品質')" class="stock-detail-page__grid-badge" :symbol="stock.code" category="獲利品質" />
            <StockDupontFactorLevelChart v-if="isVisible('dupont-factor-levels')" :symbol="stock.code" />
            <StockCashEarningsChart v-if="isVisible('cash-earnings')" :symbol="stock.code" />
            <StockAccrualsQualityChart v-if="isVisible('accruals-quality')" :symbol="stock.code" />
          </div>
        </el-tab-pane>

        <el-tab-pane
          v-if="
            isVisible('guru-badges-獲利能力') ||
            isVisible('eps') ||
            isVisible('roe') ||
            isVisible('roa') ||
            isVisible('margins') ||
            isVisible('fama-french-profitability')
          "
          label="獲利能力"
          name="獲利能力"
        >
          <template #label>
            <el-icon><component :is="TAB_ICONS['獲利能力']" /></el-icon>
            <span class="stock-detail-page__tab-label-row">
              獲利能力
              <span v-if="categoryFractions['獲利能力']" class="stock-detail-page__tab-fraction">{{ categoryFractions['獲利能力'] }}</span>
            </span>
          </template>
          <div class="stock-detail-page__grid">
            <StockGuruBadgeCategoryCard v-if="isVisible('guru-badges-獲利能力')" class="stock-detail-page__grid-badge" :symbol="stock.code" category="獲利能力" />
            <StockMetricHistoryChart
              v-if="isVisible('eps')"
              :symbol="stock.code"
              metric-code="eps"
              title="EPS"
              chart-type="bar"
              unit="元"
              info-text="每股盈餘（單季或近四季合計）"
              source-label="公開發行公司財務報表"
            />
            <StockMetricHistoryChart
              v-if="isVisible('roe')"
              :symbol="stock.code"
              metric-code="roe"
              title="ROE"
              chart-type="line"
              unit="%"
              info-text="股東權益報酬率＝稅後淨利÷股東權益"
              source-label="公開發行公司財務報表"
            />
            <StockMetricHistoryChart
              v-if="isVisible('roa')"
              :symbol="stock.code"
              metric-code="roa"
              title="ROA"
              chart-type="line"
              unit="%"
              info-text="資產報酬率＝稅後淨利÷總資產"
              source-label="公開發行公司財務報表"
            />
            <StockMarginsChart v-if="isVisible('margins')" :symbol="stock.code" />
            <StockFamaFrenchProfitabilityChart v-if="isVisible('fama-french-profitability')" :symbol="stock.code" />
          </div>
        </el-tab-pane>

        <el-tab-pane
          v-if="
            isVisible('guru-badges-成長動能') ||
            isVisible('eps-growth-decomposition') ||
            isVisible('equity-growth-decomposition') ||
            isVisible('sue')
          "
          label="成長動能"
          name="成長動能"
        >
          <template #label>
            <el-icon><component :is="TAB_ICONS['成長動能']" /></el-icon>
            <span class="stock-detail-page__tab-label-row">
              成長動能
              <span v-if="categoryFractions['成長動能']" class="stock-detail-page__tab-fraction">{{ categoryFractions['成長動能'] }}</span>
            </span>
          </template>
          <div class="stock-detail-page__grid">
            <StockGuruBadgeCategoryCard v-if="isVisible('guru-badges-成長動能')" class="stock-detail-page__grid-badge" :symbol="stock.code" category="成長動能" />
            <StockGrowthDecompositionChart v-if="isVisible('eps-growth-decomposition')" :symbol="stock.code" kind="eps" />
            <StockGrowthDecompositionChart v-if="isVisible('equity-growth-decomposition')" :symbol="stock.code" kind="equity" />
            <StockSueChart v-if="isVisible('sue')" :symbol="stock.code" />
          </div>
        </el-tab-pane>

        <el-tab-pane
          v-if="
            isVisible('guru-badges-財務韌性') ||
            isVisible('liquidity') ||
            isVisible('leverage') ||
            isVisible('debt-coverage') ||
            isVisible('bank-capital')
          "
          label="財務韌性"
          name="財務韌性"
        >
          <template #label>
            <el-icon><component :is="TAB_ICONS['財務韌性']" /></el-icon>
            <span class="stock-detail-page__tab-label-row">
              財務韌性
              <span v-if="categoryFractions['財務韌性']" class="stock-detail-page__tab-fraction">{{ categoryFractions['財務韌性'] }}</span>
            </span>
          </template>
          <div class="stock-detail-page__grid">
            <StockGuruBadgeCategoryCard v-if="isVisible('guru-badges-財務韌性')" class="stock-detail-page__grid-badge" :symbol="stock.code" category="財務韌性" />
            <StockLiquidityChart v-if="isVisible('liquidity')" :symbol="stock.code" />
            <StockLeverageChart v-if="isVisible('leverage')" :symbol="stock.code" />
            <StockDebtCoverageChart v-if="isVisible('debt-coverage')" :symbol="stock.code" />
            <StockBankCapitalChart v-if="isVisible('bank-capital')" :symbol="stock.code" />
          </div>
        </el-tab-pane>

        <el-tab-pane
          v-if="
            isVisible('guru-badges-營運周轉') ||
            isVisible('turnover-ratio') ||
            isVisible('cash-conversion-cycle') ||
            isVisible('asset-utilization') ||
            isVisible('capex-intensity')
          "
          label="營運周轉"
          name="營運周轉"
        >
          <template #label>
            <el-icon><component :is="TAB_ICONS['營運周轉']" /></el-icon>
            <span class="stock-detail-page__tab-label-row">
              營運周轉
              <span v-if="categoryFractions['營運周轉']" class="stock-detail-page__tab-fraction">{{ categoryFractions['營運周轉'] }}</span>
            </span>
          </template>
          <div class="stock-detail-page__grid">
            <StockGuruBadgeCategoryCard v-if="isVisible('guru-badges-營運周轉')" class="stock-detail-page__grid-badge" :symbol="stock.code" category="營運周轉" />
            <StockTurnoverRatioChart v-if="isVisible('turnover-ratio')" :symbol="stock.code" />
            <StockCashConversionCycleChart v-if="isVisible('cash-conversion-cycle')" :symbol="stock.code" />
            <StockAssetUtilizationChart v-if="isVisible('asset-utilization')" :symbol="stock.code" />
            <StockCapexIntensityChart v-if="isVisible('capex-intensity')" :symbol="stock.code" />
          </div>
        </el-tab-pane>

        <!-- Renamed 公司資訊 → 大戶籌碼 2026-09-10 per direct request ("Tab 公司資訊 改為 大戶籌碼")
             — 外資持股比例變化 moved in from 市場評價 the same day ("外資持股比例變化 卡片移過去
             大戶籌碼" — this is the closest thing this site has to real 大戶籌碼/institutional-
             holder data), and the guru-badges slot every other tab already has was added too.
             股本變化 (StockShareCapitalChart) removed entirely 2026-09-14 — see useStockCards.ts's
             own comment: mops-ts dropped the capitalStock domain its data came from. -->
        <el-tab-pane
          v-if="isVisible('guru-badges-大戶籌碼') || isVisible('foreign-shareholding')"
          label="大戶籌碼"
          name="大戶籌碼"
        >
          <template #label>
            <el-icon><component :is="TAB_ICONS['大戶籌碼']" /></el-icon>
            <span class="stock-detail-page__tab-label-row">
              大戶籌碼
              <span v-if="categoryFractions['大戶籌碼']" class="stock-detail-page__tab-fraction">{{ categoryFractions['大戶籌碼'] }}</span>
            </span>
          </template>
          <div class="stock-detail-page__grid">
            <StockGuruBadgeCategoryCard v-if="isVisible('guru-badges-大戶籌碼')" class="stock-detail-page__grid-badge" :symbol="stock.code" category="大戶籌碼" />
            <StockForeignShareholdingChart v-if="isVisible('foreign-shareholding')" :symbol="stock.code" />
          </div>
        </el-tab-pane>
      </el-tabs>

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

/* Needs an explicit height for v-loading's spinner overlay to have somewhere to center in —
   an empty div collapses to 0 height otherwise and the spinner never appears. */
.stock-detail-page__cards-loading {
  min-height: 240px;
}

/* Replaced the old 7-stacked-<section> layout 2026-09-10 (see this file's own script-side
   comment on activeCategory) — each category is now an el-tab-pane instead of a <section>, so
   __section/__section-title are gone; the grid inside each pane reuses the exact same
   __grid rules below unchanged. */
.stock-detail-page__tabs :deep(.el-tabs__content) {
  padding-top: 16px;
}

/* Sticky tab strip — added 2026-09-14 per direct request ("個股瀏覽 tabs 要可以貼頂，用戶才好
   切換分頁") — pins right beneath the app-shell header/banner AND StockSummaryCard.vue's own
   sticky bar (--app-stock-summary-bar-height, 0 when that bar isn't showing yet), same "measure,
   don't guess" ResizeObserver-driven var stack every other sticky element on this page already
   uses (see AppPinnedSidebar.vue/StockHistoricalStatisticsTable.vue for the same calc() chain).
   position: sticky (not fixed) — stays in normal document flow so nothing below it needs a
   compensating top margin/padding, the same reasoning StockSummaryCard.vue's own sticky bar
   comment gives. Targets .el-tabs__header specifically (not the whole .el-tabs__content or the
   outer border-card shell) — only the nav strip itself should pin, the tab panels underneath
   must keep scrolling normally. z-index 4, one below StockSummaryCard's own sticky bar (5) and
   the app-shell header/banner (10) — this strip renders below both of those, never over them. */
.stock-detail-page__tabs :deep(.el-tabs__header) {
  position: sticky;
  top: calc(var(--app-header-height) + var(--app-banner-height) + var(--app-stock-summary-bar-height));
  z-index: 4;
  border-radius: 12px 12px 0 0;
  overflow: hidden;
}

.stock-detail-page__tabs :deep(.el-tabs__content) {
  border-radius: 0 0 12px 12px;
  overflow: hidden;
}

/* 會計模式的期別選擇列跟三大財報卡片之間原本零間距，兩者直接貼在一起（回報：「這邊間距抓一下，
   靠太緊了」）——StockPeriodSelector.vue 自己沒有下邊距，這個 wrapper div 本來也只是純粹為了
   Transition 需要單一根節點才加的，沒特別加過間距。 */
.stock-detail-page__accounting {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* 卡片視圖↔會計視圖切換轉場，per docs/3_audiences/前端工程師/個股瀏覽/整體設計.md 3.4節
   ("建議採用淡入淡出而非滑動位移，因為兩者是完全不同的頁面形態...滑動位移會暗示這是同一組內容
   的延伸") — 這兩種視圖確實是完全不同的資料呈現方式（卡片 vs 原始財報三表），之前是瞬間切換無
   轉場，改成 200ms 淡入淡出，比文件建議的下限略短，避免在捲動重置（見 script 端 watch）同時發生
   時讓使用者等待感疊加。 */
.stock-detail-page__mode-fade-enter-active,
.stock-detail-page__mode-fade-leave-active {
  transition: opacity 200ms ease;
}

.stock-detail-page__mode-fade-enter-from,
.stock-detail-page__mode-fade-leave-to {
  opacity: 0;
}

/* Per direct follow-up ("分頁要有 Icon" then "icon在上，文字在下") — el-tab-pane's #label slot
   content is a plain inline flow by default (icon and text side by side), overridden here to
   stack vertically. el-tabs__item itself also needs a taller fixed height to fit two lines
   without the tab bar's own row clipping the text. */
/* Per direct follow-up ("分頁等寬佔滿顯示空間") — el-tabs' nav has no built-in stretch-to-fill
   mode (that's tab-heavy component libraries' "justified" variant, which Element Plus doesn't
   ship), so the nav row and each item are forced into an equal-width flex layout here instead. */
/* gap removed per direct follow-up ("tab之間的間距請移除。現在已經有顏色區隔了。") — the
   per-item border-right divider (added right after the gap turned out to have zero visible
   effect anyway) already separates adjacent tabs, so the gap is redundant now. */
.stock-detail-page__tabs :deep(.el-tabs__nav) {
  display: flex;
  width: 100%;
}

/* Per direct follow-up ("Tab也請幫我圓角") — border-card is square-cornered by default; rounded
   to match this page's own 12px card convention (every el-card here already uses it). Rounds
   the outer border-card shell (header+content together, so the tab strip and the panel below it
   read as one continuous rounded block) rather than each tab item individually. overflow:hidden
   is required for the radius to actually clip the header's own flat top edge.

   A subsequent Chrome-tab-inspired pass (jagged trapezoid tab tops, transparent header/shell,
   per-item borders, 8px gap) was tried and explicitly reverted 2026-09-10 ("我放棄，回到這個
   版本") — this whole-shell-rounded, uniform-background look is the one that stuck.

   `overflow: hidden` moved OFF this outer shell and onto `.el-tabs__header`/`.el-tabs__content`
   individually 2026-09-14, while adding the sticky tab strip above — position:sticky only works
   if EVERY ancestor up to the scrolling container has overflow:visible; overflow:hidden here
   was silently breaking the header's own sticky positioning (confirmed live: getBoundingClientRect
   showed it scrolling off with the page instead of pinning). Splitting the clip onto each half
   separately (header's own top corners, content's own bottom corners) keeps the identical visual
   result without needing the outer shell to clip anything. */
.stock-detail-page__tabs.el-tabs--border-card {
  border-radius: 12px;
}

.stock-detail-page__tabs :deep(.el-tabs__item) {
  flex: 1;
  height: auto;
  min-height: 68px;
  padding-top: 8px;
  padding-bottom: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

/* Real bug fixed 2026-09-10 (reported live: "tab與tab之間視覺是連在一起的") — the 4px `gap` on
   .el-tabs__nav above has zero visible effect: every inactive item is transparent, so the gap
   between two inactive tabs shows the exact same header background as the items themselves,
   making the whole row read as one continuous strip (confirmed by a zoomed screenshot — no
   dividing line anywhere except around the one active tab). A thin divider between adjacent
   items (last child excluded, so there's no stray line after 公司資訊) gives every tab a real
   visible boundary regardless of active state, without reintroducing full per-tab
   borders/boxes (that was the Chrome-tab pass, already reverted).

   Color corrected same day (reported live: "這個線的明顯度絕對不可能過AA標準") — the first attempt
   used --el-border-color-lighter (#ebeef5), measured live against this tab strip's own ~#f5f7fa
   background at only ~1.07:1, nowhere near WCAG 1.4.11's 3:1 non-text floor (every one of
   Element Plus's own border-color-* tokens tops out around 1.3:1 here — none of them were ever
   designed to hit AA contrast on their own against a near-white surface). Switched to
   --el-text-color-placeholder (#67696d, ~4.9:1) — passed AA but then reported live as "很突兀"
   (too heavy/jarring) once seen next to the rest of the page's own subtle borders. Landed on a
   literal #8f8f8f instead — deliberately hand-tuned to sit just above the 3:1 non-text floor
   (not the stricter 4.5:1 text floor a divider doesn't need to clear) rather than reusing an
   existing token: measured live at ~3.0:1 against this card's light-theme background and ~4.9:1
   against its dark-theme one (both comfortably ≥3:1), a visibly softer line than the placeholder
   token gave while still real, verified AA — not just matching the page's own decorative
   ~1.2:1 border color, which was confirmed too low to use here. */
.stock-detail-page__tabs :deep(.el-tabs__item:not(:last-child)) {
  border-right: 1px solid #8f8f8f;
}

/* Per direct request ("請確保TAB設計符合AA標準") — measured live (Playwright + WCAG relative-
   luminance formula) that Element Plus's own default tab-item color fails AA: inactive tabs at
   3.77:1 (its own regular/secondary-tier text token, meant for hints, not primary nav labels)
   and even the ACTIVE tab at 4.12:1 (this site's own accent gold — already used for icons/
   borders elsewhere where the non-text 3:1 UI-component floor applies, but a tab's own visible
   LABEL is text, so it needs the stricter 4.5:1 text floor and this accent doesn't clear it).
   Both states forced to --el-text-color-primary (12.4:1 against this card's near-white
   background, this app's own already-audited high-contrast token) — the active/inactive
   distinction still reads clearly from border-card's own gold top border + lifted background,
   which only need to clear the non-text 3:1 floor and already do. */
.stock-detail-page__tabs :deep(.el-tabs__item),
.stock-detail-page__tabs :deep(.el-tabs__item.is-active) {
  color: var(--el-text-color-primary);
}

.stock-detail-page__tabs :deep(.el-tabs__item .el-icon) {
  font-size: 26px;
  margin-bottom: 4px;
  color: var(--el-text-color-primary);
}

/* Added 2026-09-14 (reported live: "Tab 右邊要顯示徽章達成的數字 比如 2/3") — the category name
   and its fraction need to sit on the SAME row, not each become their own row in this tab's own
   column flex layout (icon row, then whatever text nodes/elements come after it, each a separate
   flex item) — wrapping both in one span keeps the tab exactly 2 rows tall (icon, then name+
   fraction) instead of growing to 3. */
.stock-detail-page__tab-label-row {
  display: inline-flex;
  align-items: baseline;
  gap: 4px;
}

.stock-detail-page__tab-fraction {
  font-size: 16px;
  font-weight: 600;
  color: var(--el-color-primary);
}

/* Fixed 2-column grid per direct request ("grid 一律改成 一個row兩cols") — was
   repeat(auto-fit, minmax(380px, 1fr)), which could land on 1/2/3 columns depending on
   viewport width; now always exactly 2 regardless of width, EXCEPT the mobile override below
   ("如果是手機板，每個row只會有一張卡片" — 2 columns on a phone-width screen squeezes every
   chart too narrow to read). Same 600px breakpoint dashboard.vue's own grid already collapses
   at (not reinvented here).

   Gap widened 16px→24px per docs/3_audiences/前端工程師/個股瀏覽/整體設計.md 1.2節 ("卡片內外距
   比例：至少2倍差") — el-card's own default body padding is ~20px, so a 16px gap was actually
   SMALLER than each card's own internal padding, the exact inverse of the rule (gap must clearly
   exceed padding for cards to read as separate via pure proximity, without needing a divider
   line). Not pushed all the way to the doc's literal 32px — that's tuned for a page with no other
   density constraint; this page already has 6-8 cards per tab and a retiree audience sensitive to
   scroll depth (see 2.3節), so 24px is a real step toward the 2x principle without measurably
   deepening the scroll per tab. */
.stock-detail-page__grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 24px;
}

/* Per direct request ("個股瀏覽如果變成寬螢幕顯示，卡片變成容許三個columns"), fixed to a
   CONTAINER query 2026-09-14 after a first viewport-@media version wrongly triggered 3 columns
   in centered (non-滿版) mode too — see .stock-detail-page's own `container-type: inline-size`
   comment for that first root-cause. The container-query fix ALSO first shipped at threshold
   1440px (matching --app-content-max-width) and STILL broke the same way (reported live again:
   "現在非滿版也變成三欄了") — confirmed live via getBoundingClientRect(): centered mode's
   container renders at EXACTLY 1440px (the cap itself), which satisfies `min-width: 1440px`
   trivially the moment the window is wide enough for centered content to reach its own ceiling —
   an off-by-one-cap bug, not a container-vs-viewport-query bug. 1600px is comfortably ABOVE
   1440px with real margin, so centered mode's container (which can never structurally exceed the
   1440px cap regardless of how wide the actual monitor is) can never satisfy this threshold —
   only 滿版顯示 mode on a genuinely wide window can. Below this container width (including every
   narrower desktop size down to 600px) the grid stays 2 columns; the 600px mobile override
   further down still wins at its own narrower range. .stock-detail-page__grid-badge's own
   `grid-column: 1 / -1` needs no change here — it already spans however many columns exist. */
@container (min-width: 1600px) {
  .stock-detail-page__grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

/* Per direct request ("徽章卡片改為占用兩個columns") — StockGuruBadgeCategoryCard.vue's own
   badge rows (已達成/未達成/未知 3 groups, each wrapping a variable number of chips) read
   cramped squeezed into one half of the 2-column grid alongside every other single-column card;
   spanning both columns gives the chip rows the full row width to wrap into instead. Applied via
   a class on each of the 8 call sites (attrs fallthrough lands it on the component's own root
   <el-card>) rather than a :first-child-style structural selector, since which card is "first"
   in a tab's grid isn't guaranteed once a card gets hidden by the 顯示設定 picker. */
.stock-detail-page__grid-badge {
  grid-column: 1 / -1;
}

/* Persistent 公司基本資訊 card, moved outside the tabs 2026-09-10 (see its own template comment)
   — same top margin the tabs themselves use below the summary card above, so it reads as its
   own section rather than crowding directly under whichever tab's content is currently shown. */
.stock-detail-page__profile {
  margin-top: 16px;
}

/* Base rule above must come before this override — same-specificity CSS falls back to source
   order, so an override placed before its base rule loses to it at every viewport regardless
   of which @media condition matches (see dashboard.vue's own grid for the same note). */
@media (max-width: 600px) {
  .stock-detail-page__grid {
    grid-template-columns: 1fr;
  }

  /* Real bug fixed 2026-09-10 (reported live: "tabs要注意手機版") — the desktop
     flex:1/width:100% rules above force all 8 tabs into equal, ever-shrinking widths as the
     viewport narrows; confirmed live at 375px only 3 of 8 tabs (市場評價/股東回饋/獲利品質) were
     even visible, with the remaining 5 silently clipped by the shell's own overflow:hidden —
     no scrollbar, no arrow, no hint they existed at all. Considered replicating
     PresetFolder.vue's own "active item pinned 2nd, neighbors peek + fade" pattern (per direct
     suggestion), but that component's peek/fade machinery is built around its own add/rename/
     drag-reorder features this fixed 8-category tab strip doesn't need.

     First tried Element Plus's own native click-arrow scroll mode (giving items their natural
     width so el-tabs auto-detects the overflow and injects nav-prev/nav-next buttons) — reverted
     per direct follow-up ("你與其弄左右slide，不如乾脆讓用戶scroll") in favor of plain touch/
     swipe scrolling instead.

     Making `.el-tabs__nav-wrap` itself the scroll container (overflow-x:auto there) turned out
     NOT to work despite looking right on paper — confirmed live (Playwright, reading
     scrollWidth/clientWidth directly) that nav-wrap's scrollWidth stayed stuck exactly equal to
     its clientWidth no matter what was tried on IT (block, flex, with/without the nav's own
     transform reset), even though `.el-tabs__nav` inside it measured a real 841px. The fix that
     actually works: make `.el-tabs__nav` ITSELF the scrollable element instead — give it a
     constrained width (100%, not its natural content width) and put overflow-x:auto directly on
     it, so its own flex children scroll within it rather than asking an ancestor to notice they
     overflow. nav-wrap's own overflow stays at its Element Plus default (hidden) since it no
     longer needs to do anything. */
  .stock-detail-page__tabs :deep(.el-tabs__nav) {
    width: 100%;
    max-width: 100%;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    transform: none !important;
  }

  .stock-detail-page__tabs :deep(.el-tabs__nav-prev),
  .stock-detail-page__tabs :deep(.el-tabs__nav-next) {
    display: none;
  }

  .stock-detail-page__tabs :deep(.el-tabs__item) {
    flex: 0 0 auto;
    min-width: 84px;
  }
}
</style>
