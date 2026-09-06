<script setup lang="ts">
import { WarningFilled } from '@element-plus/icons-vue'

// Field set rebuilt 2026-09-06 to match conductor's 特別股專區.md — the doc's core point is
// that a preferred stock's real risk/return isn't the quote alone, it's its contract terms.
// Six dimensions from that doc's own ASCII diagram/table (股息累積性/股息參與權/清算優先倍數/
// 清算優先權/發行人贖回權/投資人賣回權), plus YTW (最差殖利率) as the headline valuation
// figure and a derived 距贖回日/溢價率/負凸性警示 trio. Dropped `convertible`/`conversionPrice`
// from the earlier field set — the new doc's own §2.5 notes real TW-listed 特別股 are
// "絕大多數屬於無轉換權的傳統固定收益型", and conversion terms aren't among its six dimensions.
// Still no backend source for any of this (see preferred-stocks.vue) — this type is the shape
// a future /preferred-stocks endpoint should fill in.
export interface PreferredStock {
  code: string
  name: string
  price: number
  change: number
  changePercent: number
  dividendRate: number // 股息率 — 票面年股息 ÷ 面額
  ytw: number // 最差殖利率 (Yield to Worst) — 持有至到期 vs 首個贖回日買回，取較低者
  // 累積 vs 非累積 (doc §股息累積性) — 非累積型在虧損年份停發股息，未來無須補發。
  dividendType: 'cumulative' | 'non-cumulative'
  // 參與分配權 (doc §股息參與權/剩餘分配權)。
  participation: 'non-participating' | 'fully-participating' | 'capped-participating'
  // 清算優先倍數 (doc §清算優先倍數) — 台股金融股常見 1x，非 1x 需額外標註提醒。
  liquidationPreference: number
  // 清算優先權敘述 (doc §清算優先權) — 例如「次順位債券之後、普通股之前」。
  liquidationPriority: string
  // 投資人賣回權 (doc §投資人賣回權) — 若為 true，會計上常使該檔更接近固定收益債券而非股權。
  putable: boolean
  // 發行人贖回權 (doc §發行人贖回權) — null 代表查無贖回條款（少見但存在）。
  callDate: string | null
  callPrice: number | null
  // 償債能力四項，取代需要付費信評資料才有的 creditRating — 回答同一個問題（發行人是否付得
  // 起這檔的股息、履行贖回/賣回條款）。
  interestCoverage: number // 利息保障倍數（倍）
  debtRatio: number // 資產負債率（%）
  currentRatio: number // 流動比率（%）
  netDebtToEbitda: number // 淨負債對 EBITDA 比（倍）— 負值代表淨現金部位
}

const props = defineProps<{
  stock: PreferredStock
  // 簡易軌只呈現五大契約維度徽章、YTW 與負凸性警示這類結論性資訊；償債能力四項與溢價率細節
  // 收斂至專家軌 — 有效存續期間/OAS 等更進階的量化指標（doc §2.5）尚未實作，不在這裡呈現。
  mode: 'novice' | 'pro'
}>()

const PARTICIPATION_LABELS: Record<PreferredStock['participation'], string> = {
  'non-participating': '非參與型',
  'fully-participating': '完全參與型',
  'capped-participating': '附上限參與型'
}

const router = useRouter()

// Derived-metric logic lives in app/utils/preferred-stock-metrics.ts, shared with
// preferred-stocks/[code].vue's detail view so the two never quietly drift.
const callCountdownText = computed(() => callCountdown(props.stock))
const premium = computed(() => premiumRate(props.stock))
const showNegativeConvexityWarning = computed(() => hasNegativeConvexityWarning(props.stock))
</script>

<!-- Links to /preferred-stocks/[code], not /stock/[code] — a preferred-stock code (e.g.
     "2002A") was never in useStockUniverse's common-stock list, so the old target 404'd into
     "找不到這檔股票" the moment someone actually clicked through. -->
<template>
  <el-card
    class="preferred-stock-card"
    shadow="never"
    tabindex="0"
    role="link"
    :aria-label="`查看 ${stock.name} ${stock.code} 詳細資料`"
    @click="router.push(`/preferred-stocks/${stock.code}`)"
    @keydown.enter.self="router.push(`/preferred-stocks/${stock.code}`)"
  >
    <div class="preferred-stock-card__header">
      <div>
        <span class="preferred-stock-card__name">{{ stock.name }}</span>
        <span class="preferred-stock-card__code">{{ stock.code }}</span>
      </div>
      <div class="preferred-stock-card__price">
        <span>{{ stock.price.toFixed(2) }}</span>
        <span :class="stock.change > 0 ? 'is-up' : stock.change < 0 ? 'is-down' : ''">
          {{ stock.change > 0 ? '+' : '' }}{{ stock.change.toFixed(2) }} ({{ stock.changePercent.toFixed(2) }}%)
        </span>
      </div>
    </div>

    <div class="preferred-stock-card__yield">
      <div class="preferred-stock-card__yield-item">
        <span class="preferred-stock-card__label">最差殖利率 (YTW)</span>
        <span class="preferred-stock-card__yield-value">{{ stock.ytw.toFixed(2) }}%</span>
      </div>
      <div class="preferred-stock-card__yield-item">
        <span class="preferred-stock-card__label">股息率</span>
        <span class="preferred-stock-card__yield-value">{{ stock.dividendRate.toFixed(2) }}%</span>
      </div>
      <div class="preferred-stock-card__yield-item">
        <span class="preferred-stock-card__label">距贖回日</span>
        <span class="preferred-stock-card__yield-value preferred-stock-card__yield-value--small">{{ callCountdownText }}</span>
      </div>
    </div>

    <div v-if="showNegativeConvexityWarning" class="preferred-stock-card__warning">
      <el-icon><WarningFilled /></el-icon>
      <span>負凸性警示：市價高於發行人贖回價，一旦發行人行使買回權，投資人將承擔溢價虧損，資本利得空間受限。</span>
    </div>

    <div class="preferred-stock-card__tags">
      <el-tag size="large" effect="plain">{{ stock.dividendType === 'cumulative' ? '累積型' : '非累積型' }}</el-tag>
      <el-tag size="large" effect="plain">{{ PARTICIPATION_LABELS[stock.participation] }}</el-tag>
      <el-tag size="large" :type="stock.liquidationPreference !== 1 ? 'warning' : 'info'" effect="plain">
        清算優先 {{ stock.liquidationPreference }}x
      </el-tag>
      <el-tag size="large" :type="stock.putable ? 'warning' : 'info'" effect="plain">
        {{ stock.putable ? '有賣回權' : '無賣回權' }}
      </el-tag>
    </div>

    <p class="preferred-stock-card__liquidation-priority">
      <span class="preferred-stock-card__label">清算優先權：</span>{{ stock.liquidationPriority }}
    </p>

    <template v-if="mode === 'pro'">
      <div class="preferred-stock-card__grid">
        <div class="preferred-stock-card__field">
          <span class="preferred-stock-card__label">贖回日期</span>
          <span>{{ stock.callDate ?? '無贖回條款' }}</span>
        </div>
        <div v-if="stock.callDate" class="preferred-stock-card__field">
          <span class="preferred-stock-card__label">贖回價格</span>
          <span>{{ stock.callPrice != null ? `$${stock.callPrice.toFixed(2)}` : '—' }}</span>
        </div>
        <div v-if="premium !== null" class="preferred-stock-card__field">
          <span class="preferred-stock-card__label">溢價率</span>
          <span :class="premium > 0 ? 'is-up' : premium < 0 ? 'is-down' : ''">
            {{ premium > 0 ? '+' : '' }}{{ premium.toFixed(2) }}%
          </span>
        </div>
        <div class="preferred-stock-card__field">
          <span class="preferred-stock-card__label">利息保障倍數</span>
          <span>{{ stock.interestCoverage.toFixed(1) }}x</span>
        </div>
        <div class="preferred-stock-card__field">
          <span class="preferred-stock-card__label">資產負債率</span>
          <span>{{ stock.debtRatio.toFixed(1) }}%</span>
        </div>
        <div class="preferred-stock-card__field">
          <span class="preferred-stock-card__label">流動比率</span>
          <span>{{ stock.currentRatio.toFixed(1) }}%</span>
        </div>
        <div class="preferred-stock-card__field">
          <span class="preferred-stock-card__label">淨負債／EBITDA</span>
          <span>{{ stock.netDebtToEbitda.toFixed(1) }}x</span>
        </div>
      </div>
    </template>
  </el-card>
</template>

<style scoped>
.preferred-stock-card {
  border-radius: 12px;
  cursor: pointer;
}

.preferred-stock-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.preferred-stock-card__name {
  font-weight: 600;
  margin-right: 8px;
}

.preferred-stock-card__code {
  color: var(--el-text-color-secondary);
  font-size: 16px;
}

.preferred-stock-card__price {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  font-size: 20px;
  font-weight: 600;
  flex-shrink: 0;
}

.preferred-stock-card__price span:last-child {
  font-size: 16px;
  font-weight: 400;
}

.is-up {
  color: var(--price-up-color);
}

.is-down {
  color: var(--price-down-color);
}

.preferred-stock-card__yield {
  display: flex;
  flex-wrap: wrap;
  gap: 16px 24px;
  margin: 12px 0;
  padding: 12px;
  border-radius: 8px;
  background: var(--el-fill-color-light);
}

.preferred-stock-card__yield-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.preferred-stock-card__yield-value {
  font-size: 20px;
  font-weight: 600;
  color: var(--el-color-primary);
}

.preferred-stock-card__yield-value--small {
  font-size: 16px;
}

.preferred-stock-card__warning {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--el-color-warning-light-9);
  color: var(--el-color-warning-dark-2);
  font-size: 16px;
}

.preferred-stock-card__warning .el-icon {
  flex-shrink: 0;
  margin-top: 2px;
}

.preferred-stock-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.preferred-stock-card__liquidation-priority {
  margin: 0 0 12px;
  font-size: 16px;
  color: var(--el-text-color-regular);
}

/* Single column, not 2 — labels like "淨負債／EBITDA"/"利息保障倍數" are long enough at the
   16px accessibility floor (no shrinking allowed) that a 2-column grid forced them to wrap
   awkwardly mid-label even with a guaranteed gap. */
.preferred-stock-card__grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid var(--el-border-color-lighter);
}

/* gap, not just justify-content: space-between — a long label like "淨負債／EBITDA" can leave
   almost no room in a 2-column grid cell, crowding straight into its value with no visible
   separation otherwise. */
.preferred-stock-card__field {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 16px;
  color: var(--el-text-color-regular);
}

.preferred-stock-card__label {
  color: var(--el-text-color-secondary);
}
</style>
