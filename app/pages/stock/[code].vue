<script setup lang="ts">
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

// Backend-synced as of 2026-09-07 (bff-ts's GET/PUT /users/me/stock-detail-preferences — see
// useStockDetailPreferencesSync.ts's own comment). Called once here rather than inside
// useStockCards()/useStockExperienceMode() themselves, same "call site that already has both
// pieces" reasoning as that composable's own top comment.
useStockDetailPreferencesSync()
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

      <template v-else>
      <!-- Section order (估值河流圖 -> 財務數據 -> 公司資訊) matches
           STOCK_CARD_CATEGORIES in useStockCards.ts and encodes actual decision priority for a
           retirement/存股 investor per docs/Retiree Securities Investment Guide.md: valuation
           and financial-trend history is what you check first ("確認體質安全"), company
           background is contextual and comes last — the same "financial decision-support, not
           a corporate directory" reasoning StockProfileCard.vue already applies to its own
           field list. Previously this page put the profile card first and dumped all 4 charts
           into one flat grid; regrouped 2026-09-02 into labeled sections per
           docs/ui-ux/網格排版美學與實踐.md's zone/flowline guidance, reusing the same <section> +
           __section-title convention and 8pt spacing tokens already established in
           dashboard.vue and ky-stocks.vue (not reinvented here).

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
      <section v-if="isVisible('per-river') || isVisible('pbr-river')" class="stock-detail-page__section">
        <h2 class="stock-detail-page__section-title">估值河流圖</h2>
        <div class="stock-detail-page__grid">
          <StockValuationRiverChart
            v-if="isVisible('per-river')"
            :symbol="stock.code"
            kind="pe"
            title="本益比河流圖"
            info-text="色帶 = 近四季每股盈餘（EPS）× 本益比倍數，五級倍數依這檔股票自身的歷史本益比區間均分；線為股價。股價落在的色帶位置，反映目前估值相對自身歷史的高低。"
          />
          <StockValuationRiverChart
            v-if="isVisible('pbr-river')"
            :symbol="stock.code"
            kind="pb"
            title="本淨比河流圖"
            info-text="色帶 = 每股淨值 × 本淨比倍數，五級倍數依這檔股票自身的歷史本淨比區間均分；線為股價。常用於資產密集產業，看股價相對淨值的歷史位置。"
          />
        </div>
      </section>

      <section
        v-if="isVisible('eps') || isVisible('revenue') || isVisible('share-capital') || isVisible('ex-dividend') || isVisible('roe') || isVisible('roa') || isVisible('dupont') || isVisible('dupont-extended')"
        class="stock-detail-page__section"
      >
        <h2 class="stock-detail-page__section-title">財務數據</h2>
        <div class="stock-detail-page__grid">
          <StockMetricHistoryChart
            v-if="isVisible('eps')"
            :symbol="stock.code"
            metric-code="eps"
            basis="TTM"
            title="四季 EPS"
            chart-type="bar"
            unit="元"
            info-text="近四季每股盈餘（TTM EPS）加總，反映公司近一年的獲利能力。"
          />
          <StockRevenueChart
            v-if="isVisible('revenue')"
            :symbol="stock.code"
            info-text="每月由公司自行公告，年增率／月增率／累計營收年增率分別對比去年同月、上月、去年同期累計。年增率反映資料回填當下的官方記錄，若原始月份事後有更正，此處不會自動同步最新值。"
          />
          <template v-if="isVisible('share-capital')">
            <StockShareCapitalChart v-if="capitalStockHistory" :entries="capitalStockHistory" />
            <StockChartShell v-else title="股本變化" variant="bars-line" :tabs="['近5年', '近10年']" />
          </template>
          <template v-if="isVisible('ex-dividend')">
            <StockExDividendCard v-if="exDividendNotices" :notices="exDividendNotices[code] ?? []" />
            <StockExDividendCardShell v-else />
          </template>
          <StockMetricHistoryChart
            v-if="isVisible('roe')"
            :symbol="stock.code"
            metric-code="roe"
            basis="TTM"
            title="ROE 趨勢"
            chart-type="line"
            unit="%"
            info-text="股東權益報酬率 = 稅後淨利 ÷ 股東權益，衡量公司運用股東資本創造獲利的效率。"
          />
          <StockMetricHistoryChart
            v-if="isVisible('roa')"
            :symbol="stock.code"
            metric-code="roa"
            basis="TTM"
            title="ROA 趨勢"
            chart-type="line"
            unit="%"
            info-text="資產報酬率 = 稅後淨利 ÷ 總資產，衡量公司運用全部資產（不論資金來源）創造獲利的效率。"
          />
          <StockDupontChart v-if="isVisible('dupont')" :symbol="stock.code" />
          <StockDupontExtendedChart v-if="isVisible('dupont-extended')" :symbol="stock.code" />
        </div>
      </section>

      <section v-if="isVisible('profile')" class="stock-detail-page__section">
        <h2 class="stock-detail-page__section-title">公司資訊</h2>
        <StockProfileCard v-if="profile" :profile="profile" />
        <StockProfileCardShell v-else />
      </section>
      </template>
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

.stock-detail-page__section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.stock-detail-page__section-title {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
}

/* Fixed 2-column grid per direct request ("grid 一律改成 一個row兩cols") — was
   repeat(auto-fit, minmax(380px, 1fr)), which could land on 1/2/3 columns depending on
   viewport width; now always exactly 2 regardless of width. */
.stock-detail-page__grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}
</style>
