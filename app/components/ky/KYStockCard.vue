<script setup lang="ts">
// Field set follows the forensic-accounting checklist in
// oingg-conductor-ts/docs/KY Stock Fundamental Analysis.md — the doc's core point is that a
// KY stock's headline EPS/P-E numbers hide more than they reveal given its offshore
// multi-layer holding structure, so this evaluates each of the doc's own quantitative red
// flags directly instead of just showing another quote. No backend source for any of this
// yet (see ky-stocks.vue) — this type is the shape a future /ky-stocks endpoint should fill
// in, not something already wired to real data.
export interface KYStock {
  code: string
  name: string
  price: number
  change: number
  changePercent: number
  // 存貸雙高 (doc §資產負債表之真實性檢驗) — cash sitting high alongside high short-term
  // debt at the same time is the classic sign the cash is pledged, frozen, or outright
  // fabricated. A real check also compares interest income against local deposit rates;
  // this card only has the balance-sheet half of that, so it's a simplified heuristic.
  cashAndEquivalents: number
  shortTermDebt: number
  // DSO (doc §應收帳款與減損) vs its own industry average — a DSO that's ballooned past
  // peers signals sales that were booked but aren't actually collectible.
  dso: number
  dsoIndustryAvg: number
  // 盈餘現金保障倍數 (doc §現金流量表之盈餘品質評估) — operating cash flow against net
  // income; profit that never turns into real cash is the doc's core "quality of earnings"
  // red flag, not just a growth-rate story.
  operatingCashFlow: number
  netIncome: number
  // 簽證會計師是否本年度異動 (doc §公司治理結構與外部審計信號) — a change with no clear
  // business reason usually means the outgoing auditor hit a wall (unconfirmed overseas bank
  // confirmations, restricted inventory counts, withheld documentation).
  auditorChangedRecently: boolean
  // 審計意見 (doc §關鍵查核事項) — anything beyond a clean opinion is a real signal, not
  // boilerplate.
  auditOpinion: 'unqualified' | 'qualified' | 'goingConcern'
  // 董監持股質押比率 (doc §股權結構與管理階層變動) — over 50% decouples management's own
  // stake from outside shareholders and risks a margin-call selloff if the price drops.
  pledgeRatio: number
  // 公開資訊觀測站財務重點專區 (doc §監理制度演進與市場預警工具運用) — TWSE's own 9-indicator
  // early-warning screen; being flagged there is an independent, already-public signal.
  flaggedByTwse: boolean
}

const props = defineProps<{
  stock: KYStock
}>()

interface Warning {
  label: string
}

// Each check mirrors one row of the doc's own two summary tables (財務報表之法證會計檢驗指標 /
// 公司治理結構與外部審計信號之定性剖析) — deliberately simple threshold comparisons, since
// the point of a card is a first-pass screen, not a replacement for actually reading the
// footnotes and KAM section.
const warnings = computed<Warning[]>(() => {
  const list: Warning[] = []
  if (props.stock.cashAndEquivalents > 5 && props.stock.shortTermDebt > 5) {
    list.push({ label: '存貸雙高' })
  }
  if (props.stock.dso > props.stock.dsoIndustryAvg * 1.5) {
    list.push({ label: 'DSO 遠高於同業' })
  }
  if (props.stock.operatingCashFlow < props.stock.netIncome * 0.5) {
    list.push({ label: '營業現金流落後淨利' })
  }
  if (props.stock.auditorChangedRecently) {
    list.push({ label: '簽證會計師異動' })
  }
  if (props.stock.auditOpinion !== 'unqualified') {
    list.push({ label: '審計意見非無保留' })
  }
  if (props.stock.pledgeRatio > 50) {
    list.push({ label: '董監質押比率過高' })
  }
  if (props.stock.flaggedByTwse) {
    list.push({ label: '財務重點專區警示' })
  }
  return list
})

// Low/medium/high purely by count, not weighted — a single flagged item (e.g. one routine
// auditor rotation) reads very differently from three-plus compounding together, but this
// card isn't trying to model exactly how much worse 3 is than 2.
const riskLevel = computed<'low' | 'medium' | 'high'>(() => {
  if (warnings.value.length >= 3) return 'high'
  if (warnings.value.length >= 1) return 'medium'
  return 'low'
})

const RISK_LABELS: Record<'low' | 'medium' | 'high', string> = {
  low: '無重大警訊',
  medium: '需留意',
  high: '高度警示'
}

const AUDIT_OPINION_LABELS: Record<KYStock['auditOpinion'], string> = {
  unqualified: '無保留意見',
  qualified: '保留意見',
  goingConcern: '繼續經營疑慮'
}

const router = useRouter()
</script>

<template>
  <el-card
    class="ky-stock-card"
    shadow="never"
    tabindex="0"
    role="link"
    :aria-label="`查看 ${stock.name} ${stock.code} 個股頁`"
    @click="router.push(`/stock/${stock.code}`)"
    @keydown.enter.self="router.push(`/stock/${stock.code}`)"
  >
    <div class="ky-stock-card__header">
      <div>
        <span class="ky-stock-card__name">{{ stock.name }}</span>
        <span class="ky-stock-card__code">{{ stock.code }}</span>
      </div>
      <div class="ky-stock-card__price">
        <span>{{ stock.price.toFixed(2) }}</span>
        <span :class="stock.change > 0 ? 'is-up' : stock.change < 0 ? 'is-down' : ''">
          {{ stock.change > 0 ? '+' : '' }}{{ stock.change.toFixed(2) }} ({{ stock.changePercent.toFixed(2) }}%)
        </span>
      </div>
    </div>

    <el-tag :type="riskLevel === 'low' ? 'success' : riskLevel === 'medium' ? 'warning' : 'danger'" effect="dark" class="ky-stock-card__risk">
      {{ RISK_LABELS[riskLevel] }}
    </el-tag>

    <div v-if="warnings.length" class="ky-stock-card__tags">
      <el-tag v-for="warning in warnings" :key="warning.label" size="large" type="danger" effect="plain">
        {{ warning.label }}
      </el-tag>
    </div>

    <div class="ky-stock-card__grid">
      <div class="ky-stock-card__field">
        <span class="ky-stock-card__label">現金／短期借款</span>
        <span>{{ stock.cashAndEquivalents.toFixed(1) }} / {{ stock.shortTermDebt.toFixed(1) }} 億</span>
      </div>
      <div class="ky-stock-card__field">
        <span class="ky-stock-card__label">DSO（同業）</span>
        <span>{{ stock.dso }} 天（{{ stock.dsoIndustryAvg }} 天）</span>
      </div>
      <div class="ky-stock-card__field">
        <span class="ky-stock-card__label">營業現金流／淨利</span>
        <span>{{ stock.operatingCashFlow.toFixed(1) }} / {{ stock.netIncome.toFixed(1) }} 億</span>
      </div>
      <div class="ky-stock-card__field">
        <span class="ky-stock-card__label">審計意見</span>
        <span>{{ AUDIT_OPINION_LABELS[stock.auditOpinion] }}</span>
      </div>
      <div class="ky-stock-card__field">
        <span class="ky-stock-card__label">董監質押比率</span>
        <span>{{ stock.pledgeRatio.toFixed(1) }}%</span>
      </div>
    </div>
  </el-card>
</template>

<style scoped>
.ky-stock-card {
  border-radius: 12px;
  cursor: pointer;
}

.ky-stock-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.ky-stock-card__name {
  font-weight: 600;
  margin-right: 8px;
}

.ky-stock-card__code {
  color: var(--el-text-color-secondary);
  font-size: 16px;
}

.ky-stock-card__price {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  font-size: 20px;
  font-weight: 600;
  flex-shrink: 0;
}

.ky-stock-card__price span:last-child {
  font-size: 16px;
  font-weight: 400;
}

.is-up {
  color: var(--price-up-color);
}

.is-down {
  color: var(--price-down-color);
}

.ky-stock-card__risk {
  margin-top: 12px;
}

.ky-stock-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}

/* Single column, not a 2-up grid like PreferredStockCard/EmergingMarketStockCard use —
   most of these values pair two numbers with a unit ("6.0 / 1.2 億", "88 天（45 天）") or
   run a multi-character label ("繼續經營疑慮"), too wide for half a card without wrapping
   into an awkward multi-line stack once squeezed into two columns. */
.ky-stock-card__grid {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 12px;
}

.ky-stock-card__field {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 16px;
  color: var(--el-text-color-regular);
}

.ky-stock-card__label {
  flex-shrink: 0;
  white-space: nowrap;
  color: var(--el-text-color-secondary);
}

.ky-stock-card__field span:last-child {
  text-align: right;
}
</style>
