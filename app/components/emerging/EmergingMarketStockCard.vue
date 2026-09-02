<script setup lang="ts">
// Field set follows oingg-conductor-ts/docs/興櫃股票投資注意事項.md's own risk breakdown —
// unlike a listed stock, an 興櫃 quote alone hides most of what actually matters here: no
// central matching (every trade counterparties against a 推薦證券商/market-maker), thinner
// disclosure, and a real delisting tail risk. No backend source for any of this yet (see
// emerging-market.vue) — this type is the shape a future /emerging-market endpoint should
// fill in, not something already wired to real data.
export interface EmergingMarketStock {
  code: string
  name: string
  price: number
  change: number
  changePercent: number
  // 彈性面額 (doc §結構性風險識別與估值定價陷阱) — a non-NT$10 face value inflates the total
  // share count proportionally, diluting EPS by the same factor; comparing P/E straight
  // against a listed peer without correcting for this overstates how expensive the stock
  // looks. 10 is the traditional/default face value, so only a value other than that needs
  // calling out as a "＊" flexible-par flag.
  parValue: number
  // 推薦證券商 (doc §造市商制度) — every quote's actual trading counterparty, not just an
  // intermediary; if every sponsor resigns, the stock gets delisted straight back to
  // unlisted status with zero public liquidity (doc §推薦證券商全數辭任所引發之終止登錄風險).
  sponsorCount: number
  // 財報揭露頻率 (doc §資訊揭露頻率不足與監管寬鬆) — only annual + semi-annual filings are
  // mandatory here, no Q1/Q3 like a listed/OTC peer, a real up-to-6-month information gap,
  // not just a formality difference.
  lastDisclosureType: 'annual' | 'semiAnnual'
  lastDisclosureDate: string
  // 轉板狀態 (doc §轉板上市櫃之折溢價收斂與定價落差) — the main source of the excess return
  // most 興櫃 investing is actually betting on, but "登錄滿 6 個月" is only a formal
  // eligibility gate, not approval — 'reviewing'/'applied' still carries real rejection risk.
  listingTransferStatus: 'none' | 'applied' | 'reviewing'
  // 50% 熔斷 (doc §價格波動控管邊界與流動性阻斷機制) — trading halts completely until that
  // day's close the moment the day's average price deviates 50%+ from the prior day's, with
  // no way to exit or add regardless of price.
  circuitBreakerTriggered: boolean
}

defineProps<{
  stock: EmergingMarketStock
}>()

const DISCLOSURE_LABELS: Record<EmergingMarketStock['lastDisclosureType'], string> = {
  annual: '年報',
  semiAnnual: '半年報'
}

const TRANSFER_STATUS_LABELS: Record<EmergingMarketStock['listingTransferStatus'], string> = {
  none: '尚未申請轉板',
  applied: '已申請轉板',
  reviewing: '轉板審查中'
}

const router = useRouter()
</script>

<template>
  <el-card
    class="emerging-stock-card"
    shadow="never"
    tabindex="0"
    role="link"
    :aria-label="`查看 ${stock.name} ${stock.code} 個股頁`"
    @click="router.push(`/stock/${stock.code}`)"
    @keydown.enter.self="router.push(`/stock/${stock.code}`)"
  >
    <div class="emerging-stock-card__header">
      <div>
        <span class="emerging-stock-card__name">{{ stock.name }}</span>
        <span class="emerging-stock-card__code">{{ stock.code }}</span>
      </div>
      <div class="emerging-stock-card__price">
        <span>{{ stock.price.toFixed(2) }}</span>
        <span :class="stock.change > 0 ? 'is-up' : stock.change < 0 ? 'is-down' : ''">
          {{ stock.change > 0 ? '+' : '' }}{{ stock.change.toFixed(2) }} ({{ stock.changePercent.toFixed(2) }}%)
        </span>
      </div>
    </div>

    <div class="emerging-stock-card__tags">
      <el-tag v-if="stock.parValue !== 10" size="large" type="danger" effect="plain">
        ＊彈性面額 ${{ stock.parValue }}
      </el-tag>
      <el-tag size="large" :type="stock.sponsorCount <= 1 ? 'danger' : 'info'" effect="plain">
        {{ stock.sponsorCount }} 家推薦證券商
      </el-tag>
      <el-tag v-if="stock.circuitBreakerTriggered" size="large" type="danger" effect="plain">熔斷暫停交易中</el-tag>
      <el-tag v-if="stock.listingTransferStatus !== 'none'" size="large" type="warning" effect="plain">
        {{ TRANSFER_STATUS_LABELS[stock.listingTransferStatus] }}
      </el-tag>
    </div>

    <div class="emerging-stock-card__grid">
      <div class="emerging-stock-card__field">
        <span class="emerging-stock-card__label">每股面額</span>
        <span>${{ stock.parValue }}</span>
      </div>
      <div class="emerging-stock-card__field">
        <span class="emerging-stock-card__label">推薦證券商</span>
        <span>{{ stock.sponsorCount }} 家</span>
      </div>
      <div class="emerging-stock-card__field">
        <span class="emerging-stock-card__label">最近財報</span>
        <span>{{ DISCLOSURE_LABELS[stock.lastDisclosureType] }}（{{ stock.lastDisclosureDate }}）</span>
      </div>
      <div class="emerging-stock-card__field">
        <span class="emerging-stock-card__label">轉板狀態</span>
        <span>{{ TRANSFER_STATUS_LABELS[stock.listingTransferStatus] }}</span>
      </div>
    </div>
  </el-card>
</template>

<style scoped>
.emerging-stock-card {
  border-radius: 12px;
  cursor: pointer;
}

.emerging-stock-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.emerging-stock-card__name {
  font-weight: 600;
  margin-right: 8px;
}

.emerging-stock-card__code {
  color: var(--el-text-color-secondary);
  font-size: 16px;
}

.emerging-stock-card__price {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  font-size: 20px;
  font-weight: 600;
  flex-shrink: 0;
}

.emerging-stock-card__price span:last-child {
  font-size: 16px;
  font-weight: 400;
}

.is-up {
  color: var(--price-up-color);
}

.is-down {
  color: var(--price-down-color);
}

.emerging-stock-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 12px 0;
}

.emerging-stock-card__grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px 16px;
}

.emerging-stock-card__field {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 16px;
  color: var(--el-text-color-regular);
}

/* Fixed-width labels ("最近財報"/"轉板狀態") could otherwise wrap onto two lines in a
   narrow card once the value beside them (e.g. a date) pushes the row's available width
   below the label's own natural width — nowrap+shrink:0 keeps the label whole and lets the
   value take whatever's left, wrapping itself if it needs to instead. */
.emerging-stock-card__label {
  flex-shrink: 0;
  white-space: nowrap;
  color: var(--el-text-color-secondary);
}

.emerging-stock-card__field span:last-child {
  text-align: right;
}
</style>
