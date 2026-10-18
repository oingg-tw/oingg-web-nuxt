<script setup lang="ts">
import type { Etf } from '~/composables/etf/useEtf'
import type { EtfFacetKey } from '~/utils/etf-pages'
// ETF 個別頁每一個面向的骨架（2026-10-18，「類似現在股票那邊的架構」）：StockPageShell、面向側欄、麵包屑、SEO、頁尾。規則只寫在這裡一次
//（CLAUDE.md：慣例由一個負責元件擁有），頁面只放自己的問答段落。同 PreferredStockPage
const props = defineProps<{
  etfData: Etf
  facet: EtfFacetKey
  // meta description；資料還沒有時用預設句
  description: string | null
}>()

const { code, etf, stock, shortName, pending, error, notFound, isFavorite, toggleFavorite } = props.etfData
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
    :is-favorite="isFavorite"
    :short-name="shortName"
    :topic="topic"
    subject=" ETF"
    :breadcrumbs="breadcrumbs"
    :footer="footer"
    @toggle-favorite="toggleFavorite"
  >
    <template #nav>
      <SectionNav :label="`${shortName} ${code}`" :items="etfFacetItems(code)" />
    </template>
    <slot />
  </StockPageShell>
</template>
