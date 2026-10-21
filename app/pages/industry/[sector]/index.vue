<script setup lang="ts">
import type { HubSector } from '#shared/types/hub'
import type { FactItem } from '~/components/shared/SharedFactList.vue'
// 類股首頁：指標速覽（2026-10-21，使用者：「個別產業 比照 個股瀏覽 他的sidebar也是 最上面是速覽 中間是好多個指標 這樣用戶體驗 UIUX
// 比較一致 也不會有好多圖表擠在同一個內容的問題」）。原本這個網址是一整頁：四張圖、三張表、公司名單。現在同 ETF 速覽：每個面向一張卡片
//（跟面向頁同一張圖，IndustryFacetChart），點標題進那一頁；卡片順序跟側欄一樣（useIndustryFacetOrder）。公司名單沒有圖，那一格放家數與
// 資料日期。
//
// 最下面兩份收起來的清單：本類股全部公司與其他類股。全部公司的連結留在這一頁是為了爬蟲的層數：個股頁離首頁要在三層內（check-click-depth：
// 首頁 → 產業索引 → 這一頁 → 個股）；有股價與指標的表格在「公司名單」那一面
const industry = await useIndustry('overview')
const { code, sectorName, data, rows, noindex } = industry
const { data: sectors } = await useFetch<HubSector[]>('/api/hub/sectors', { key: 'hub-sectors', default: () => [] })

const companyCount = computed(() => data.value?.sector.companyCount ?? 0)
const facts = computed<FactItem[]>(() => [
  // 全部都有指標數值時不寫第二個一樣的數字
  { label: '上市櫃公司', value: `${companyCount.value} 家`, note: rows.value.length === companyCount.value ? undefined : `有財報指標數值 ${rows.value.length} 家` },
  { label: '股價資料日期', value: data.value?.companies.quoteDate ?? '－' },
  { label: '財報資料至', value: data.value?.companies.fundamentalsDate ?? '－' }
])

// 有指標的與沒有指標的成員合在一起，依代號
const allCompanies = computed(() => [
  ...rows.value.map(row => ({ symbol: row.symbol, name: row.name })),
  ...(data.value?.unranked ?? [])
].sort((a, b) => a.symbol.localeCompare(b.symbol)))
const otherSectors = computed(() => sectors.value.filter(sector => sector.code !== code))

const { order } = useIndustryFacetOrder()
const labelOf = (key: string) => INDUSTRY_FACETS.find(facet => facet.key === key)!.label

const description = computed(() => clampDescription(`${sectorName}（證交所類股 ${code}）上市櫃公司 ${companyCount.value} 家：月營收與景氣同時指標、獲利能力三率、本益比與殖利率分布、殖利率與股利成長的圖，以及每家公司的股價與指標名單。`))
</script>

<template>
  <IndustryPage :code="code" :sector-name="sectorName" facet="overview" :description="description" :noindex="noindex">
    <section v-if="data" class="stock-page-section" aria-labelledby="industry-quick-view-heading">
      <!-- 段落標題只給螢幕閱讀器與大綱（卡片標題是 h3，不能跳級）；畫面上只有卡片 -->
      <h2 id="industry-quick-view-heading" class="visually-hidden">{{ sectorName }}各面向的圖</h2>
      <div class="industry-quick-view__grid">
        <template v-for="facet in order" :key="facet">
          <SharedChartCard v-if="facet === 'companies'">
            <template #header>
              <h3 class="industry-quick-view__title"><NuxtLink :to="industryFacetPath(code, facet)" class="hub-inline-link">{{ labelOf(facet) }}</NuxtLink></h3>
            </template>
            <SharedFactList :items="facts" :label="`${sectorName}的公司家數與資料日期`" class="industry-quick-view__facts" />
          </SharedChartCard>
          <IndustryFacetChart v-else :data="data" :sector-name="sectorName" :facet="facet">
            <template #header>
              <h3 class="industry-quick-view__title"><NuxtLink :to="industryFacetPath(code, facet)" class="hub-inline-link">{{ labelOf(facet) }}</NuxtLink></h3>
            </template>
          </IndustryFacetChart>
        </template>
      </div>
    </section>

    <section class="stock-page-section" aria-labelledby="industry-links-heading">
      <h2 id="industry-links-heading" class="visually-hidden">{{ sectorName }}的公司與其他類股</h2>
      <!-- 收起來但在 SSR HTML 裡（爬蟲照樣讀得到），不用 JS 也能用原生的展開 -->
      <details class="hub-details">
        <summary>{{ sectorName }}全部公司</summary>
        <ul class="hub-company-list">
          <li v-for="company in allCompanies" :key="company.symbol">
            <NuxtLink :to="`/stock/${company.symbol}`" class="hub-company-list__link">{{ company.symbol }} {{ company.name }}</NuxtLink>
          </li>
        </ul>
      </details>
      <details class="hub-details">
        <summary>其他 {{ otherSectors.length }} 個類股</summary>
        <nav aria-label="其他類股">
          <ul class="hub-chip-list">
            <li v-for="sector in otherSectors" :key="sector.code">
              <NuxtLink :to="sectorPath(sector.code) ?? '/industries'" class="hub-chip">{{ sector.name }}（{{ sector.companyCount }}）</NuxtLink>
            </li>
          </ul>
        </nav>
      </details>
    </section>
  </IndustryPage>
</template>

<style scoped>
/* 同 ETF／個股指標速覽的格狀：最多三欄（2026-10-17「滿版的時候最多給3columns就好」） */
.industry-quick-view__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(max(min(100%, 480px), (100% - 2 * 16px) / 3), 1fr));
  gap: 16px;
}

.industry-quick-view__grid > * {
  min-width: 0;
}

.industry-quick-view__grid :deep(.shared-chart-card) {
  margin-bottom: 0;
}

/* 卡片只有格子的三分之一寬：清單固定一欄（SharedFactList 在 768px 以上預設兩欄） */
.industry-quick-view__facts.fact-list {
  grid-template-columns: 1fr;
}

.industry-quick-view__title {
  margin: 0;
  font-size: 18px;
}
</style>
