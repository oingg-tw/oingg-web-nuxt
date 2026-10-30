<script setup lang="ts">
import type { FactItem } from '~/components/shared/SharedFactList.vue'

// REITs 個別頁的首頁：速覽（2026-10-30）。同 ETF 速覽只放卡片：最新的數字一張，再來是每個面向的那張圖（跟面向頁同一張，ReitFacetChart），
// 點標題進面向頁。介紹句只留在 meta description
const reitData = await useReit()
const { code, data, reit, shortName } = reitData

const description = computed(() => {
  const item = reit.value
  if (!item) return null
  return `${shortName.value}（${code.value}）是${item.trusteeName ? `${item.trusteeName}擔任受託機構的` : ''}不動產投資信託（REITs）。收盤價、每單位淨值、折溢價與歷次收益分配的圖。`
})

const facts = computed<FactItem[]>(() => {
  const item = reit.value
  if (!item) return []
  return [
    { label: '收盤價', value: reitYuan(item.close), note: item.tradeDate ?? undefined },
    { label: '每單位淨值', value: reitYuan(item.nav), note: item.navDate ?? undefined },
    { label: '折溢價', value: reitSignedPct(item.premiumDiscountPct), note: '淨值日當天的收盤價對淨值' },
    { label: '近 12 個月分配', value: reitYuan(item.trailing12MonthDistributionPerUnit, 4), note: item.trailing12MonthDistributionCount === null ? undefined : `${item.trailing12MonthDistributionCount} 次` },
    { label: '分配率', value: reitPct(item.trailing12MonthDistributionYieldPct), note: '近 12 個月分配 ÷ 收盤價' }
  ]
})
const CHART_FACETS = ['nav', 'distributions'] as const
const facetOf = (key: typeof CHART_FACETS[number]) => REIT_FACETS.find(facet => facet.key === key)!
</script>

<template>
  <ReitPage :reit-data="reitData" facet="overview" :description="description">
    <section v-if="data" class="stock-page-section" aria-labelledby="reit-quick-view-heading">
      <!-- 段落標題只給螢幕閱讀器與大綱（卡片標題是 h3，不能跳級）；畫面上只有卡片 -->
      <h2 id="reit-quick-view-heading" class="visually-hidden">{{ shortName }}的最新數字與各面向的圖</h2>
      <div class="reit-quick-view__grid">
        <SharedChartCard v-if="facts.length">
          <template #header>
            <h3 class="reit-quick-view__title">最新數字</h3>
          </template>
          <SharedFactList :items="facts" :label="`${shortName}的最新數字`" class="reit-quick-view__facts" />
        </SharedChartCard>
        <ReitFacetChart v-for="key in CHART_FACETS" :key="key" :data="data" :facet="key">
          <template #header>
            <h3 class="reit-quick-view__title"><NuxtLink :to="`${reitPath(code)}${facetOf(key).suffix}`" class="hub-inline-link">{{ facetOf(key).label }}</NuxtLink></h3>
          </template>
        </ReitFacetChart>
      </div>
    </section>
  </ReitPage>
</template>

<style scoped>
/* 同 ETF 速覽的格狀：最多三欄 */
.reit-quick-view__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(max(min(100%, 480px), (100% - 2 * 16px) / 3), 1fr));
  gap: 16px;
}

.reit-quick-view__grid > * {
  min-width: 0;
}

.reit-quick-view__grid :deep(.shared-chart-card) {
  margin-bottom: 0;
}

/* 卡片只有格子的三分之一寬：清單固定一欄 */
.reit-quick-view__facts.fact-list {
  grid-template-columns: 1fr;
}

.reit-quick-view__title {
  margin: 0;
  font-size: 18px;
}
</style>
