<script setup lang="ts">
import type { MarketDirectory } from '#shared/types/hub'

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
const { holdings, pending, loadFailed, market, load, ensureLoaded, clear } = useHoldings()
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
type AnalysisRow = (typeof rows.value)[number]

const totalValue = computed(() => rows.value.reduce((sum, row) => sum + (row.marketValue ?? 0), 0))
const unpricedCount = computed(() => rows.value.filter(row => row.marketValue === null).length)

const sectors = computed(() => groupByLabel(rows.value.map(row => ({ label: row.sector ?? '其他', value: row.marketValue }))))
type SectorRow = (typeof sectors.value)[number]

// 集中度的事實：最大一檔、前五大各占多少
const topOne = computed(() => rows.value[0]?.weight ?? null)
const topFive = computed(() => rows.value.slice(0, 5).reduce((sum, row) => sum + (row.weight ?? 0), 0))

function percent(value: number | null, digits = 1): string {
  return value === null ? '－' : `${(value * 100).toFixed(digits)}%`
}

watch([authResolved, () => currentUser.value?.uid], ([resolved, uid]) => {
  if (!resolved) return
  if (uid) ensureLoaded()
  else clear()
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
      </dl>
      <p v-if="unpricedCount" class="analysis-page__note">{{ unpricedCount }} 檔目前沒有報價，未計入占比。</p>

      <section aria-labelledby="analysis-sector-title">
        <h2 id="analysis-sector-title" class="analysis-page__section-title">產業占比</h2>
        <p v-if="!directory" class="analysis-page__note">產業分類載入中…</p>
        <template v-else>
          <HoldingsAllocationChart :items="sectors.map(sector => ({ label: sector.label, value: sector.value }))" />
          <el-table :data="sectors" row-key="label" class="analysis-table">
            <el-table-column label="產業" prop="label" min-width="140" />
            <el-table-column label="檔數" align="right" min-width="70">
              <template #default="{ row }">{{ tableRow<SectorRow>(row).count }}</template>
            </el-table-column>
            <el-table-column label="市值" align="right" min-width="130">
              <template #default="{ row }">{{ holdingsMoney(tableRow<SectorRow>(row).value) }} 元</template>
            </el-table-column>
            <el-table-column label="占比" align="right" min-width="90">
              <template #default="{ row }">{{ percent(tableRow<SectorRow>(row).value / totalValue) }}</template>
            </el-table-column>
          </el-table>
          <p class="analysis-page__footnote">產業是證交所與櫃買中心的類股分類。ETF 自成一類；特別股歸到發行公司的產業。</p>
        </template>
      </section>

      <section aria-labelledby="analysis-holding-title">
        <h2 id="analysis-holding-title" class="analysis-page__section-title">個股占比</h2>
        <HoldingsAllocationChart :items="rows.map(row => ({ label: row.name, value: row.marketValue ?? 0 }))" />
        <el-table :data="rows" row-key="symbol" class="analysis-table">
          <el-table-column label="名稱" min-width="160">
            <template #default="{ row }">
              <NuxtLink :to="tableRow<AnalysisRow>(row).link">{{ tableRow<AnalysisRow>(row).name }}</NuxtLink>
              <span class="analysis-page__code">{{ tableRow<AnalysisRow>(row).symbol }}</span>
            </template>
          </el-table-column>
          <el-table-column label="產業" min-width="120">
            <template #default="{ row }">{{ tableRow<AnalysisRow>(row).sector ?? '－' }}</template>
          </el-table-column>
          <el-table-column label="市值" align="right" min-width="130">
            <template #default="{ row }">{{ tableRow<AnalysisRow>(row).marketValue === null ? '－' : `${holdingsMoney(tableRow<AnalysisRow>(row).marketValue!)} 元` }}</template>
          </el-table-column>
          <el-table-column label="占比" align="right" min-width="90">
            <template #default="{ row }">{{ percent(tableRow<AnalysisRow>(row).weight) }}</template>
          </el-table-column>
        </el-table>
      </section>

      <p class="analysis-page__footnote">占比＝市值 ÷ 總市值，以最新收盤價計算。數字只陳述目前的分布，不構成任何配置或買賣建議。</p>
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

.analysis-page__footnote {
  margin: 12px 0 0;
  color: var(--el-text-color-regular);
  line-height: 1.7;
}

.analysis-page__code {
  margin-left: 8px;
  color: var(--el-text-color-regular);
  font-variant-numeric: tabular-nums;
}

.analysis-table :deep(td) {
  font-variant-numeric: tabular-nums;
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
