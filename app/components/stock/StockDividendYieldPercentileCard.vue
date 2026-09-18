<script setup lang="ts">
import { InfoFilled } from '@element-plus/icons-vue'

// 現金殖利率的市場排名 — added 2026-09-18 per direct request ("配股配息 加上一張 量表 看出 個股的
// 現金殖利率，在全部市場PR多少"). Reuses StockDividendStabilityCard.vue's own
// useDividendStabilitySnapshot for the current dividendYield.EOD value (same field, same fetch
// pattern, no second independent source of truth for "what's this stock's own 殖利率 right now")
// — this card's own new piece is useMarketPercentileRank.ts, which answers "where does that
// number sit against the whole market" (see that composable's own comment for how it computes a
// true cross-sectional percentile without bulk-fetching all ~1,583 listed stocks).
//
// showToggle=false (see SharedPercentileGaugeExpand.vue's own comment on that prop) — a single
// fact (current value + market rank), no further chart to expand into; every OTHER adopter of
// that component either has a real history chart behind the toggle or shares one with a sibling
// gauge, neither applies here.
const INFO_TEXT = '目前殖利率在全市場（約1,500檔上市櫃公司）的百分位排名——數字越高，代表贏過越多檔股票，純粹統計排名，不代表股價便宜或昂貴'

const props = defineProps<{
  symbol: string
}>()

const symbolRef = computed(() => props.symbol)
const { data: snapshot, pending: snapshotPending } = useDividendStabilitySnapshot(symbolRef)

const dividendYield = computed<number | null>(() => {
  const raw = snapshot.value?.['dividendYield.EOD']?.value
  return raw != null ? Number(raw) : null
})

const { data: rank, pending: rankPending } = useMarketPercentileRank('dividendYield.EOD', dividendYield)

const pending = computed(() => snapshotPending.value || rankPending.value)
const hasData = computed(() => dividendYield.value !== null && rank.value !== null)

// Same site-wide up/down convention as every other percentile gauge (see StockYieldFamilyCard.vue's
// own identical call) — 2.4.3's own gauge-color spec is overridden by direct instruction to bind
// gauge color to the app's real 漲跌 color pair, not a fixed red/green pair independent of the
// user's own 台股/美股 convention setting.
const { resolvedMode, market } = useAppTheme()
const priceColors = computed(() => getPriceColors(resolvedMode.value, market.value))

function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`
}

// Real bug fixed 2026-09-18 (reported live: "量尺的位置看起來不像是PR27") —
// SharedPercentileGaugeExpand's own marker position is a LINEAR interpolation between `min`/`max`
// (see that component's own markerPosition computed), not the percentile rank itself. Every
// EXISTING adopter (StockValuationRiverChart.vue etc.) feeds it a small ~20-40-point OWN-HISTORY
// window, where that distinction rarely reads as visibly wrong — but 現金殖利率 across the whole
// ~1,583-stock MARKET is heavily right-skewed (a long tail of very few high-yield outliers
// stretching max to ~19.6%, most stocks clustered far below that), so a stock at PR27 (0.92%) sat
// at barely ~5% of the way along a 0–19.6% linear bar — nowhere near where "27" reads on a 0–100
// scale, exactly the mismatch reported. Fixed by feeding the bar the PERCENTILE itself (0–100)
// as `current`/`min`/`max` instead of the raw yield value/its market extremes — the marker's
// linear position is then mathematically identical to the percentile by construction, no
// distribution-shape mismatch possible. `valueText` still shows the real 殖利率 percentage
// (that's the actual fact being described); only the BAR's own scale changed to percentile.
function formatScalePercentile(value: number): string {
  return `${Math.round(value)}`
}
</script>

<template>
  <el-card class="dividend-yield-percentile-card" shadow="never">
    <template #header>
      <div class="dividend-yield-percentile-card__header">
        <span class="dividend-yield-percentile-card__title">
          現金殖利率的市場排名
          <el-tooltip :content="INFO_TEXT" placement="top" :popper-style="{ maxWidth: '280px' }">
            <el-icon class="dividend-yield-percentile-card__info"><InfoFilled /></el-icon>
          </el-tooltip>
        </span>
      </div>
    </template>

    <el-empty v-if="!pending && !hasData" description="這檔股票尚無殖利率資料，或市場排名暫時無法計算" :image-size="64" />
    <SharedPercentileGaugeExpand
      v-else
      :expanded="false"
      :show-toggle="false"
      :loading="pending"
      :current="rank?.percentile ?? 0"
      :min="0"
      :max="100"
      :value-text="`現金殖利率 ${formatPercent(dividendYield ?? 0)}`"
      :percentile-text="rank ? `全市場第 ${Math.round(rank.percentile)} 百分位（PR${Math.round(rank.percentile)}）` : ''"
      :format-scale-value="formatScalePercentile"
      :gradient-from="priceColors.down"
      :gradient-to="priceColors.up"
    />
  </el-card>
</template>

<style scoped>
.dividend-yield-percentile-card {
  border-radius: 12px;
}

.dividend-yield-percentile-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.dividend-yield-percentile-card__title {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-weight: 600;
}

.dividend-yield-percentile-card__info {
  font-size: 0.875rem;
  color: var(--el-text-color-placeholder);
  cursor: help;
}
</style>
