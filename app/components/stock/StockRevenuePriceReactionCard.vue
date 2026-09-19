<script setup lang="ts">

// 30-char strict cap (standing rule, see feedback_info_text_30_char_limit memory).
const INFO_TEXT = '最新月營收公告後至今的股價變化'

// Split OUT of StockPriceRevenueChart.vue 2026-09-16 per direct request ("這張幫我拆開，因為他說
// 了兩件事情。第一個是五年月營收與自己股價的關係。另一個是上次月營收公布後到現在的股價變化。一次
// 塞了太多資訊。") — that card bundled two genuinely different questions/time-scales into one:
// a multi-年 lookback-window chart (月營收 vs 收盤價 relationship over years) PLUS a single-event
// short-term stat (市場對「上一次」月營收公告的反應). This card keeps only the second one — no
// lookback window, no chart, just the one number for the most recent announcement, same
// single-stat-tile layout StockDividendGrowthRateCard.vue already uses for a similar "few related
// numbers, no time series" case.
const props = defineProps<{
  symbol: string
}>()

const symbolRef = computed(() => props.symbol)
const { data: allRevenueEntries, pending: revenuePending } = useMonthlyRevenueHistory(symbolRef)
const latestRevenueEntry = computed(() => allRevenueEntries.value?.at(-1) ?? null)

// A 60-day window is comfortably more than enough to reach back from "now" to the latest
// revenue report's own reportDate (monthly reports, so the gap is at most ~1 month) — a much
// smaller/cheaper fetch than the price/revenue chart's own 2000-day request (that one needs
// years of history for its own lookback window; this card only ever looks at the most recent
// announcement). Separate cache key from that other request (useDailyPriceHistory keys its cache
// by symbol+limit), so this doesn't reuse or conflict with it.
const dailyLimit = ref(60)
const { data: dailyPrices, pending: pricePending } = useDailyPriceHistory(symbolRef, dailyLimit)

const pending = computed(() => revenuePending.value || pricePending.value)

// 「公布後股價變化」= 從公告日（reportDate，不是 yearMonth 那個營收所屬月份）當天或之後第一個
// 交易日的收盤價，到目前為止（dailyPrices 陣列最後一筆）的漲跌幅。reportDate 常常落在假日/非
// 交易日，findIndex 找「>= reportDate 的第一筆」就是公告後真正第一個有交易的收盤價，不是公告
// 前最後一天（那樣會把公告當天的市場反應算漏）。
const priceChangeSinceReport = computed(() => {
  const entry = latestRevenueEntry.value
  const daily = dailyPrices.value
  if (!entry || !daily || daily.length === 0) return null
  const reportIndex = daily.findIndex(d => d.tradeDate >= entry.reportDate)
  if (reportIndex === -1) return null
  const basePrice = daily[reportIndex]!.close
  const latestPrice = daily.at(-1)!.close
  if (basePrice === 0) return null
  return ((latestPrice - basePrice) / basePrice) * 100
})

function formatPercent(value: number | null): string {
  return value !== null ? `${value > 0 ? '+' : ''}${value.toFixed(2)}%` : '資料不足'
}

const hasAnyData = computed(() => latestRevenueEntry.value !== null)
</script>

<template>
  <el-card class="revenue-price-reaction-card" shadow="never">
    <template #header>
      <div class="revenue-price-reaction-card__header">
        <StockCardTitle title="營收公布後股價反應" :info-text="INFO_TEXT" />
      </div>
    </template>

    <SharedEmptyState v-if="!pending && !hasAnyData" description="這檔股票尚無歷史資料，可能尚未排入資料回填" />
    <template v-else>
      <div v-loading="pending" class="revenue-price-reaction-card__stat">
        <span class="revenue-price-reaction-card__stat-label">{{ latestRevenueEntry?.yearMonth ?? '' }} 營收公布後</span>
        <span class="revenue-price-reaction-card__stat-value">{{ formatPercent(priceChangeSinceReport) }}</span>
      </div>
      <SharedDataFreshnessNote source-label="公開發行公司月營收公告／證交所每日收盤價" :as-of="latestRevenueEntry?.reportDate ?? null" />
    </template>
  </el-card>
</template>

<style scoped>
.revenue-price-reaction-card {
  border-radius: 12px;
}

.revenue-price-reaction-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.revenue-price-reaction-card__stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 20px 4px;
  border-radius: 8px;
  background: var(--el-fill-color-light);
}

.revenue-price-reaction-card__stat-label {
  font-size: 0.875rem;
  color: var(--el-text-color-secondary);
}

.revenue-price-reaction-card__stat-value {
  font-size: 1.75rem;
  font-weight: 600;
}
</style>
