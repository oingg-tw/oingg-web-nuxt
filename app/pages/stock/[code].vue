<script setup lang="ts">
import { CircleCheck, Coin, DataLine, Document, Lock, Money, Refresh, TrendCharts } from '@element-plus/icons-vue'

const route = useRoute()
const router = useRouter()

const code = computed(() => String(route.params.code))
const { data: universe } = useStockUniverse()
const stock = computed(() => getStockByCode(universe.value, code.value))

const { cardDefs, categories, visibleCardIds, isVisible } = useStockCards()
const { data: profile } = useCompanyProfile(stock)
const { data: capitalStockHistory } = useCapitalStockHistory(stock)
const { data: exDividendNotices } = useExDividendNotices(computed(() => (stock.value ? [stock.value.code] : [])))

const { watchlist, addStock, removeStock } = useStocks()
const isFavorite = computed(() => watchlist.value.some(item => item.code === stock.value?.code))

function toggleFavorite() {
  if (!stock.value) return
  if (isFavorite.value) {
    removeStock(stock.value.code)
  } else {
    addStock(stock.value.code)
  }
}

// Own two-way mode (卡片/會計), NOT shared with dashboard.vue's two-way novice/pro toggle —
// see useStockExperienceMode.ts's own comment for why. The toggle control itself
// lives inside StockDetailActions.vue's "顯示卡片" popover now, not an always-visible row here
// (per direct request — the inline radio-group crowded the summary card's header at narrow
// widths) — this page only reads the mode to decide what to render.
const { mode: experienceMode } = useStockExperienceMode()

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
const activeCategory = ref(categories[0])

// Per direct follow-up ("分頁要有 Icon") — same icon assignments MoleculeIndicatorPickerBody.vue
// already uses for the 6 shared financial-analysis dimensions in the screener's own category
// picker (CATEGORY_ICONS_BY_KEY there, keyed by the backend's english category key rather than
// the Chinese label used here — dividend/growth/profitability/quality/resilience/valuation map
// onto 股東回饋/成長動能/獲利能力/獲利品質/財務韌性/市場評價 respectively), reused here by the
// Chinese label instead so both pickers stay visually consistent without a second source of
// truth to drift out of sync. 公司資訊 isn't one of those 6 dimensions, so it gets its own icon.
const TAB_ICONS: Record<string, typeof Coin> = {
  股東回饋: Coin,
  獲利品質: CircleCheck,
  獲利能力: TrendCharts,
  成長動能: DataLine,
  財務韌性: Lock,
  市場評價: Money,
  營運周轉: Refresh,
  公司資訊: Document
}
</script>

<template>
  <div class="stock-detail-page">
    <el-result
      v-if="!stock"
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
      <template v-if="experienceMode === 'ACCOUNTING'">
        <StockPeriodSelector :symbol="stock.code" />
        <StockFinancialStatementsCard :symbol="stock.code" />
      </template>

      <template v-else-if="hasHydrated && preferencesReady">
      <!-- Standalone, not nested in any category <section> below — per direct request
           ("徽章系統請放上面，基本資料下面。他不隸屬於任何分類") this card is a cross-cutting
           page-level overview, not one of the 6 financial-analysis dimensions, so it renders
           above all of them (right after StockSummaryCard, before 公司資訊/基本資料) instead of
           living inside the 公司資訊 section it used to sit in. Still gated by
           isVisible('guru-badges') and still toggleable via the picker (its `category` in
           useStockCards.ts is still '公司資訊' for the PICKER's own grouping purposes only —
           that's a data label, not a claim about where it renders on the page). -->
      <StockGuruBadgeCard v-if="isVisible('guru-badges')" :symbol="stock.code" />

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
          v-if="isVisible('per-river') || isVisible('pbr-river') || isVisible('foreign-shareholding')"
          label="市場評價"
          name="市場評價"
        >
          <template #label>
            <el-icon><component :is="TAB_ICONS['市場評價']" /></el-icon>
            市場評價
          </template>
          <div class="stock-detail-page__grid">
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
            <StockForeignShareholdingChart v-if="isVisible('foreign-shareholding')" :symbol="stock.code" />
          </div>
        </el-tab-pane>

        <el-tab-pane
          v-if="isVisible('ex-dividend') || isVisible('dividend-stability') || isVisible('dividend-coverage')"
          label="股東回饋"
          name="股東回饋"
        >
          <template #label>
            <el-icon><component :is="TAB_ICONS['股東回饋']" /></el-icon>
            股東回饋
          </template>
          <div class="stock-detail-page__grid">
            <template v-if="isVisible('ex-dividend')">
              <StockExDividendCard v-if="exDividendNotices" :notices="exDividendNotices[code] ?? []" />
              <StockExDividendCardShell v-else />
            </template>
            <StockDividendStabilityCard v-if="isVisible('dividend-stability')" :symbol="stock.code" />
            <StockDividendCoverageChart v-if="isVisible('dividend-coverage')" :symbol="stock.code" />
          </div>
        </el-tab-pane>

        <el-tab-pane
          v-if="
            isVisible('dupont') ||
            isVisible('dupont-extended') ||
            isVisible('roe-composition') ||
            isVisible('dupont-factor-levels') ||
            isVisible('dupont-five-stage') ||
            isVisible('cash-earnings') ||
            isVisible('accruals-quality')
          "
          label="獲利品質"
          name="獲利品質"
        >
          <template #label>
            <el-icon><component :is="TAB_ICONS['獲利品質']" /></el-icon>
            獲利品質
          </template>
          <div class="stock-detail-page__grid">
            <StockDupontChart v-if="isVisible('dupont')" :symbol="stock.code" />
            <StockDupontExtendedChart v-if="isVisible('dupont-extended')" :symbol="stock.code" />
            <StockRoeCompositionChart v-if="isVisible('roe-composition')" :symbol="stock.code" />
            <StockDupontFactorLevelChart v-if="isVisible('dupont-factor-levels')" :symbol="stock.code" />
            <StockDupontFiveStageMetricCards v-if="isVisible('dupont-five-stage')" :symbol="stock.code" />
            <StockCashEarningsChart v-if="isVisible('cash-earnings')" :symbol="stock.code" />
            <StockAccrualsQualityChart v-if="isVisible('accruals-quality')" :symbol="stock.code" />
          </div>
        </el-tab-pane>

        <el-tab-pane
          v-if="isVisible('eps') || isVisible('roe') || isVisible('roa') || isVisible('margins')"
          label="獲利能力"
          name="獲利能力"
        >
          <template #label>
            <el-icon><component :is="TAB_ICONS['獲利能力']" /></el-icon>
            獲利能力
          </template>
          <div class="stock-detail-page__grid">
            <StockMetricHistoryChart
              v-if="isVisible('eps')"
              :symbol="stock.code"
              metric-code="eps"
              basis="TTM"
              title="四季 EPS"
              chart-type="bar"
              unit="元"
              info-text="近四季每股盈餘（TTM EPS）加總"
              source-label="公開發行公司財務報表"
            />
            <StockMetricHistoryChart
              v-if="isVisible('roe')"
              :symbol="stock.code"
              metric-code="roe"
              basis="TTM"
              title="近四季 ROE"
              chart-type="line"
              unit="%"
              info-text="股東權益報酬率＝稅後淨利÷股東權益"
              source-label="公開發行公司財務報表"
            />
            <StockMetricHistoryChart
              v-if="isVisible('roa')"
              :symbol="stock.code"
              metric-code="roa"
              basis="TTM"
              title="近四季 ROA"
              chart-type="line"
              unit="%"
              info-text="資產報酬率＝稅後淨利÷總資產"
              source-label="公開發行公司財務報表"
            />
            <StockMarginsChart v-if="isVisible('margins')" :symbol="stock.code" />
          </div>
        </el-tab-pane>

        <el-tab-pane
          v-if="isVisible('revenue') || isVisible('eps-growth-decomposition') || isVisible('equity-growth-decomposition')"
          label="成長動能"
          name="成長動能"
        >
          <template #label>
            <el-icon><component :is="TAB_ICONS['成長動能']" /></el-icon>
            成長動能
          </template>
          <div class="stock-detail-page__grid">
            <StockRevenueChart
              v-if="isVisible('revenue')"
              :symbol="stock.code"
              info-text="月增率/年增率/累計營收年增率對比"
            />
            <StockGrowthDecompositionChart v-if="isVisible('eps-growth-decomposition')" :symbol="stock.code" kind="eps" />
            <StockGrowthDecompositionChart v-if="isVisible('equity-growth-decomposition')" :symbol="stock.code" kind="equity" />
          </div>
        </el-tab-pane>

        <el-tab-pane
          v-if="
            isVisible('share-capital') ||
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
            財務韌性
          </template>
          <div class="stock-detail-page__grid">
            <template v-if="isVisible('share-capital')">
              <StockShareCapitalChart v-if="capitalStockHistory" :entries="capitalStockHistory" />
              <StockChartShell v-else title="股本變化" variant="bars-line" :tabs="['近5年', '近10年']" />
            </template>
            <StockLiquidityChart v-if="isVisible('liquidity')" :symbol="stock.code" />
            <StockLeverageChart v-if="isVisible('leverage')" :symbol="stock.code" />
            <StockDebtCoverageChart v-if="isVisible('debt-coverage')" :symbol="stock.code" />
            <StockBankCapitalChart v-if="isVisible('bank-capital')" :symbol="stock.code" />
          </div>
        </el-tab-pane>

        <el-tab-pane
          v-if="
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
            營運周轉
          </template>
          <div class="stock-detail-page__grid">
            <StockTurnoverRatioChart v-if="isVisible('turnover-ratio')" :symbol="stock.code" />
            <StockCashConversionCycleChart v-if="isVisible('cash-conversion-cycle')" :symbol="stock.code" />
            <StockAssetUtilizationChart v-if="isVisible('asset-utilization')" :symbol="stock.code" />
            <StockCapexIntensityChart v-if="isVisible('capex-intensity')" :symbol="stock.code" />
          </div>
        </el-tab-pane>

        <el-tab-pane v-if="isVisible('profile')" label="公司資訊" name="公司資訊">
          <template #label>
            <el-icon><component :is="TAB_ICONS['公司資訊']" /></el-icon>
            公司資訊
          </template>
          <StockProfileCard v-if="profile" :profile="profile" />
          <StockProfileCardShell v-else />
        </el-tab-pane>
      </el-tabs>
      </template>

      <!-- Loading skeleton for the brief window before preferencesReady/hasHydrated resolve —
           see this file's own comment at their declaration for why this exists (avoids every
           card flashing visible-then-hidden while a signed-in account's saved card selection
           is still being fetched). -->
      <div v-else v-loading="true" class="stock-detail-page__cards-loading" />
    </template>
  </div>
</template>

<style scoped>
/* No max-width/margin here on purpose (was a hardcoded 980px, ignoring the toggle entirely)
   — every other page gets its width from desktop.vue/mobile.vue's own .app-shell__inner /
   .app-shell__inner--centered wrapper (the 置中/滿版 switch), so this page should too rather
   than fighting it with a second, independent cap. Reported live ("版面寬度也要幫我調整"). */
.stock-detail-page {
  display: flex;
  flex-direction: column;
  gap: 24px;
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
   版本") — this whole-shell-rounded, uniform-background look is the one that stuck. */
.stock-detail-page__tabs.el-tabs--border-card {
  border-radius: 12px;
  overflow: hidden;
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

/* Fixed 2-column grid per direct request ("grid 一律改成 一個row兩cols") — was
   repeat(auto-fit, minmax(380px, 1fr)), which could land on 1/2/3 columns depending on
   viewport width; now always exactly 2 regardless of width, EXCEPT the mobile override below
   ("如果是手機板，每個row只會有一張卡片" — 2 columns on a phone-width screen squeezes every
   chart too narrow to read). Same 600px breakpoint dashboard.vue's own grid already collapses
   at (not reinvented here). */
.stock-detail-page__grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
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
