<script setup lang="ts">
import { GURU_CATEGORY_ICON } from '~/utils/guru-badges'

// 公司健檢 — real route 2026-09-18, split out of stock/[code]/index.vue's own 卡片模式 per direct
// request ("summary 上面的 卡片 表格 會計 顯示設定 都拔掉。所有卡片一律呈現。卡片 表格 會計 做在
// sidebar上面。財務報表 (會計) 指標歷史 (表格) 公司健檢 (卡片)") — this is that 卡片模式's new home.
// The 8-category anchor-nav system itself (nav, scroll-spy, SECTION_ORDER, all 8 card sections) had
// briefly lived on financial-statements.vue (see that file's own git history, 2026-09-17 commit) —
// moved here instead the very next day once it became clear 卡片模式's own content and 會計模式's
// own content (StockPeriodSelector/StockFinancialStatementsCard) needed to be two separate pages,
// not one.
//
// "顯示設定 都拔掉。所有卡片一律呈現" — StockDetailActions (the 顯示卡片 picker) is gone from every
// stock-detail page now, so every isVisible('...')/categoryVisible[...] gate this tabs system used
// to have is gone too — every category's nav item and every card inside it just renders
// unconditionally. useStockCards() itself is no longer called here at all (cardDefs/visibleCardIds/
// isVisible had no other purpose on this page); SECTION_ORDER (already declared for nav ordering)
// doubles as the category-name source `categories` used to provide, since nothing here needs the
// 9th non-tab category ('公司資訊') that array carried.
const route = useRoute()
const router = useRouter()
const code = computed(() => String(route.params.code))

const { stock, profile, stockShortName, stockPending, isFavorite, toggleFavorite } = useStockDetailSummary(code)
// Real bug found live 2026-09-10 (see stock/[code]/index.vue's own git history for the full
// original account): StockGuruBadgeCategoryCard.vue's own `formulaLatex` lookup (via
// useFilterSchema()) got stuck permanently serving the offline mock schema when several sibling
// category cards all called useAsyncData('filter-schema', ...) simultaneously on mount — awaiting
// it once here, before any of those children mount, resolves the real schema into the shared cache
// first.
await useFilterSchema()

const preferencesReady = useStockDetailPreferencesReady()
const hasHydrated = useHasHydrated()

// 錨點導覽的順序，跟原本 el-tab-pane 的手動排序完全一致（同一份「市場評價優先」手動順序）。
const SECTION_ORDER = ['市場評價', '股東回饋', '獲利品質', '獲利能力', '成長動能', '財務韌性', '營運周轉', '大戶籌碼'] as const

// Page restructured 2026-09-10 from 7 stacked <section>s into real tabs, then anchor-nav 2026-09-16
// (see stock/[code]/index.vue's own git history for that full saga) — this state (which category's
// in the URL/last viewed) survives page reload via the `tab` query param and SPA navigation via the
// shared useState below, same as before. `replace` (not `push`) so switching tabs doesn't spam the
// browser's back-button history with one entry per click.
const initialCategoryFromQuery = typeof route.query.tab === 'string' && (SECTION_ORDER as readonly string[]).includes(route.query.tab)
  ? route.query.tab
  : undefined
const activeCategory = useState('stock-detail-active-category', () => initialCategoryFromQuery ?? SECTION_ORDER[0])
if (initialCategoryFromQuery) activeCategory.value = initialCategoryFromQuery

watch(activeCategory, newCategory => {
  // `hash` preserved explicitly — real bug found on stock/[code]/index.vue (see this exact
  // watcher's own history there, moved verbatim): it fires in onMounted (initial scroll position)
  // regardless of how this page was navigated to, so a hash-anchor NuxtLink landing here would
  // otherwise have its hash silently stripped before the browser even got to scroll to it.
  router.replace({ query: { ...route.query, tab: newCategory }, hash: route.hash })
})

// Per direct follow-up ("分頁要有 Icon") — same icon assignments MoleculeIndicatorPickerBody.vue
// already uses for the 6 shared financial-analysis dimensions in the screener's own category
// picker. Moved into guru-badges.ts's own GURU_CATEGORY_ICON (see that file's own comment) once
// guru-indicators.vue's nav row also needed this exact same mapping.
const TAB_ICONS = GURU_CATEGORY_ICON

// Per-category badge fraction ("2/3") shown beside each tab label. Each StockGuruBadgeCategoryCard
// instance writes its own already-computed fraction here as it resolves (see
// useGuruBadgeCategoryFractions.ts's own comment); this page just reads it back per tab, no
// separate fetch of its own.
const categoryFractions = useGuruBadgeCategoryFractions()

function sectionElementId(category: string): string {
  return `stock-section-${category}`
}

function scrollToSection(category: string) {
  activeCategory.value = category
  document.getElementById(sectionElementId(category))?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

const navEl = ref<HTMLElement | null>(null)

const sectionEls = new Map<string, HTMLElement>()
function registerSectionEl(category: string) {
  return (el: unknown) => {
    if (el instanceof HTMLElement) sectionEls.set(category, el)
    else sectionEls.delete(category)
  }
}

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

const requestUrl = useRequestURL()
useHead({
  title: () => `${stockShortName.value} 公司健檢`,
  link: [{ rel: 'canonical', href: computed(() => `${requestUrl.origin}/stock/${code.value}/company-health`) }]
})
</script>

<template>
  <div v-loading="stockPending" class="stock-company-health-page">
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
      <!-- Page subject lives in the summary card's single <h1> (「台積電 2330 公司健檢」) since
           2026-09-19 — see StockSummaryCard.vue's own heading comment. -->
      <StockSummaryCard :stock="stock" :website="profile?.website ?? null" :is-favorite="isFavorite" :short-name="stockShortName" topic="公司健檢" @toggle-favorite="toggleFavorite" />
      <StockPageNav :code="code" />

      <template v-if="hasHydrated && preferencesReady">
      <!-- UX 大改 2026-09-16（見 categoryVisible 自己的 script-side comment 完整說明）— 原本
           el-tabs「切換顯示」的分頁列，換成一個純錨點導覽的 nav；下面 8 個 section 全部同時渲染，
           不再靠 v-if 切換誰顯示誰隱藏，nav 按鈕只負責捲動跳轉＋視覺高亮。 -->
      <nav ref="navEl" class="stock-detail-page__section-nav" aria-label="個股資訊分類導覽">
        <button
          v-for="category in SECTION_ORDER"
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
        <div class="stock-detail-page__grid">
          <StockPriceRevenueChart :symbol="stock.code" />
          <!-- 拆出 2026-09-16 per direct request（見 StockRevenuePriceReactionCard.vue 自己的
               comment）— 緊接在 股價與月營收 後面，因為兩者是同一張卡片拆出來的，內容上還是
               相關的兩件事。 -->
          <StockRevenuePriceReactionCard :symbol="stock.code" />
          <!-- 大盤連動程度 moved right after 股價與月營收 2026-09-16 per direct request
               ("大盤連動程度放到 股價與月營收後面"), ahead of the two valuation-river charts
               below (was last in this grid before). -->
          <StockBetaComparisonChart :symbol="stock.code" :name="stockShortName" />
          <!-- Titles shortened 2026-09-16 per direct request ("本益比河流圖與本淨比河流圖 名稱簡短
               為 本益比／本淨比"), then "本淨比" itself renamed site-wide the same day ("全站
               本淨比 改為淨值比") — "河流圖" dropped from both, keeping just the metric name
               itself; the info-text alongside each still makes the chart's own nature (色帶/線)
               clear without needing "河流圖" spelled out in the title too. -->
          <StockValuationRiverChart
            :symbol="stock.code"
            kind="pe"
            title="本益比"
            info-text="色帶＝EPS×本益比倍數，線為股價"
          />
          <StockValuationRiverChart
            :symbol="stock.code"
            kind="pb"
            title="淨值比"
            info-text="色帶＝每股淨值×淨值比倍數，線為股價"
          />
        </div>
      </section>

      <section
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
        <div class="stock-detail-page__grid">
          <StockDividendCoverageChart :symbol="stock.code" />
          <StockDividendGrowthRateCard :symbol="stock.code" />
          <StockChowderNumberChart :symbol="stock.code" />
        </div>
      </section>

      <section
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
        <div class="stock-detail-page__grid">
          <StockDupontFactorLevelChart :symbol="stock.code" />
          <StockCashEarningsChart :symbol="stock.code" />
          <StockAccrualsQualityChart :symbol="stock.code" />
        </div>
      </section>

      <section
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
        <div class="stock-detail-page__grid">
          <StockMetricHistoryChart
            :symbol="stock.code"
            metric-code="eps"
            title="EPS"
            chart-type="bar"
            unit="元"
            info-text="每股盈餘（單季或近四季合計）"
            source-label="公開發行公司財務報表"
          />
          <StockMetricHistoryChart
            :symbol="stock.code"
            metric-code="roe"
            title="ROE"
            chart-type="line"
            unit="%"
            info-text="股東權益報酬率＝稅後淨利÷股東權益"
            source-label="公開發行公司財務報表"
          />
          <StockMetricHistoryChart
            :symbol="stock.code"
            metric-code="roa"
            title="ROA"
            chart-type="line"
            unit="%"
            info-text="資產報酬率＝稅後淨利÷總資產"
            source-label="公開發行公司財務報表"
          />
          <StockMarginsChart :symbol="stock.code" />
          <StockFamaFrenchProfitabilityChart :symbol="stock.code" />
        </div>
      </section>

      <section
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
        <div class="stock-detail-page__grid">
          <StockGrowthDecompositionChart :symbol="stock.code" kind="eps" />
          <StockGrowthDecompositionChart :symbol="stock.code" kind="equity" />
          <StockSueChart :symbol="stock.code" />
        </div>
      </section>

      <section
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
        <div class="stock-detail-page__grid">
          <StockLiquidityChart :symbol="stock.code" />
          <StockLeverageChart :symbol="stock.code" />
          <StockDebtCoverageChart :symbol="stock.code" />
          <StockBankCapitalChart :symbol="stock.code" />
        </div>
      </section>

      <section
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
        <div class="stock-detail-page__grid">
          <StockTurnoverRatioChart :symbol="stock.code" />
          <StockCashConversionCycleChart :symbol="stock.code" />
          <StockAssetUtilizationChart :symbol="stock.code" />
          <StockCapexIntensityChart :symbol="stock.code" />
        </div>
      </section>

      <!-- Renamed 公司資訊 → 大戶籌碼 2026-09-10 per direct request ("Tab 公司資訊 改為 大戶籌碼")
           — 外資持股比例變化 moved in from 市場評價 the same day ("外資持股比例變化 卡片移過去
           大戶籌碼" — this is the closest thing this site has to real 大戶籌碼/institutional-
           holder data), and the guru-badges slot every other section already has was added too.
           股本變化 (StockShareCapitalChart) removed entirely 2026-09-14 — see useStockCards.ts's
           own comment: mops-ts dropped the capitalStock domain its data came from. -->
      <section
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
        <div class="stock-detail-page__grid">
          <StockForeignShareholdingChart :symbol="stock.code" />
        </div>
      </section>
      </template>

      <StockProfileCard v-if="profile" :profile="profile" class="stock-detail-page__profile" />
      <StockProfileCardShell v-else class="stock-detail-page__profile" />
    </template>
  </div>
</template>

<style scoped>
.stock-company-health-page {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 24px;
  container-type: inline-size;
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
