<script setup lang="ts">
// Field set follows the risk/cost checklist in
// oingg-conductor-ts/docs/ETF Selection Guidelines.md — the doc's core point is that a
// headline yield or short-term return hides most of what actually determines a 20+ year
// outcome: expense ratio compounding, tracking precision, secondary-market premium/discount,
// and (for leveraged/inverse products) daily-reset decay. No backend source for any of this
// yet (see etf-zone.vue) — this type is the shape a future /etf-zone endpoint should fill
// in, not something already wired to real data.
export interface ETFFund {
  code: string
  name: string
  price: number
  change: number
  changePercent: number
  // 總費用率 (doc §總費用率的複利拖累與淨值侵蝕) — the single biggest determinant of 20+ year
  // terminal value; the doc's own suggested ceiling differs by category (原型台股 vs 全球型),
  // which is why this card's own warning check reads `category` alongside this instead of
  // one flat threshold.
  expenseRatio: number
  category: 'domesticEquity' | 'globalEquity' | 'bond' | 'leveraged' | 'commodity'
  // AUM，億元新台幣 (doc §資產管理規模、流動性與市場衝擊成本 / §法定下市清算門檻) — delisting
  // risk climbs as this approaches the legal liquidation threshold.
  aum: number
  // 日均成交量，張 (doc §資產管理規模、流動性...) — below ~1,000 signals thin secondary-market
  // depth and wider bid-ask spreads, a real hidden cost on top of the expense ratio.
  avgDailyVolume: number
  // 追蹤誤差 (doc §追蹤誤差之歸因分析) — annualized, %; a well-run index fund should stay
  // under roughly 1%.
  trackingError: number
  // 折溢價 (doc §次級市場折溢價之套利與均值回歸機制) — %, positive = premium (市價高於淨值),
  // negative = discount; regulators treat beyond ±3% as the abnormal-disclosure trigger the
  // doc itself cites.
  premiumDiscount: number
  // 複製法 (doc §追蹤誤差之歸因分析) — full physical replication preferred over
  // sampling/synthetic (swap-based) methods, which carry their own tracking/counterparty risk.
  replicationMethod: 'full' | 'sampling' | 'synthetic'
  // 槓桿倍數 (doc §槓桿型與反向型 ETF 的每日重置與波動損耗模型) — 1 for a plain, non-leveraged/
  // non-inverse fund; anything else (2, 3, -1...) means daily-reset beta-slippage decay
  // applies and the doc explicitly discourages holding beyond a 1–5 day trading window.
  leverageMultiple: number
  // 實際配息率 vs 參考配息率 (doc §金管會收益平準金動用四大治理指引) — the regulator's own red
  // flag: actual payout exceeding the index's own reference yield signals over-distributing
  // return-of-capital (收益平準金) rather than real income, propping up an unsustainable
  // headline yield.
  actualYield: number
  referenceYield: number
  // 註冊地 (doc §註冊地稅務穿透架構比較) — only meaningful for a foreign-domiciled ETF; null
  // for a Taiwan-domiciled fund, where this distinction doesn't apply.
  domicile: 'taiwan' | 'us' | 'ireland' | null
}

const props = defineProps<{
  stock: ETFFund
}>()

interface Warning {
  label: string
}

// Category-dependent expense-ratio ceiling — the doc only gives a precise number for 原型
// 台股 (0.30%–0.45%); everything else just gets "合理管理成本區間", so this uses a single
// looser ceiling for the rest rather than inventing precision the doc doesn't actually give.
const EXPENSE_RATIO_CEILING: Record<ETFFund['category'], number> = {
  domesticEquity: 0.45,
  globalEquity: 1.0,
  bond: 1.0,
  leveraged: 1.0,
  commodity: 1.0
}

const CATEGORY_LABELS: Record<ETFFund['category'], string> = {
  domesticEquity: '原型台股',
  globalEquity: '全球股票',
  bond: '債券型',
  leveraged: '槓桿／反向',
  commodity: '商品期貨型'
}

// Each check mirrors one row of the doc's own 投資決策矩陣與綜合篩選準則 table — deliberately
// simple threshold comparisons, a first-pass screen rather than a substitute for reading the
// fund's own公開說明書.
const warnings = computed<Warning[]>(() => {
  const list: Warning[] = []
  if (props.stock.expenseRatio > EXPENSE_RATIO_CEILING[props.stock.category]) {
    list.push({ label: '總費用率偏高' })
  }
  if (props.stock.aum < 2) {
    list.push({ label: '規模逼近下市門檻' })
  }
  if (props.stock.avgDailyVolume < 1000) {
    list.push({ label: '流動性不足' })
  }
  if (props.stock.trackingError > 1) {
    list.push({ label: '追蹤誤差偏高' })
  }
  if (Math.abs(props.stock.premiumDiscount) > 3) {
    list.push({ label: props.stock.premiumDiscount > 0 ? '溢價異常' : '折價異常' })
  }
  if (props.stock.leverageMultiple !== 1) {
    list.push({ label: '槓桿／反向，不宜長期持有' })
  }
  if (props.stock.actualYield > props.stock.referenceYield) {
    list.push({ label: '配息率高於參考配息率' })
  }
  return list
})

const riskLevel = computed<'low' | 'medium' | 'high'>(() => {
  if (warnings.value.length >= 3) return 'high'
  if (warnings.value.length >= 1) return 'medium'
  return 'low'
})

const RISK_LABELS: Record<'low' | 'medium' | 'high', string> = {
  low: '結構健康',
  medium: '需留意',
  high: '高度警示'
}

const REPLICATION_LABELS: Record<ETFFund['replicationMethod'], string> = {
  full: '完全複製',
  sampling: '代表性抽樣',
  synthetic: '合成複製'
}

const DOMICILE_LABELS: Record<Exclude<ETFFund['domicile'], null>, string> = {
  taiwan: '台灣',
  us: '美國',
  ireland: '愛爾蘭 UCITS'
}

const router = useRouter()
</script>

<template>
  <el-card class="etf-card" shadow="never" @click="router.push(`/stock/${stock.code}`)">
    <div class="etf-card__header">
      <div>
        <span class="etf-card__name">{{ stock.name }}</span>
        <span class="etf-card__code">{{ stock.code }}</span>
      </div>
      <div class="etf-card__price">
        <span>{{ stock.price.toFixed(2) }}</span>
        <span :class="stock.change > 0 ? 'is-up' : stock.change < 0 ? 'is-down' : ''">
          {{ stock.change > 0 ? '+' : '' }}{{ stock.change.toFixed(2) }} ({{ stock.changePercent.toFixed(2) }}%)
        </span>
      </div>
    </div>

    <div class="etf-card__yield">
      <div class="etf-card__yield-item">
        <span class="etf-card__label">總費用率</span>
        <span class="etf-card__yield-value">{{ stock.expenseRatio.toFixed(2) }}%</span>
      </div>
      <div class="etf-card__yield-item">
        <span class="etf-card__label">追蹤誤差</span>
        <span class="etf-card__yield-value">{{ stock.trackingError.toFixed(2) }}%</span>
      </div>
    </div>

    <el-tag :type="riskLevel === 'low' ? 'success' : riskLevel === 'medium' ? 'warning' : 'danger'" effect="dark" class="etf-card__risk">
      {{ RISK_LABELS[riskLevel] }}
    </el-tag>

    <div v-if="warnings.length" class="etf-card__tags">
      <el-tag v-for="warning in warnings" :key="warning.label" size="large" type="danger" effect="plain">
        {{ warning.label }}
      </el-tag>
    </div>

    <div class="etf-card__grid">
      <div class="etf-card__field">
        <span class="etf-card__label">類型</span>
        <span>{{ CATEGORY_LABELS[stock.category] }}</span>
      </div>
      <div class="etf-card__field">
        <span class="etf-card__label">規模（AUM）</span>
        <span>{{ stock.aum.toFixed(1) }} 億元</span>
      </div>
      <div class="etf-card__field">
        <span class="etf-card__label">日均成交量</span>
        <span>{{ stock.avgDailyVolume.toLocaleString('zh-TW') }} 張</span>
      </div>
      <div class="etf-card__field">
        <span class="etf-card__label">折溢價</span>
        <span>{{ stock.premiumDiscount > 0 ? '+' : '' }}{{ stock.premiumDiscount.toFixed(2) }}%</span>
      </div>
      <div class="etf-card__field">
        <span class="etf-card__label">複製法</span>
        <span>{{ REPLICATION_LABELS[stock.replicationMethod] }}</span>
      </div>
      <div v-if="stock.leverageMultiple !== 1" class="etf-card__field">
        <span class="etf-card__label">槓桿倍數</span>
        <span>{{ stock.leverageMultiple }}x</span>
      </div>
      <div class="etf-card__field">
        <span class="etf-card__label">配息率（參考）</span>
        <span>{{ stock.actualYield.toFixed(2) }}%（{{ stock.referenceYield.toFixed(2) }}%）</span>
      </div>
      <div v-if="stock.domicile && stock.domicile !== 'taiwan'" class="etf-card__field">
        <span class="etf-card__label">註冊地</span>
        <span>{{ DOMICILE_LABELS[stock.domicile] }}</span>
      </div>
    </div>
  </el-card>
</template>

<style scoped>
.etf-card {
  border-radius: 12px;
  cursor: pointer;
}

.etf-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.etf-card__name {
  font-weight: 600;
  margin-right: 8px;
}

.etf-card__code {
  color: var(--el-text-color-secondary);
  font-size: 16px;
}

.etf-card__price {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  font-size: 20px;
  font-weight: 600;
  flex-shrink: 0;
}

.etf-card__price span:last-child {
  font-size: 16px;
  font-weight: 400;
}

.is-up {
  color: var(--price-up-color);
}

.is-down {
  color: var(--price-down-color);
}

.etf-card__yield {
  display: flex;
  gap: 24px;
  margin: 12px 0;
  padding: 12px;
  border-radius: 8px;
  background: var(--el-fill-color-light);
}

.etf-card__yield-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.etf-card__yield-value {
  font-size: 20px;
  font-weight: 600;
  color: var(--el-color-primary);
}

.etf-card__risk {
  margin-bottom: 8px;
}

.etf-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

/* Single column, not a 2-up grid — several values pair a number with a unit or a second
   number in parentheses ("0 / 9,999 張", "2.50%（1.80%）"), too wide for half a card without
   wrapping badly, same reasoning as KYStockCard's own field grid. */
.etf-card__grid {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.etf-card__field {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 16px;
  color: var(--el-text-color-regular);
}

.etf-card__label {
  flex-shrink: 0;
  white-space: nowrap;
  color: var(--el-text-color-secondary);
}

.etf-card__field span:last-child {
  text-align: right;
}
</style>
