<script setup lang="ts">
import type { MarketDirectory } from '#shared/types/hub'
import type { RiskReport } from '~/composables/holdings/holdings-model'

// 持股分析（2026-10-05）。使用者：「希望持股分析獨立出來一個 sidebar，這樣就可以評估產業占比。持股總覽那邊就可以
// 簡化 UIUX。跟占比分析有關的塞進新的功能。」
// 2026-10-19 使用者：「holdings/analysis 保留產業分析就好」——個股占比、持股的整體估值（本益比／股價淨值比）、上方一排數字卡都拿掉，
// 只剩產業占比：問句 → 答句 → 圖 → 表（站上的規矩，圖之後是同樣資料的表格，圖不是唯一的資料路徑）。只陳述占比，不說集中是好是壞
// （投信投顧法）。
//
// 產業用證交所類股，資料是全市場目錄 /api/hub/directory（Nitro 每天快取一次，個股總表用同一份、同一個 key）。
//
// Personal page: out of the index and the sitemap (/holdings/**).
useSeoMeta({ title: '持股分析', robots: 'noindex, nofollow' })

const authResolved = useAuthResolved()
const { holdings, pending, loadFailed, market, load, ensureLoaded, clear, fetchRisk } = useHoldings()
// 讀不到時交給全站的讀取失敗彈窗（AppLoadFailureDialog，2026-10-08），畫面上不再各自出訊息
watchLoadFailure('holdings', () => loadFailed.value, load)
const { data: directory } = useFetch<MarketDirectory>('/api/hub/directory', { key: 'hub-directory', lazy: true, server: false })

const sectorBySymbol = computed(() => {
  const map = new Map<string, string>()
  for (const sector of directory.value?.sectors ?? []) for (const company of sector.companies) map.set(company.symbol, sector.name)
  return map
})

const rows = computed(() => holdings.value.map((holding) => {
  const quote = market.value[holding.symbol]
  const figures = holdingRowFigures({ quantity: holding.quantity, costUnknownQuantity: holding.costUnknownQuantity, averageCost: holding.averageCost, price: quote?.price, dividendPerShare: quote?.dividendPerShare })
  return { sector: directory.value ? sectorOfSymbol(holding.symbol, sectorBySymbol.value) : null, marketValue: figures.marketValue }
}))

const totalValue = computed(() => rows.value.reduce((sum, row) => sum + (row.marketValue ?? 0), 0))
const unpricedCount = computed(() => rows.value.filter(row => row.marketValue === null).length)

const sectors = computed(() => groupByLabel(rows.value.map(row => ({ label: row.sector ?? '其他', value: row.marketValue }))))

// 表格用 HoldingsMetricTable（2026-10-07 a11y／mobile 盤點：el-table 在手機上把「市值」「占比」推到畫面外，
// 而那兩欄正是這頁的重點）。窄的時候每一列是一張小卡片，寬的時候是表格。
const sectorTableRows = computed(() => sectors.value.map(sector => ({
  name: sector.label,
  value: percent(sector.value / totalValue.value),
  market: `${holdingsMoney(sector.value)} 元`,
  meaning: `${sector.count} 檔`
})))

function percent(value: number | null, digits = 1): string {
  return value === null ? '－' : `${(value * 100).toFixed(digits)}%`
}

// 答句：幾檔持股、分布在幾個產業、最大的是哪一個
const answer = computed(() => {
  const top = sectors.value[0]
  if (!top || totalValue.value <= 0) return ''
  return `${rows.value.length} 檔持股分布在 ${sectors.value.length} 個產業，占比最大的是${top.label}（${percent(top.value / totalValue.value)}）。`
})

// 有效產業數（業務中台 risk.sectors，依市值算的「相當於平均分散在幾個產業」）。跟風險頁預設期間同一個快取鍵，看過風險頁就不必再算一次
const riskReport = ref<RiskReport | null>(null)
async function loadEffectiveSectors() {
  const outcome = await fetchRisk(...holdingsLastYear())
  riskReport.value = outcome.ok ? outcome.result : null
}
const effectiveSectorsText = computed(() => {
  const value = riskReport.value?.sectors?.effectiveSectors
  return value ? `依市值，相當於平均分散在 ${Number(value).toFixed(1)} 個產業。` : ''
})

// 誰＋哪個帳戶（2026-10-19）：換帳戶就跟換人一樣重新載入
const { holdingsScope } = useHoldingsPortfolios()
watch([authResolved, holdingsScope], ([resolved, uid]) => {
  if (!resolved) return
  if (uid) {
    ensureLoaded()
    loadEffectiveSectors()
  } else {
    clear()
    riskReport.value = null
  }
}, { immediate: true })
</script>

<template>
  <HoldingsPageShell title="持股分析" subtitle="依市值看資金分布在哪些產業" guest-title="登入後查看你的持股分析">

    <!-- 讀不到：彈窗會說明並自動重讀；留空佔住這一支，免得落到下面的「還沒有持股」 -->
    <template v-if="loadFailed" />

    <div v-else-if="pending && !holdings.length" v-loading="true" class="app-loading-placeholder" />

    <el-empty v-else-if="!holdings.length" description="還沒有記錄任何持股，先到持股總覽記一筆交易或匯入成交明細" :image-size="64" />

    <section v-else aria-labelledby="analysis-sector-title">
      <h2 id="analysis-sector-title" class="analysis-page__section-title">資金分布在哪些產業？</h2>
      <p v-if="!directory" class="analysis-page__note">產業分類載入中…</p>
      <template v-else>
        <p v-if="answer" class="analysis-page__answer">{{ answer }}<template v-if="effectiveSectorsText">{{ effectiveSectorsText }}</template></p>
        <p v-if="unpricedCount" class="analysis-page__note">{{ unpricedCount }} 檔目前沒有報價，未計入占比。</p>
        <HoldingsAllocationChart title="產業占比" :items="sectors.map(sector => ({ label: sector.label, value: sector.value }))" />
        <HoldingsMetricTable caption="各產業的市值與占比" :rows="sectorTableRows" name-label="產業" value-label="占比" market-label="市值" meaning-label="檔數" />
        <p class="analysis-page__footnote">產業是證交所與櫃買中心的類股分類。ETF 自成一類；特別股歸到發行公司的產業。占比＝市值 ÷ 總市值，以最新收盤價計算。</p>
      </template>
    </section>
  </HoldingsPageShell>
</template>

<style scoped>
.analysis-page__section-title {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0 0 12px;
}

.analysis-page__answer {
  margin: 0 0 12px;
}

.analysis-page__note {
  margin: 0 0 12px;
  color: var(--el-text-color-regular);
}

.analysis-page__footnote {
  margin: 12px 0 0;
  color: var(--el-text-color-regular);
  line-height: 1.7;
}
</style>
