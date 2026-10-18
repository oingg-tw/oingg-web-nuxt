<script setup lang="ts">
import type { PreferredStock } from '~/composables/preferred/usePreferredStock'
import type { PreferredFacetLabel } from '~/utils/preferred-stock'
// 特別股個別頁每一個面向的骨架（2026-10-18，使用者：「特別股的個別瀏覽頁 可以透過 sidebar 切換不同面向」）。四頁共用：StockPageShell、
// 面向側欄、麵包屑、SEO、頁尾（「以公司正式公告為準」）。規則只寫在這裡一次（CLAUDE.md：慣例由一個負責元件擁有），頁面只放自己的問答段落。
const props = defineProps<{
  preferred: PreferredStock
  topic: PreferredFacetLabel
  // meta description；資料還沒有時用預設句
  description: string | null
}>()

const { code, entry, stock, shortName, pending, error, notFound, isFavorite, toggleFavorite } = props.preferred
const suffix = PREFERRED_FACETS.find(facet => facet.label === props.topic)!.suffix
const path = computed(() => `${preferredStockPath(code.value)}${suffix}`)

const breadcrumbs = computed(() => [
  { label: '首頁', to: '/' },
  { label: '特別股篩選', to: SCREENER_PATHS.preferred },
  { label: `${shortName.value} ${code.value}`, to: preferredStockPath(code.value) },
  ...(suffix ? [{ label: props.topic, to: path.value }] : [])
])

useHubPageSeo({
  title: () => (entry.value ? `${shortName.value} ${code.value} 特別股${props.topic}` : '找不到這檔特別股'),
  description: () => props.description ?? `${code.value} 特別股的${props.topic}。`,
  path: () => path.value,
  breadcrumbs,
  noindex: () => !entry.value
})

const footer = {
  sources: ['公開資訊觀測站（發行條件，以公司正式公告為準）', '證交所、櫃買中心（收盤價、除權息）'],
  links: [
    { to: SCREENER_PATHS.preferred, label: '特別股篩選' },
    { to: '/blog/what-is-preferred-stock', label: '特別股入門' }
  ]
}
</script>

<template>
  <StockPageShell
    class="app-page preferred-page"
    :code="code"
    :stock="stock"
    :pending="pending || (!!error && !notFound)"
    :is-emerging="null"
    :is-favorite="isFavorite"
    :short-name="shortName"
    :topic="topic"
    subject="特別股"
    :breadcrumbs="breadcrumbs"
    :footer="footer"
    @toggle-favorite="toggleFavorite"
  >
    <template #nav>
      <SectionNav :label="`${shortName} ${code}`" :items="preferredFacetItems(code)" />
    </template>
    <slot />
  </StockPageShell>
</template>
