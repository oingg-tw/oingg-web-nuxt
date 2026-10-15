<script setup lang="ts">
// /screener — 篩選區首頁（2026-10-15 三組篩選重新設計）：三組篩選各一個問句段落，答句說能篩什麼、附入口。跟 /macro、/learn 的索引頁
// 同一個角色：讓落地在這裡的人一眼看到有哪三種，不是側欄的複本（每段有自己的說明）。
const { breadcrumbs } = useHubPageSeo({
  title: '台股篩選：普通股、特別股與 ETF',
  description: '三種篩選：普通股用財報指標設條件、特別股比較股息率與契約條件、ETF 依資產類型、規模與費用率篩選。條件自己設定，結果只列出符合條件的清單。',
  path: SCREENER_PATHS.zone,
  breadcrumbs: [
    { label: '首頁', to: '/' },
    { label: '股票篩選', to: SCREENER_PATHS.zone }
  ]
})
</script>

<template>
  <div class="app-page app-page--compact screener-zone">
    <h1 class="app-page__title screener-zone__title">股票篩選</h1>
    <StockBreadcrumb :items="breadcrumbs" />
    <ScreenerNav />

    <section v-for="item in SCREENER_ZONE_ITEMS" :id="`screener-zone-${item.key}`" :key="item.key" class="stock-page-section" :aria-labelledby="`screener-zone-${item.key}-heading`">
      <h2 :id="`screener-zone-${item.key}-heading`" class="stock-page-section__title">{{ item.subject }}可以怎麼篩？</h2>
      <p class="hub-answer">{{ item.description }}</p>
      <p class="hub-answer">
        <NuxtLink :to="item.to" class="hub-inline-link">前往{{ item.label }}</NuxtLink>
      </p>
    </section>
  </div>
</template>
