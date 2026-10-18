<script setup lang="ts">
import type { Etf } from '~/composables/etf/useEtf'
import type { EtfFacetKey } from '~/utils/etf-pages'
import type { StockNavNode } from '~/utils/stock-page-nav'
// ETF 個別頁每一個面向的骨架（2026-10-18，「類似現在股票那邊的架構」）：StockPageShell、面向側欄、麵包屑、SEO、頁尾。規則只寫在這裡一次
//（CLAUDE.md：慣例由一個負責元件擁有），頁面只放自己的問答段落。同 PreferredStockPage
const props = defineProps<{
  etfData: Etf
  facet: EtfFacetKey
  // meta description；資料還沒有時用預設句
  description: string | null
}>()

const { code, etf, stock, shortName, pending, error, notFound } = props.etfData
const topic = ETF_FACETS.find(facet => facet.key === props.facet)!.label
const path = computed(() => etfFacetPath(code.value, props.facet))

const breadcrumbs = computed(() => [
  { label: '首頁', to: '/' },
  { label: 'ETF 篩選', to: SCREENER_PATHS.etf },
  { label: `${shortName.value} ${code.value}`, to: etfPath(code.value) },
  ...(props.facet === 'overview' ? [] : [{ label: topic, to: path.value }])
])

useHubPageSeo({
  title: () => (etf.value ? `${shortName.value} ${code.value} ETF ${topic}` : '找不到這檔 ETF'),
  description: () => props.description ?? `${code.value} ETF 的${topic}。`,
  path: () => path.value,
  breadcrumbs,
  noindex: () => !etf.value
})

// 側欄跟個股頁同一個元件（StockPageNavList，2026-10-18「抽出共用元件重複使用」）：指標速覽固定在最上面，九個面向可以拖曳排序，順序存在
// 這個瀏覽器（useEtfFacetOrder，速覽首頁的卡片也照這個順序）。兩份副本（手機底部、桌機側欄）同個股頁的理由
const { facets, move } = useEtfFacetOrder()
const overviewNodes: StockNavNode[] = [{ label: '指標速覽', to: () => etfPath(code.value) }]
const facetNodes = computed<StockNavNode[]>(() => facets.value.map(facet => ({ label: facet.label, to: () => etfFacetPath(code.value, facet.key) })))
const navLabel = computed(() => `${shortName.value} ${code.value}`)

const footer = computed(() => ({
  sources: ['證交所、櫃買中心（股價、成交量）', '投信投顧公會基金月報', '投信公告的配息與配息組成'],
  freshness: etf.value?.yearMonth ? `基金月報 ${etf.value.yearMonth.slice(0, 4)} 年 ${Number(etf.value.yearMonth.slice(4))} 月` : null,
  links: [{ to: SCREENER_PATHS.etf, label: 'ETF 篩選' }]
}))
</script>

<template>
  <StockPageShell
    class="app-page etf-page"
    :code="code"
    :stock="stock"
    :pending="pending || (!!error && !notFound)"
    :is-emerging="null"
    :short-name="shortName"
    :topic="topic"
    subject=" ETF"
    :breadcrumbs="breadcrumbs"
    :footer="footer"
  >
    <template #nav>
      <AppBottomNav :current="topic" :label="`${navLabel}清單`">
        <StockPageNavList :items="overviewNodes" :sortable-items="facetNodes" :label="navLabel" @reorder="move" />
      </AppBottomNav>
      <AppNavRail :label="`${navLabel}導覽（釘選）`">
        <StockPageNavList :items="overviewNodes" :sortable-items="facetNodes" :label="navLabel" @reorder="move" />
      </AppNavRail>
    </template>
    <slot />
  </StockPageShell>
</template>
