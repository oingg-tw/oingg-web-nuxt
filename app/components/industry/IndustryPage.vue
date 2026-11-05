<script setup lang="ts">
import { Odometer } from '@element-plus/icons-vue'
import type { IndustryFacetKey } from '#shared/utils/hub-slugs'
import type { StockNavNode } from '~/utils/stock-page-nav'
// 類股個別頁每一個面向的骨架（2026-10-21，使用者：「個別產業 比照 個股瀏覽 他的sidebar也是 最上面是速覽 中間是好多個指標」）：標題、
// 面向側欄、麵包屑、SEO、頁尾。規則只寫在這裡一次（CLAUDE.md：慣例由一個負責元件擁有），頁面只放自己的問答段落（同 EtfPage）。
// 順序同 StockPageShell（標題 → 導覽 → 麵包屑 → 內容 → 頁尾）；不直接用它：它的摘要卡是證券的（股價、漲跌、加入觀察清單）
const props = defineProps<{
  code: string
  sectorName: string
  facet: IndustryFacetKey
  // <title>；不給就跟 h1 一樣
  title?: string
  // meta description；資料還沒有時用預設句
  description: string | null
  noindex: boolean
}>()

const topic = INDUSTRY_FACETS.find(facet => facet.key === props.facet)!.label
const path = industryFacetPath(props.code, props.facet)
const heading = `${props.sectorName}（證交所類股 ${props.code}）${topic}`

const breadcrumbs = [
  { label: '首頁', to: '/' },
  { label: '產業索引', to: '/industries' },
  { label: props.sectorName, to: industryFacetPath(props.code, 'overview') },
  ...(props.facet === 'overview' ? [] : [{ label: topic, to: path }])
]

useHubPageSeo({
  title: props.title ?? heading,
  description: () => props.description ?? `${heading}。`,
  path,
  breadcrumbs,
  noindex: () => props.noindex
})

// 側欄跟個股、ETF 頁同一個元件（StockPageNavList）：指標速覽固定在最上面，其餘面向可以拖曳排序，順序存在這個瀏覽器
//（useIndustryFacetOrder，速覽首頁的卡片也照這個順序）。兩份副本（手機底部、桌機側欄）同個股頁的理由
const { facets, move } = useIndustryFacetOrder()
const overviewNodes: StockNavNode[] = [{ label: '指標速覽', icon: Odometer, to: () => industryFacetPath(props.code, 'overview') }]
const facetNodes = computed<StockNavNode[]>(() => facets.value.map(facet => ({ label: facet.label, to: () => industryFacetPath(props.code, facet.key) })))

const footer = {
  sources: ['證交所、櫃買中心（類股歸屬、股價與每日評價指標）', '公開資訊觀測站（月營收、財務報表）', '國發會（景氣指標）'],
  links: [
    { to: '/industries', label: '產業索引' },
    { to: commonScreenerPath({ sector: props.code }), label: `普通股篩選（限定${props.sectorName}）` }
  ],
  disclaimer: '本頁面提供之客觀排行與指標統計僅供研究參考，非屬投顧法之推薦買賣建議，使用者應獨立審慎評估風險。'
}
</script>

<template>
  <div class="app-page industry-page">
    <h1 class="app-page__title">{{ heading }}</h1>
    <AppBottomNav :current="topic" :label="`${sectorName}清單`">
      <StockPageNavList :items="overviewNodes" :sortable-items="facetNodes" :label="sectorName" @reorder="move" />
    </AppBottomNav>
    <AppNavRail :label="`${sectorName}導覽（釘選）`">
      <StockPageNavList :items="overviewNodes" :sortable-items="facetNodes" :label="sectorName" @reorder="move" />
    </AppNavRail>
    <StockBreadcrumb :items="breadcrumbs" />
    <slot />
    <StockPageFooter v-bind="footer" />
  </div>
</template>
