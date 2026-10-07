<script setup lang="ts">
import type { MarketDirectory } from '#shared/types/hub'
import type { RiskReport } from '~/composables/stock/useHoldings'

// 持股分析（2026-10-05）。使用者：「希望持股分析獨立出來一個 sidebar，這樣就可以評估產業占比。持股總覽那邊就可以
// 簡化 UIUX。跟占比分析有關的塞進新的功能。」所以圓餅圖與「占比」欄從持股總覽搬到這裡，再加上產業占比。
//
// 版面照站上的規矩：先圖後表（圖之後是同樣資料的表格，圖不是唯一的資料路徑）。只陳述占比，不說集中是好是壞
// （投信投顧法）。
//
// 產業用證交所類股，資料是全市場目錄 /api/hub/directory（Nitro 每天快取一次，個股總表用同一份、同一個 key）。
//
// Personal page: out of the index and the sitemap (/holdings/**).
useSeoMeta({ title: '持股分析', robots: 'noindex, nofollow' })

const currentUser = useCurrentUser()
const authResolved = useAuthResolved()
const { open: openLogin } = useLoginDialog()
const { holdings, pending, loadFailed, market, load, ensureLoaded, clear, fetchRisk } = useHoldings()
const { data: companies } = useCompanyIndex()
const { routeFor } = useStockSearch()
const companyByCode = computed(() => new Map(companies.value.map(entry => [entry.code, entry])))
const { data: directory } = useFetch<MarketDirectory>('/api/hub/directory', { key: 'hub-directory', lazy: true, server: false })

// 見 holdings/index.vue：登入狀態只在瀏覽器裡才知道，掛載前一律當成還不知道，免得 hydration 不一致。
const mounted = ref(false)
onMounted(() => {
  mounted.value = true
})

const sectorBySymbol = computed(() => {
  const map = new Map<string, string>()
  for (const sector of directory.value?.sectors ?? []) for (const company of sector.companies) map.set(company.symbol, sector.name)
  return map
})

const rows = computed(() => {
  const base = holdings.value.map((holding) => {
    const quote = market.value[holding.symbol]
    const figures = holdingRowFigures({ quantity: holding.quantity, costUnknownQuantity: holding.costUnknownQuantity, averageCost: holding.averageCost, price: quote?.price, dividendPerShare: quote?.dividendPerShare })
    const entry = companyByCode.value.get(holding.symbol)
    return {
      symbol: holding.symbol,
      name: entry?.name ?? holding.symbol,
      link: entry ? routeFor(entry) : `/stock/${holding.symbol}`,
      sector: directory.value ? sectorOfSymbol(holding.symbol, sectorBySymbol.value) : null,
      marketValue: figures.marketValue
    }
  })
  const total = base.reduce((sum, row) => sum + (row.marketValue ?? 0), 0)
  return base
    .map(row => ({ ...row, weight: total > 0 && row.marketValue !== null ? row.marketValue / total : null }))
    .sort((a, b) => (b.marketValue ?? -Infinity) - (a.marketValue ?? -Infinity))
})

const totalValue = computed(() => rows.value.reduce((sum, row) => sum + (row.marketValue ?? 0), 0))
const unpricedCount = computed(() => rows.value.filter(row => row.marketValue === null).length)

const sectors = computed(() => groupByLabel(rows.value.map(row => ({ label: row.sector ?? '其他', value: row.marketValue }))))

// 表格改用 HoldingsMetricTable（2026-10-07 a11y／mobile 盤點：el-table 在手機上把「市值」「占比」推到畫面外，
// 而那兩欄正是這頁的重點）。窄的時候每一列是一張小卡片，寬的時候是表格。
const sectorTableRows = computed(() => sectors.value.map(sector => ({
  name: sector.label,
  value: percent(sector.value / totalValue.value),
  market: `${holdingsMoney(sector.value)} 元`,
  meaning: `${sector.count} 檔`
})))
const holdingLabelOf = (row: (typeof rows.value)[number]) => `${row.name} ${row.symbol}`
const holdingTableRows = computed(() => rows.value.map(row => ({
  name: holdingLabelOf(row),
  value: percent(row.weight),
  market: row.marketValue === null ? '－' : `${holdingsMoney(row.marketValue)} 元`,
  meaning: row.sector ?? '－'
})))
const linkByLabel = computed(() => new Map(rows.value.map(row => [holdingLabelOf(row), row.link])))

// 集中度的事實：最大一檔、前五大各占多少
const topOne = computed(() => rows.value[0]?.weight ?? null)
const topFive = computed(() => rows.value.slice(0, 5).reduce((sum, row) => sum + (row.weight ?? 0), 0))

function percent(value: number | null, digits = 1): string {
  return value === null ? '－' : `${(value * 100).toFixed(digits)}%`
}

// ---- 持股的整體估值（bff-ts 9d691cd 的 risk.fundamentals）＋有效產業數（risk.sectors）。跟風險頁預設期間同一個
// 快取鍵，看過風險頁就不必再算一次。只陳述數字與涵蓋比例，不說貴或便宜（投信投顧法）。
const riskReport = ref<RiskReport | null>(null)
async function loadValuation() {
  const outcome = await fetchRisk(holdingsTaipeiDate(-1), holdingsTaipeiDate())
  riskReport.value = outcome.ok ? outcome.result : null
}
const valuationRows = computed(() => {
  const f = riskReport.value?.fundamentals
  if (!f) return []
  const pe = coverageText(f.peCoverage)
  const pb = coverageText(f.pbCoverage)
  return [
    { name: '本益比（整體）', value: holdingsMetricText(f.peRatio, 'ratio'), meaning: `各檔本益比依市值的調和平均${pe ? `；${pe}（虧損公司與 ETF 沒有本益比，不算入）` : ''}` },
    { name: '股價淨值比（整體）', value: holdingsMetricText(f.pbRatio, 'ratio'), meaning: `各檔股價淨值比依市值的調和平均${pb ? `；${pb}` : ''}` }
  ]
})
const effectiveSectorsText = computed(() => {
  const value = riskReport.value?.sectors?.effectiveSectors
  return value ? `依市值，相當於平均分散在 ${Number(value).toFixed(1)} 個產業。` : ''
})

watch([authResolved, () => currentUser.value?.uid], ([resolved, uid]) => {
  if (!resolved) return
  if (uid) {
    ensureLoaded()
    loadValuation()
  } else {
    clear()
    riskReport.value = null
  }
}, { immediate: true })
</script>

<template>
  <div class="analysis-page">
    <div class="analysis-page__heading">
      <h1 class="analysis-page__title">持股分析</h1>
      <p class="analysis-page__subtitle">依市值看資金分布在哪些產業、哪幾檔股票</p>
    </div>

    <HoldingsNav />

    <div v-if="!mounted || !authResolved" v-loading="true" class="analysis-page__placeholder" />

    <section v-else-if="!currentUser" class="analysis-guest">
      <h2 class="analysis-guest__title">登入後查看你的持股分析</h2>
      <p class="analysis-guest__text">持股資料存在你的帳號裡，只有你看得到。</p>
      <el-button type="primary" size="large" @click="openLogin">登入／註冊</el-button>
    </section>

    <el-alert v-else-if="loadFailed" type="error" :closable="false" show-icon title="持股資料暫時無法載入">
      <el-button class="analysis-page__retry" @click="load">重新載入</el-button>
    </el-alert>

    <div v-else-if="pending && !holdings.length" v-loading="true" class="analysis-page__placeholder" />

    <el-empty v-else-if="!holdings.length" description="還沒有記錄任何持股，先到持股總覽記一筆交易或匯入成交明細" :image-size="64" />

    <template v-else>
      <dl class="analysis-facts">
        <div class="analysis-facts__item"><dt>持股檔數</dt><dd>{{ rows.length }} 檔</dd></div>
        <div class="analysis-facts__item"><dt>產業數</dt><dd>{{ directory ? `${sectors.length} 個` : '－' }}</dd></div>
        <div class="analysis-facts__item"><dt>最大一檔占比</dt><dd>{{ percent(topOne) }}</dd></div>
        <div class="analysis-facts__item"><dt>前五大合計占比</dt><dd>{{ totalValue > 0 ? percent(topFive) : '－' }}</dd></div>
        <!-- 2026-10-07 從風險頁搬來：有效持股數（1 ÷ HHI）是占比的事實，不需要股價歷史 -->
        <div v-if="riskReport?.concentration" class="analysis-facts__item"><dt>有效持股數</dt><dd>{{ Number(riskReport.concentration.effectiveHoldings).toFixed(1) }} 檔</dd></div>
      </dl>
      <p v-if="unpricedCount" class="analysis-page__note">{{ unpricedCount }} 檔目前沒有報價，未計入占比。</p>

      <section aria-labelledby="analysis-sector-title">
        <h2 id="analysis-sector-title" class="analysis-page__section-title">產業占比</h2>
        <p v-if="!directory" class="analysis-page__note">產業分類載入中…</p>
        <template v-else>
          <HoldingsAllocationChart title="產業占比" :items="sectors.map(sector => ({ label: sector.label, value: sector.value }))" />
          <HoldingsMetricTable caption="各產業的市值與占比" :rows="sectorTableRows" name-label="產業" value-label="占比" market-label="市值" meaning-label="檔數" />
          <p v-if="effectiveSectorsText" class="analysis-page__note analysis-page__note--after">{{ effectiveSectorsText }}</p>
          <p class="analysis-page__footnote">產業是證交所與櫃買中心的類股分類。ETF 自成一類；特別股歸到發行公司的產業。</p>
        </template>
      </section>

      <section aria-labelledby="analysis-holding-title">
        <h2 id="analysis-holding-title" class="analysis-page__section-title">個股占比</h2>
        <HoldingsAllocationChart title="個股占比" :items="rows.map(row => ({ label: row.name, value: row.marketValue ?? 0 }))" />
        <HoldingsMetricTable caption="各檔持股的市值與占比" :rows="holdingTableRows" name-label="名稱" value-label="占比" market-label="市值" meaning-label="產業">
          <template #name="{ row }">
            <NuxtLink :to="linkByLabel.get(row.name) ?? '#'">{{ row.name }}</NuxtLink>
          </template>
        </HoldingsMetricTable>
      </section>

      <section v-if="valuationRows.length" aria-labelledby="analysis-valuation-title">
        <h2 id="analysis-valuation-title" class="analysis-page__section-title">持股的整體估值</h2>
        <HoldingsMetricTable caption="持股整體的本益比與股價淨值比" :rows="valuationRows" value-label="數值" />
        <p class="analysis-page__footnote">調和平均：把每一檔的「每股獲利（淨值）÷ 股價」依市值加權平均後取倒數，等於把整組持股當成一家公司來算。用最新收盤價與最新財報。</p>
      </section>

      <p class="analysis-page__footnote">占比＝市值 ÷ 總市值，以最新收盤價計算。</p>
    </template>
  </div>
</template>

<style scoped>
.analysis-page {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.analysis-page__heading {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.analysis-page__title {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0;
}

.analysis-page__subtitle {
  font-size: 1rem;
  color: var(--el-text-color-secondary);
  margin: 0;
}

.analysis-page__placeholder {
  min-height: 200px;
}

.analysis-page__retry {
  margin-top: 8px;
}

.analysis-page__section-title {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0 0 12px;
}

.analysis-page__note {
  margin: 0;
  color: var(--el-text-color-regular);
}

.analysis-page__note--after {
  margin-top: 12px;
}

.analysis-page__footnote {
  margin: 12px 0 0;
  color: var(--el-text-color-regular);
  line-height: 1.7;
}



.analysis-facts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 16px;
  margin: 0;
}

.analysis-facts__item {
  padding: 16px;
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  background: var(--el-bg-color);
}

.analysis-facts__item dt {
  color: var(--el-text-color-regular);
}

.analysis-facts__item dd {
  margin: 4px 0 0;
  font-size: 1.5rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.analysis-guest {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
  padding: 24px;
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  background: var(--el-bg-color);
}

.analysis-guest__title {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0;
}

.analysis-guest__text {
  margin: 0;
  color: var(--el-text-color-regular);
}
</style>
