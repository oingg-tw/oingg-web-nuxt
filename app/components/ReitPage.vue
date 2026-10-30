<script setup lang="ts">
import type { ReitData } from '~/composables/reit/useReit'
import type { ReitFacetKey } from '~/utils/reit-pages'
// REITs 個別頁每一個面向的骨架（2026-10-30）：StockPageShell、面向側欄、麵包屑、SEO、頁尾。規則只寫在這裡一次（CLAUDE.md：慣例由一個
// 負責元件擁有），頁面只放自己的問答段落。同 PreferredStockPage
const props = defineProps<{
  reitData: ReitData
  facet: ReitFacetKey
  // meta description；資料還沒有時用預設句
  description: string | null
}>()

const { code, reit, stock, shortName, pending, error, notFound } = props.reitData
const facet = REIT_FACETS.find(item => item.key === props.facet)!
const path = computed(() => `${reitPath(code.value)}${facet.suffix}`)

const breadcrumbs = computed(() => [
  { label: '首頁', to: '/' },
  { label: 'REITs 總覽', to: SCREENER_PATHS.reits },
  { label: `${shortName.value} ${code.value}`, to: reitPath(code.value) },
  ...(facet.suffix ? [{ label: facet.label, to: path.value }] : [])
])

useHubPageSeo({
  title: () => (reit.value ? `${shortName.value} ${code.value} REITs ${facet.label}` : '找不到這檔 REITs'),
  description: () => props.description ?? `${code.value} 不動產投資信託（REITs）的${facet.label}。`,
  path: () => path.value,
  breadcrumbs,
  noindex: () => !reit.value
})

const footer = {
  sources: ['公開資訊觀測站（REITs 基本資料、每日淨值與收益分配公告，以正式公告為準）', '臺灣證券交易所（每日收盤行情）'],
  links: [{ to: SCREENER_PATHS.reits, label: 'REITs 總覽' }]
}
</script>

<template>
  <StockPageShell
    class="app-page reit-page"
    :code="code"
    :stock="stock"
    :pending="pending || (!!error && !notFound)"
    :is-emerging="null"
    :short-name="shortName"
    :topic="facet.label"
    subject="REITs"
    :breadcrumbs="breadcrumbs"
    :footer="footer"
  >
    <template #nav>
      <SectionNav :label="`${shortName} ${code}`" :items="reitFacetItems(code)" />
    </template>
    <slot />
  </StockPageShell>
</template>
