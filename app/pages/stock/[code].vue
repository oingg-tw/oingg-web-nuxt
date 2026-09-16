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

// Tabs disabled 2026-09-15 per direct request ("個股瀏覽的 tabs 與 tabs下轄的卡片 先全部註解")
// ahead of a major interface overhaul, then re-enabled the same day once the tabs themselves
// were rebuilt to the user's own spec (container-less nav, moved under summary, height-capped +
// scrollable content — see the `<template v-if="TABS_ENABLED">` wrapper below for each of those)
// — the cards each tab-pane would render stay hidden separately (see TAB_CARDS_ENABLED just
// below), so re-enabling this only brings the nav bar itself back, not its content. Named
// boolean, not a bare `v-if="false"` literal, for the same reason as every other flag on this
// page: a literal `false` in the template makes vue-tsc lose narrowing on `stock` for everything
// inside the branch (confirmed live: 39 new "possibly undefined" errors even though the branch
// never actually renders).
const TABS_ENABLED = true

// Every card each tab-pane's own grid would render was hidden 2026-09-15 per direct request
// ("原本tabs裡面的卡片請都先幫我隱藏"), re-enabled the same day per direct follow-up ("打開")
// once the "分頁切換無法顯示任何卡片" report turned out to be this flag, not a broken container
// — same named-boolean technique as TABS_ENABLED just above. Gates each tab-pane's own
// `.stock-detail-page__grid` div (8 of them), not the tab-pane itself — the nav item and its own
// `isVisible(...)` visibility logic are untouched either way.
const TAB_CARDS_ENABLED = true

// Toggled off/on/off again 2026-09-15 — hidden ("這張也幫我隱藏"), re-enabled and repositioned
// ("從營收到股利 這張拿出來，放到基本資訊上面"), then reversed into "股利怎麼來？" (see
// StockRevenueToDividendBridge.vue's own comment) and hidden again ("股利怎麼來 那張卡片也隱藏")
// while the interface overhaul is worked out — same named-boolean technique as TABS_ENABLED just
// above (see its own comment for why a literal `false` in the template breaks vue-tsc's
// narrowing of `stock` here). This card sits OUTSIDE the tabs (persistent, not "tabs 下轄"), so
// it keeps its own flag rather than reusing TABS_ENABLED.
const REVENUE_TO_DIVIDEND_BRIDGE_ENABLED = false


// 配息穩定度／下次除權息 made persistent 2026-09-15 ("把 殖利率 相關的卡片 抓出來"), hidden again
// the same day alongside every other persistent card per direct request ("常駐卡片 都先拿掉 有些
// 我要塞回去 container中") — DIVIDEND_CARDS_ENABLED, not reusing isVisible alone, since isVisible
// reflects the user's own 顯示卡片 preference (should stay untouched) while this flag is purely
// about whether this persistent SLOT renders at all right now.
const DIVIDEND_CARDS_ENABLED = false

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

// UX 大改 2026-09-16 per直接要求（"tabs uiux 再大改。tabs 現在提供的是快速滑過去的功能。就是
// 所有的卡片都同時出現，tabs是按下去以後跳到該section"）— el-tabs 原本的「切換顯示」語意換成
// 「錨點跳轉」：8 個分類的卡片全部一次渲染在頁面上（不再用 el-tab-pane 切換隱藏其他分類），上方
// 的 nav 列改成純粹的錨點按鈕，按下去捲動到對應 section，不再控制哪些卡片顯示/隱藏。連帶拿掉
// 今天稍早整套 el-tabs 溢出/箭頭/nav-wrap padding 的修法（見 git 歷史）——那整組修法的存在前提
// 是 el-tabs 自己那套「量測 nav 真實寬度來判斷要不要顯示箭頭」機制，這裡直接用一般的
// overflow-x:auto 水平捲動取代，不再需要那套機制。
//
// activeCategory 現在純粹是「捲動位置目前對應哪個分類」的視覺高亮狀態，不再是 el-tabs 的
// v-model（那個 v-model 原本控制的是「哪個 pane 顯示」，現在全部都顯示，沒有這個切換動作了）——
// 點擊 nav 按鈕先手動設一次（立即反應點擊，不等捲動動畫跑完 observer 才更新），捲動時下面的
// IntersectionObserver 再持續接手更新。
function sectionElementId(category: string): string {
  return `stock-section-${category}`
}

function scrollToSection(category: string) {
  activeCategory.value = category
  document.getElementById(sectionElementId(category))?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

// 每個分類是否有任何卡片可顯示——跟原本個別 el-tab-pane 自己的 v-if 條件完全對應（原封不動搬過
// 來，只是集中成一個 computed，讓 nav 按鈕跟底下的 section 用同一份判斷，不會兩邊各寫一次、之後
// 改一邊忘了改另一邊）。
const categoryVisible = computed<Record<string, boolean>>(() => ({
  市場評價: isVisible('per-river') || isVisible('pbr-river') || isVisible('beta-comparison'),
  股東回饋: isVisible('dividend-coverage') || isVisible('dividend-growth-rate') || isVisible('chowder-number'),
  獲利品質: isVisible('dupont-factor-levels') || isVisible('cash-earnings') || isVisible('accruals-quality'),
  獲利能力: isVisible('eps') || isVisible('roe') || isVisible('roa') || isVisible('margins') || isVisible('fama-french-profitability'),
  成長動能: isVisible('eps-growth-decomposition') || isVisible('equity-growth-decomposition') || isVisible('sue'),
  財務韌性: isVisible('liquidity') || isVisible('leverage') || isVisible('debt-coverage') || isVisible('bank-capital'),
  營運周轉: isVisible('turnover-ratio') || isVisible('cash-conversion-cycle') || isVisible('asset-utilization') || isVisible('capex-intensity'),
  大戶籌碼: isVisible('foreign-shareholding')
}))

// 錨點導覽的順序，跟原本 el-tab-pane 的手動排序完全一致（同一份「市場評價優先」手動順序，不是從
// FINANCIAL_ANALYSIS_DIMENSIONS 跑出來的，理由同原本 comment）。
const SECTION_ORDER = ['市場評價', '股東回饋', '獲利品質', '獲利能力', '成長動能', '財務韌性', '營運周轉', '大戶籌碼'] as const

// Scroll-spy：捲動時自動高亮目前在可視範圍最上方的 section，讓 nav 列的高亮狀態跟著使用者實際
// 看到的內容走，不是只有點擊當下才更新一次（不然往下捲動半頁後，nav 列還停在最後一次點擊的分類，
// 跟畫面內容對不起來）。
//
// 第一版用 IntersectionObserver（rootMargin 上下各留一段，形成一條細帶，落在細帶內的 section
// 才算「可見」）——實測發現一個真的 bug：點 nav 按鈕觸發 scrollIntoView 跳轉後，目的地 section
// 剛好卡在那條細帶的邊界外（量出來的細帶下緣剛好落在 269px，目的地 section 頂端在 271px，差
// 2px 沒被判定成可見），導致高亮還停在上一個 section，跟畫面實際內容對不起來——親自點開驗證過
// 才發現的，不是猜的。
//
// 改用更直接、可預期的作法：捲動時（rAf 節流）直接比較每個 section 自己的 getBoundingClientRect
// 跟一條門檻線——由上到下找「頂端已經滑過門檻線」的最後一個 section，沒有細帶邊界，不會有上面
// 那種差幾 px 就誤判的問題。
//
// 門檻線本身改成動態量測 sticky nav 自己的實際下緣（navEl.getBoundingClientRect().bottom），
// 不用寫死的 px 數字——第一版用固定 160px 時，實測 scrollIntoView 跳轉後某些 section（獲利能力）
// 停在 203px，比 160px 還低，導致高亮還是停在上一個 section；用 nav 自己的真實下緣當門檻，不管
// scroll-margin-top／sticky nav 高度以後怎麼調整，這條線都會自動跟著對，不會再需要手動重新校準
// 一個猜測值。
const navEl = ref<HTMLElement | null>(null)

const sectionEls = new Map<string, HTMLElement>()
function registerSectionEl(category: string) {
  return (el: unknown) => {
    if (el instanceof HTMLElement) sectionEls.set(category, el)
    else sectionEls.delete(category)
  }
}

// Real gap found live 2026-09-16, verifying this exact scroll-spy — a strict "last section whose
// top has crossed the threshold" comparison assumes `scrollIntoView` always lands EXACTLY on the
// threshold line, but a long-distance smooth scroll (jumping several sections down/up in one
// click) can settle a bit short of that — measured live: 獲利能力's section landed at top=203px
// against a ~115px threshold, still clearly the intended section (the one right before it starts
// well above -1000px), but "top <= threshold" alone never matches it since 203 > 115, and the
// loop falls back to whichever earlier section still satisfies the strict test. Picking whichever
// section's top is NUMERICALLY CLOSEST to the threshold (either side) instead of requiring it to
// have already crossed handles that landing variance without needing to guess why any particular
// jump distance settles imperfectly.
let scrollSpyTicking = false
function updateActiveSectionFromScroll() {
  const threshold = (navEl.value?.getBoundingClientRect().bottom ?? 0) + 8
  let current: string | null = null
  let bestDistance = Infinity
  for (const category of SECTION_ORDER) {
    const el = sectionEls.get(category)
    if (!el) continue
    const distance = Math.abs(el.getBoundingClientRect().top - threshold)
    if (distance < bestDistance) {
      bestDistance = distance
      current = category
    }
  }
  if (current) activeCategory.value = current
}

function onScrollSpyTick() {
  if (scrollSpyTicking) return
  scrollSpyTicking = true
  requestAnimationFrame(() => {
    updateActiveSectionFromScroll()
    scrollSpyTicking = false
  })
}

onMounted(() => {
  window.addEventListener('scroll', onScrollSpyTick, { passive: true })
  updateActiveSectionFromScroll()
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScrollSpyTick)
})
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
      <StockSummaryCard :stock="stock" :website="profile?.website ?? null" :is-favorite="isFavorite" :short-name="stockShortName" @toggle-favorite="toggleFavorite">
        <template #actions>
          <StockDetailActions
            v-model:visible-card-ids="visibleCardIds"
            :card-defs="cardDefs"
            :categories="categories"
          />
        </template>
      </StockSummaryCard>
      <!-- Tabs + every card they own commented out 2026-09-15 per direct request ("個股瀏覽的
           tabs 與 tabs下轄的卡片 先全部註解") ahead of a major interface overhaul — see
           TABS_ENABLED's own script-side comment for why this uses a named boolean instead of a
           bare `v-if="false"` literal. Moved here, right after the summary card and ahead of
           every persistent card below, per direct follow-up the same day ("Tabs移到summary下面"
           — used to sit inside the CARD-mode Transition branch, after all the persistent cards;
           now a plain sibling of StockSummaryCard, gated on `experienceMode === 'CARD'` directly
           instead of relying on which Transition branch it's inside, since it's no longer
           physically inside that branch at all). Every card each tab-pane's own grid would
           render is ALSO hidden for now, same day, same request ("原本tabs裡面的卡片請都先幫我
           隱藏") — see TAB_CARDS_ENABLED's own script-side comment. To restore tabs themselves:
           flip TABS_ENABLED back to true. -->
      <template v-if="TABS_ENABLED && experienceMode === 'CARD' && hasHydrated && preferencesReady">
      <!-- UX 大改 2026-09-16（見 categoryVisible 自己的 script-side comment 完整說明）— 原本
           el-tabs「切換顯示」的分頁列，換成一個純錨點導覽的 nav；下面 8 個 section 全部同時渲染，
           不再靠 v-if 切換誰顯示誰隱藏，nav 按鈕只負責捲動跳轉＋視覺高亮。 -->
      <nav ref="navEl" class="stock-detail-page__section-nav" aria-label="個股資訊分類導覽">
        <button
          v-for="category in SECTION_ORDER"
          v-show="categoryVisible[category]"
          :key="category"
          type="button"
          class="stock-detail-page__section-nav-item"
          :class="{ 'is-active': activeCategory === category }"
          @click="scrollToSection(category)"
        >
          <el-icon><component :is="TAB_ICONS[category]" /></el-icon>
          <span class="stock-detail-page__tab-label-row">
            {{ category }}
            <span v-if="categoryFractions[category]" class="stock-detail-page__tab-fraction">{{ categoryFractions[category] }}</span>
          </span>
        </button>
      </nav>

      <!-- Section order here is a hardcoded, manually-maintained sequence (SECTION_ORDER in this
           file's own script) — NOT derived from STOCK_CARD_CATEGORIES/FINANCIAL_ANALYSIS_
           DIMENSIONS at runtime. Real bug found live 2026-09-10 ("我沒看到營運周轉的tab" /
           checking why 市場評價 wasn't actually first despite reordering that constant): the
           constant only drives the "顯示卡片" picker's own grouping order and activeCategory's
           default value, NOT this template's rendered order, so the two can silently drift apart
           exactly like every other "two independently-ordered lists" bug this session has already
           hit (see FINANCIAL_ANALYSIS_DIMENSIONS's own comment for the screener's prior instance
           of this). Moving 市場評價 first here, per direct request, is a manual edit to THIS
           sequence — reordering the constant again alone would silently do nothing, the same trap
           that just happened. -->
      <section
        v-if="categoryVisible['市場評價']"
        :id="sectionElementId('市場評價')"
        :ref="registerSectionEl('市場評價')"
        class="stock-detail-page__section"
      >
        <h2 class="stock-detail-page__section-title">
          <el-icon><component :is="TAB_ICONS['市場評價']" /></el-icon>
          <span class="stock-detail-page__tab-label-row">
            市場評價
            <span v-if="categoryFractions['市場評價']" class="stock-detail-page__tab-fraction">{{ categoryFractions['市場評價'] }}</span>
          </span>
        </h2>
        <!-- 股價與月營收 moved back INTO this section 2026-09-16 per direct request ("請把股價與
             月營收顯示在估值tab") — was pulled out to a persistent slot 2026-09-15 (PRICE_REVENUE_
             CHART_ENABLED) then disabled there the same day and stayed disabled; that dead
             persistent block and its flag are removed entirely now that the chart lives here
             instead, gated the same way every other card in this section is (isVisible +
             TAB_CARDS_ENABLED), not as a separate persistent card. 本益比河流圖／本淨比河流圖
             moved BACK into this section 2026-09-15 per direct follow-up ("我指令下的不好，請把
             河流圖放回市場評價中") — undoes the earlier "拉到常駐" move for just these two;
             removed from their own persistent slot below (see StockDividendStabilityCard's own
             comment for what's still persistent there) so they only render here now, no
             duplication either way. Badge card removed 2026-09-15 for a separate reason (見
             上一輪 "這個分頁可以照搬註解掉的分頁，只是沒有徽章"). 現金獲利估值倍數
             (StockEvMultiplesCard)／獲利收益率 (StockYieldFamilyCard，內含盈餘收益率) removed
             entirely the same day per direct request ("現金獲利估值倍數隱藏 盈餘收益率隱藏")
             — not gated behind isVisible/TAB_CARDS_ENABLED like the rest, just taken out of
             this section's own content. -->
        <div v-if="TAB_CARDS_ENABLED" class="stock-detail-page__grid">
          <StockPriceRevenueChart v-if="isVisible('price-history')" :symbol="stock.code" />
          <!-- 拆出 2026-09-16 per direct request（見 StockRevenuePriceReactionCard.vue 自己的
               comment）— 緊接在 股價與月營收 後面，因為兩者是同一張卡片拆出來的，內容上還是
               相關的兩件事。 -->
          <StockRevenuePriceReactionCard v-if="isVisible('revenue-price-reaction')" :symbol="stock.code" />
          <!-- 大盤連動程度 moved right after 股價與月營收 2026-09-16 per direct request
               ("大盤連動程度放到 股價與月營收後面"), ahead of the two valuation-river charts
               below (was last in this grid before). -->
          <StockBetaComparisonChart v-if="isVisible('beta-comparison')" :symbol="stock.code" :name="stockShortName" />
          <!-- Titles shortened 2026-09-16 per direct request ("本益比河流圖與本淨比河流圖 名稱簡短
               為 本益比／本淨比"), then "本淨比" itself renamed site-wide the same day ("全站
               本淨比 改為淨值比") — "河流圖" dropped from both, keeping just the metric name
               itself; the info-text alongside each still makes the chart's own nature (色帶/線)
               clear without needing "河流圖" spelled out in the title too. -->
          <StockValuationRiverChart
            v-if="isVisible('per-river')"
            :symbol="stock.code"
            kind="pe"
            title="本益比"
            info-text="色帶＝EPS×本益比倍數，線為股價"
          />
          <StockValuationRiverChart
            v-if="isVisible('pbr-river')"
            :symbol="stock.code"
            kind="pb"
            title="淨值比"
            info-text="色帶＝每股淨值×淨值比倍數，線為股價"
          />
        </div>
      </section>

      <section
        v-if="categoryVisible['股東回饋']"
        :id="sectionElementId('股東回饋')"
        :ref="registerSectionEl('股東回饋')"
        class="stock-detail-page__section"
      >
        <h2 class="stock-detail-page__section-title">
          <el-icon><component :is="TAB_ICONS['股東回饋']" /></el-icon>
          <span class="stock-detail-page__tab-label-row">
            股東回饋
            <span v-if="categoryFractions['股東回饋']" class="stock-detail-page__tab-fraction">{{ categoryFractions['股東回饋'] }}</span>
          </span>
        </h2>
        <!-- 配息穩定度／下次除權息 removed from this section 2026-09-15 per direct request ("原本
             tabs中的卡片都替換成手機常駐的") — both already render persistently above (see
             StockDividendStabilityCard/StockExDividendCard's own placement further up this
             file), rendering them again in here once tabs are enabled would just be visible
             duplication. -->
        <div v-if="TAB_CARDS_ENABLED" class="stock-detail-page__grid">
          <StockDividendCoverageChart v-if="isVisible('dividend-coverage')" :symbol="stock.code" />
          <StockDividendGrowthRateCard v-if="isVisible('dividend-growth-rate')" :symbol="stock.code" />
          <StockChowderNumberChart v-if="isVisible('chowder-number')" :symbol="stock.code" />
        </div>
      </section>

      <section
        v-if="categoryVisible['獲利品質']"
        :id="sectionElementId('獲利品質')"
        :ref="registerSectionEl('獲利品質')"
        class="stock-detail-page__section"
      >
        <h2 class="stock-detail-page__section-title">
          <el-icon><component :is="TAB_ICONS['獲利品質']" /></el-icon>
          <span class="stock-detail-page__tab-label-row">
            獲利品質
            <span v-if="categoryFractions['獲利品質']" class="stock-detail-page__tab-fraction">{{ categoryFractions['獲利品質'] }}</span>
          </span>
        </h2>
        <div v-if="TAB_CARDS_ENABLED" class="stock-detail-page__grid">
          <StockDupontFactorLevelChart v-if="isVisible('dupont-factor-levels')" :symbol="stock.code" />
          <StockCashEarningsChart v-if="isVisible('cash-earnings')" :symbol="stock.code" />
          <StockAccrualsQualityChart v-if="isVisible('accruals-quality')" :symbol="stock.code" />
        </div>
      </section>

      <section
        v-if="categoryVisible['獲利能力']"
        :id="sectionElementId('獲利能力')"
        :ref="registerSectionEl('獲利能力')"
        class="stock-detail-page__section"
      >
        <h2 class="stock-detail-page__section-title">
          <el-icon><component :is="TAB_ICONS['獲利能力']" /></el-icon>
          <span class="stock-detail-page__tab-label-row">
            獲利能力
            <span v-if="categoryFractions['獲利能力']" class="stock-detail-page__tab-fraction">{{ categoryFractions['獲利能力'] }}</span>
          </span>
        </h2>
        <div v-if="TAB_CARDS_ENABLED" class="stock-detail-page__grid">
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
      </section>

      <section
        v-if="categoryVisible['成長動能']"
        :id="sectionElementId('成長動能')"
        :ref="registerSectionEl('成長動能')"
        class="stock-detail-page__section"
      >
        <h2 class="stock-detail-page__section-title">
          <el-icon><component :is="TAB_ICONS['成長動能']" /></el-icon>
          <span class="stock-detail-page__tab-label-row">
            成長動能
            <span v-if="categoryFractions['成長動能']" class="stock-detail-page__tab-fraction">{{ categoryFractions['成長動能'] }}</span>
          </span>
        </h2>
        <div v-if="TAB_CARDS_ENABLED" class="stock-detail-page__grid">
          <StockGrowthDecompositionChart v-if="isVisible('eps-growth-decomposition')" :symbol="stock.code" kind="eps" />
          <StockGrowthDecompositionChart v-if="isVisible('equity-growth-decomposition')" :symbol="stock.code" kind="equity" />
          <StockSueChart v-if="isVisible('sue')" :symbol="stock.code" />
        </div>
      </section>

      <section
        v-if="categoryVisible['財務韌性']"
        :id="sectionElementId('財務韌性')"
        :ref="registerSectionEl('財務韌性')"
        class="stock-detail-page__section"
      >
        <h2 class="stock-detail-page__section-title">
          <el-icon><component :is="TAB_ICONS['財務韌性']" /></el-icon>
          <span class="stock-detail-page__tab-label-row">
            財務韌性
            <span v-if="categoryFractions['財務韌性']" class="stock-detail-page__tab-fraction">{{ categoryFractions['財務韌性'] }}</span>
          </span>
        </h2>
        <div v-if="TAB_CARDS_ENABLED" class="stock-detail-page__grid">
          <StockLiquidityChart v-if="isVisible('liquidity')" :symbol="stock.code" />
          <StockLeverageChart v-if="isVisible('leverage')" :symbol="stock.code" />
          <StockDebtCoverageChart v-if="isVisible('debt-coverage')" :symbol="stock.code" />
          <StockBankCapitalChart v-if="isVisible('bank-capital')" :symbol="stock.code" />
        </div>
      </section>

      <section
        v-if="categoryVisible['營運周轉']"
        :id="sectionElementId('營運周轉')"
        :ref="registerSectionEl('營運周轉')"
        class="stock-detail-page__section"
      >
        <h2 class="stock-detail-page__section-title">
          <el-icon><component :is="TAB_ICONS['營運周轉']" /></el-icon>
          <span class="stock-detail-page__tab-label-row">
            營運周轉
            <span v-if="categoryFractions['營運周轉']" class="stock-detail-page__tab-fraction">{{ categoryFractions['營運周轉'] }}</span>
          </span>
        </h2>
        <div v-if="TAB_CARDS_ENABLED" class="stock-detail-page__grid">
          <StockTurnoverRatioChart v-if="isVisible('turnover-ratio')" :symbol="stock.code" />
          <StockCashConversionCycleChart v-if="isVisible('cash-conversion-cycle')" :symbol="stock.code" />
          <StockAssetUtilizationChart v-if="isVisible('asset-utilization')" :symbol="stock.code" />
          <StockCapexIntensityChart v-if="isVisible('capex-intensity')" :symbol="stock.code" />
        </div>
      </section>

      <!-- Renamed 公司資訊 → 大戶籌碼 2026-09-10 per direct request ("Tab 公司資訊 改為 大戶籌碼")
           — 外資持股比例變化 moved in from 市場評價 the same day ("外資持股比例變化 卡片移過去
           大戶籌碼" — this is the closest thing this site has to real 大戶籌碼/institutional-
           holder data), and the guru-badges slot every other section already has was added too.
           股本變化 (StockShareCapitalChart) removed entirely 2026-09-14 — see useStockCards.ts's
           own comment: mops-ts dropped the capitalStock domain its data came from. -->
      <section
        v-if="categoryVisible['大戶籌碼']"
        :id="sectionElementId('大戶籌碼')"
        :ref="registerSectionEl('大戶籌碼')"
        class="stock-detail-page__section"
      >
        <h2 class="stock-detail-page__section-title">
          <el-icon><component :is="TAB_ICONS['大戶籌碼']" /></el-icon>
          <span class="stock-detail-page__tab-label-row">
            大戶籌碼
            <span v-if="categoryFractions['大戶籌碼']" class="stock-detail-page__tab-fraction">{{ categoryFractions['大戶籌碼'] }}</span>
          </span>
        </h2>
        <div v-if="TAB_CARDS_ENABLED" class="stock-detail-page__grid">
          <StockForeignShareholdingChart v-if="isVisible('foreign-shareholding')" :symbol="stock.code" />
        </div>
      </section>
      </template>


      <!-- 本益比河流圖／本淨比河流圖 pulled out of the (currently disabled) 市場評價 tab and made
           persistent 2026-09-15 per direct request ("本益比河流圖 本淨比河流圖也抓出來"), then
           moved above 股利資訊 the same day per direct follow-up ("河流圖放上面") — then moved
           BACK into the 市場評價 tab the same day per direct follow-up ("我指令下的不好，請把
           河流圖放回市場評價中") — see that tab-pane's own comment (line ~356). No longer
           persistent, removed from here entirely; only rendered inside the tab now. -->

      <!-- 殖利率相關的卡片 pulled out of the (currently disabled) 股東回饋 tab and made persistent
           2026-09-15 per direct request ("把 殖利率 相關的卡片 抓出來"), taking 股價與月營收's
           old slot here. Split back into 2 separate cards the same day ("股利卡片幫我拆開，
           另外建立" — see StockDividendStabilityCard.vue's own comment for the full merge/split
           history). 配息穩定度 handles its own loading state internally (v-loading), no shell
           needed; 下次除權息 still depends on the page-level exDividendNotices fetch, same
           v-if="exDividendNotices" ? real card : shell pattern as its original spot inside the
           tabs (line ~464) — exDividendNotices is a shared top-level fetch, not re-fetched
           here. -->
      <StockDividendStabilityCard v-if="DIVIDEND_CARDS_ENABLED && isVisible('dividend-stability')" :symbol="stock.code" class="stock-detail-page__profile" />
      <template v-if="DIVIDEND_CARDS_ENABLED && isVisible('ex-dividend')">
        <StockExDividendCard v-if="exDividendNotices" :notices="exDividendNotices[code] ?? []" class="stock-detail-page__profile" />
        <StockExDividendCardShell v-else class="stock-detail-page__profile" />
      </template>

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

      <!-- 營收到股利瀑布圖 added 2026-09-15, placed directly ABOVE 公司基本資訊 per direct request
           ("公司基本資訊的上面") — same persistent, cross-tab placement pattern as 公司基本資訊
           itself (see that block's own comment immediately below). Hidden later that day
           ("這張也幫我隱藏"), then re-enabled and confirmed to stay in this exact spot per
           direct follow-up ("從營收到股利 這張拿出來，放到基本資訊上面") — see
           REVENUE_TO_DIVIDEND_BRIDGE_ENABLED's own script-side comment. -->
      <StockRevenueToDividendBridge v-if="REVENUE_TO_DIVIDEND_BRIDGE_ENABLED && isVisible('revenue-to-dividend-bridge')" :symbol="stock.code" class="stock-detail-page__profile" />

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

/* UX 大改 2026-09-16 per直接要求（"tabs uiux 再大改。tabs 現在提供的是快速滑過去的功能。就是
   所有的卡片都同時出現，tabs是按下去以後跳到該section"）— el-tabs「切換 pane」的分頁列換成
   錨點導覽 nav + 一路往下的 8 個 <section>。__section/__section-title 這兩個 class 名稱重新
   出現（上一輪 2026-09-10 從 <section> 改成 el-tab-pane 時，這裡原本的舊註解說這兩個 class
   "沒了"）——這次不是走回頭路的巧合，是這次要求的直接結果：所有分類的卡片本來就要同時顯示，
   <section> 又變回正確的語意單位。下面的 __grid 規則完全沒動，繼續套用在每個 section 內部。 */

/* sticky，跟著捲動固定在畫面上方，不管使用者捲到哪個 section 都能直接點其他分類跳過去——這正是
   這次改版的核心訴求（"tabs 現在提供的是快速滑過去的功能"）。top 的 offset 沿用
   --app-header-height/--app-banner-height 這兩個全域 CSS var（desktop.vue 自己的
   .app-shell__content padding-top 算 sticky header 實際高度時也是用同一組變數，這裡沿用同一份
   數字保持一致，不是另外量出來的獨立數字）。窄螢幕下按鈕超出可視寬度就用一般
   overflow-x:auto 水平捲動——不再需要 el-tabs 那套「量測 nav 真實寬度來判斷要不要顯示箭頭」
   機制，普通的捲動容器沒有那個測量循環依賴的問題（見今天稍早那一輪修法的完整教訓）。 */
.stock-detail-page__section-nav {
  position: sticky;
  top: calc(var(--app-header-height) + var(--app-banner-height) + 8px);
  z-index: 5;
  display: flex;
  align-items: center;
  gap: 4px;
  overflow-x: auto;
  padding: 8px;
  border-radius: 12px;
  background: var(--el-fill-color-light);
}

.stock-detail-page__section-nav-item {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--el-text-color-primary);
  font-size: 1rem;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
}

.stock-detail-page__section-nav-item .el-icon {
  font-size: 1.25rem;
}

/* 同 el-button type="primary" 全站既有的 bg/文字配色組合（--el-color-primary + 白色文字），
   不是另外調的新色——這組配色已經是全站每個 primary 按鈕在用的既有組合，沿用它而非發明新的，
   確保不會引入一組沒驗證過 AA 對比的新配色。 */
.stock-detail-page__section-nav-item.is-active {
  background: var(--el-color-primary);
  color: #fff;
}

.stock-detail-page__section {
  /* 點擊 nav 按鈕捲動跳轉時，讓 section 自己的標題留在 sticky header + sticky nav 底下，不被
     兩層 sticky 元素蓋住——64px 大致對應 nav 列自身高度 + 跟標題間的呼吸空間。 */
  scroll-margin-top: calc(var(--app-header-height) + var(--app-banner-height) + 64px);
}

.stock-detail-page__section-title {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0 0 12px;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.stock-detail-page__section-title .el-icon {
  font-size: 1.25rem;
}

.stock-detail-page__tab-label-row {
  display: inline-flex;
  align-items: baseline;
  gap: 4px;
}

.stock-detail-page__tab-fraction {
  font-size: 1rem;
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

/* Real bug fixed 2026-09-15 (reported live: "卡片垂直間隔是不是抓太寬了？") — this used to carry
   its own `margin-top: 16px`, on top of the parent `.stock-detail-page`'s own `gap: 24px` flex
   spacing, back when this class was used by exactly one persistent card (公司基本資訊) that
   needed visual separation from the tabs section above it. Now that river charts/dividend-info/
   revenue-bridge/price-revenue all share this same class as a flat stack of persistent cards,
   that extra margin compounded between every pair of them (24+16=40px measured live) while the
   one gap without two `__profile` siblings stayed a bare 24px — inconsistent, not intentionally
   wider anywhere. The parent's own flex `gap` already spaces every direct child uniformly; no
   per-card margin needed on top of it. */

/* Base rule above must come before this override — same-specificity CSS falls back to source
   order, so an override placed before its base rule loses to it at every viewport regardless
   of which @media condition matches (see dashboard.vue's own grid for the same note). */
@media (max-width: 600px) {
  .stock-detail-page__grid {
    grid-template-columns: 1fr;
  }
}

</style>
