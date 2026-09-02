<script setup lang="ts">
// Field set follows the contract-term breakdown in
// oingg-conductor-ts/docs/特別股評價注意事項.md's own "契約條款解構" section — the doc's
// core point is that a preferred stock's real risk/return isn't the quote alone, it's these
// five terms (liquidation preference aside, which only applies to the VC/PE-style multi-round
// preferred stock this app's screener/quote data will never carry — every field below is the
// subset that DOES apply to an ordinary exchange-listed 特別股). No backend source for any of
// this yet (see preferred-stocks.vue) — this type is the shape a future /preferred-stocks
// endpoint should fill in, not something already wired to real data.
export interface PreferredStock {
  code: string
  name: string
  price: number
  change: number
  changePercent: number
  // 股息率 — annual dividend ÷ face value, the rate actually printed on the issue terms.
  dividendRate: number
  // 參考殖利率 — that same dividend against today's market price, i.e. what a buyer at the
  // current price actually earns; diverges from dividendRate once price moves off par.
  referenceYield: number
  // 累積 vs 非累積 (doc §股息支付機制之財務實質) — whether a skipped dividend carries forward
  // and must eventually be paid, or is simply forfeited.
  dividendType: 'cumulative' | 'non-cumulative'
  // 參與分配權 (doc §清算優先權與參與分配機制) — kept even though liquidation itself is a tail
  // risk most retail holders never see, since it's still a real, disclosed contract term.
  participation: 'non-participating' | 'fully-participating' | 'capped-participating'
  // 轉換機制 (doc §轉換機制與反稀釋保護條款) — null conversionPrice when convertible is false.
  convertible: boolean
  conversionPrice: number | null
  // 贖回權 (doc §贖回權與賣回權) — the issuer's call date/price; null means no call provision
  // on file (rare, but not unheard of for older issues).
  callDate: string | null
  callPrice: number | null
  // Replaces creditRating (dropped — a real credit rating needs a paid feed from a ratings
  // agency like 中華信評, not something derivable from public financials, so it was never
  // going to be a field this app could actually fill in). These four are, and answer the
  // same underlying question a rating would — can this issuer actually keep servicing this
  // stock's dividend and honoring its call/put terms — via the doc's own §核心財務報表之
  // 法證會計檢驗指標 / 償債能力 checks instead.
  interestCoverage: number // 利息保障倍數（倍）— 稅前息前淨利 ÷ 利息費用
  debtRatio: number // 資產負債率（%）
  currentRatio: number // 流動比率（%）
  netDebtToEbitda: number // 淨負債對 EBITDA 比（倍）— 負值代表淨現金部位
}

defineProps<{
  stock: PreferredStock
}>()

const PARTICIPATION_LABELS: Record<PreferredStock['participation'], string> = {
  'non-participating': '無參與權',
  'fully-participating': '完全參與權',
  'capped-participating': '附上限參與權'
}

const router = useRouter()
</script>

<template>
  <el-card
    class="preferred-stock-card"
    shadow="never"
    tabindex="0"
    role="link"
    :aria-label="`查看 ${stock.name} ${stock.code} 個股頁`"
    @click="router.push(`/stock/${stock.code}`)"
    @keydown.enter.self="router.push(`/stock/${stock.code}`)"
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
        <span class="preferred-stock-card__label">股息率</span>
        <span class="preferred-stock-card__yield-value">{{ stock.dividendRate.toFixed(2) }}%</span>
      </div>
      <div class="preferred-stock-card__yield-item">
        <span class="preferred-stock-card__label">參考殖利率</span>
        <span class="preferred-stock-card__yield-value">{{ stock.referenceYield.toFixed(2) }}%</span>
      </div>
    </div>

    <div class="preferred-stock-card__tags">
      <el-tag size="large" effect="plain">
        {{ stock.dividendType === 'cumulative' ? '累積股息' : '非累積股息' }}
      </el-tag>
      <el-tag size="large" effect="plain">{{ PARTICIPATION_LABELS[stock.participation] }}</el-tag>
      <el-tag size="large" :type="stock.convertible ? 'warning' : 'info'" effect="plain">
        {{ stock.convertible ? '可轉換' : '不可轉換' }}
      </el-tag>
    </div>

    <div class="preferred-stock-card__grid">
      <div v-if="stock.convertible" class="preferred-stock-card__field">
        <span class="preferred-stock-card__label">轉換價格</span>
        <span>{{ stock.conversionPrice != null ? `$${stock.conversionPrice.toFixed(2)}` : '—' }}</span>
      </div>
      <div class="preferred-stock-card__field">
        <span class="preferred-stock-card__label">贖回日期</span>
        <span>{{ stock.callDate ?? '無贖回條款' }}</span>
      </div>
      <div v-if="stock.callDate" class="preferred-stock-card__field">
        <span class="preferred-stock-card__label">贖回價格</span>
        <span>{{ stock.callPrice != null ? `$${stock.callPrice.toFixed(2)}` : '—' }}</span>
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
  gap: 24px;
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

.preferred-stock-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.preferred-stock-card__grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px 16px;
}

.preferred-stock-card__field {
  display: flex;
  justify-content: space-between;
  font-size: 16px;
  color: var(--el-text-color-regular);
}

.preferred-stock-card__label {
  color: var(--el-text-color-secondary);
}
</style>
