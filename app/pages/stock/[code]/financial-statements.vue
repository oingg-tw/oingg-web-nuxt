<script setup lang="ts">
import { GURU_CATEGORY_ICON } from '~/utils/guru-badges'

// 財務報表 — real route 2026-09-17, split out of stock/[code]/index.vue's own 會計模式 per direct
// request ("整頁滑動的概念完全捨棄...股利怎麼來？他URL是像這樣 stock/2330/新頁面，命名交給你，以利
// SEO。只有Header部分會長相一樣") — StockPeriodSelector/StockFinancialStatementsCard are the exact
// same two components 會計模式 used to render inside stock/[code]/index.vue's own experienceMode
// Transition (see that file's own git history for the "三表的表格" build-out); this page reuses
// them directly rather than re-implementing anything. "只有Header部分會長相一樣" — StockSummaryCard
// is the shared header (via useStockDetailSummary.ts, the same composable
// stock/[code]/index.vue itself now calls).
//
// 顯示設定／tabs機制 moved here from stock/[code]/index.vue the same day, per direct follow-up
// ("請把 顯示設定 以及 tabs機制，移動到財務報表底下") — the whole 8-category anchor-nav system
// (市場評價/股東回饋/獲利品質/獲利能力/成長動能/財務韌性/營運周轉/大戶籌碼) plus the 顯示卡片
// picker (StockDetailActions) that controls which cards inside it show, moved verbatim from that
// file's own CARD-mode content — same components, same isVisible/categoryVisible/SECTION_ORDER
// logic, same scroll-spy, just relocated and no longer gated on `experienceMode === 'CARD'` (this
// page has no mode switcher of its own, so that condition is dropped — the tabs system here always
// applies once hydrated/preferences-ready). `useStockCards()` is called fresh here (not passed
// down) — its `visibleCardIds` is a `useState`, so this call shares the exact same underlying
// state as stock/[code]/index.vue's own call, not a second independent copy.
const route = useRoute()
const router = useRouter()
const code = computed(() => String(route.params.code))

const { stock, profile, stockShortName, stockPending, isFavorite, toggleFavorite } = useStockDetailSummary(code)
const { cardDefs, categories, visibleCardIds, isVisible } = useStockCards()
// Real bug found live 2026-09-10 (see stock/[code]/index.vue's own git history for the full
// original account): StockGuruBadgeCategoryCard.vue's own `formulaLatex` lookup (via
// useFilterSchema()) got stuck permanently serving the offline mock schema when several sibling
// category cards all called useAsyncData('filter-schema', ...) simultaneously on mount — awaiting
// it once here, before any of those children mount, resolves the real schema into the shared cache
// first.
await useFilterSchema()

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
  // `hash` preserved explicitly 2026-09-17 — real bug found on stock/[code]/index.vue (see this
  // exact watcher's own comment there, moved verbatim): it fires in onMounted (initial scroll
  // position) regardless of how this page was navigated to, so a hash-anchor NuxtLink landing
  // here would otherwise have its hash silently stripped before the browser even got to scroll to
  // it. Kept even though this page itself has no hash-anchor NuxtLink pointing at it today — same
  // watcher, same risk if one's ever added.
  router.replace({ query: { ...route.query, tab: newCategory }, hash: route.hash })
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


const requestUrl = useRequestURL()
useHead({
  title: () => `${stockShortName.value} 財務報表`,
  link: [{ rel: 'canonical', href: computed(() => `${requestUrl.origin}/stock/${code.value}/financial-statements`) }]
})
</script>

<template>
  <StockDetailSidebarNav :code="code" />

  <div v-loading="stockPending" class="stock-financial-statements-page">
    <!-- Same three-way pending/not-found/found branch as stock/[code]/index.vue's own (see that
         file's own comment for why a bare v-if/v-else pair can't distinguish "still loading" from
         "genuinely doesn't exist"). -->
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
      <h1 class="stock-financial-statements-page__title">財務報表</h1>
      <StockPeriodSelector :symbol="stock.code" />
      <StockFinancialStatementsCard :symbol="stock.code" />

      <template v-if="TABS_ENABLED && hasHydrated && preferencesReady">
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
    </template>
  </div>
</template>

<style scoped>
.stock-financial-statements-page {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 24px;
  /* container-type: inline-size — needed for the @container query in the moved tabs CSS below
     (the 8-category grid's 2→3 column breakpoint) to measure THIS element's own rendered width
     rather than the viewport — see that rule's own comment (moved verbatim from
     stock/[code]/index.vue) for the full reasoning. */
  container-type: inline-size;
}

/* 16px per docs/ui-ux/accessibility-guidelines.md §1.1 — site-wide floor, no exceptions. */
.stock-financial-statements-page__title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
}

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

/* Base rule above must come before this override — same-specificity CSS falls back to source
   order, so an override placed before its base rule loses to it at every viewport regardless
   of which @media condition matches (see dashboard.vue's own grid for the same note). */
@media (max-width: 600px) {
  .stock-detail-page__grid {
    grid-template-columns: 1fr;
  }
}

</style>
