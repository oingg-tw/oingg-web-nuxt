<script setup lang="ts">
// /rank — the index of the single-metric rankings (2026-09-19, the SEO build). Each /rank/{slug}
// page is one objective screener field ordered market-wide（GET /screener/ranking, 50 rows）;
// this page names them and states, once, how to read such a list. Wording is statistical
//（由高到低／由低到高）— never「最強」「最佳」— and the compliance line sits right here too.
const RANK_DESCRIPTIONS: Record<string, string> = {
  'dividend-yield': '交易所公布的每日殖利率，由高到低',
  'pe-ratio-low': '交易所公布的每日本益比，由低到高',
  'pb-ratio-low': '交易所公布的每日股價淨值比，由低到高',
  roe: '近四季股東權益報酬率，由高到低',
  eps: '近四季每股盈餘，由高到低',
  'market-cap': '收盤價乘以發行股數的市值，由高到低',
  'revenue-growth': '單季營收與去年同季相比的年增率，由高到低'
}

const { breadcrumbs } = useHubPageSeo({
  title: '台股排行：殖利率、本益比、ROE、EPS 前 50 檔',
  // Names derived from RANK_PAGES rather than typed out: the count and the list used to sit in
  // one sentence with only the count computed, so removing 連續配息年數 left the name behind.
  description: `台股 ${RANK_PAGES.length} 種單一指標排行，每種列出全市場前 50 檔：${RANK_PAGES.map(page => page.label).join('、')}，附資料日期與指標說明。`,
  path: '/rank',
  breadcrumbs: [
    { label: '首頁', to: '/' },
    { label: '排行', to: '/rank' }
  ]
})
</script>

<template>
  <div class="rank-index">
    <h1 class="rank-index__title">台股排行：依單一指標排序的前 50 檔</h1>
    <StockBreadcrumb :items="breadcrumbs" />

    <section class="stock-page-section" aria-labelledby="rank-index-list-heading">
      <h2 id="rank-index-list-heading" class="stock-page-section__title">有哪些排行？</h2>
      <p class="hub-answer">每一份排行只依一個指標排序，列出全市場有該指標資料的公司中前 50 檔，並標明數值與資料日期；點指標名稱進入該排行。</p>
      <ul class="rank-index__list">
        <li v-for="definition in RANK_PAGES" :key="definition.slug" class="rank-index__item">
          <NuxtLink :to="rankPath(definition.slug)" class="rank-index__link">{{ definition.label }}排行</NuxtLink>
          <span class="rank-index__desc">{{ RANK_DESCRIPTIONS[definition.slug] }}</span>
        </li>
      </ul>
    </section>

    <section class="stock-page-section" aria-labelledby="rank-index-howto-heading">
      <h2 id="rank-index-howto-heading" class="stock-page-section__title">排行怎麼讀？</h2>
      <p class="hub-answer">名次只是數值排序後的位置：同一數值並列時依代號排序，交易所每日公布的欄位以資料日期當天為準，財報欄位以最近一期申報為準。排行不比較產業差異，也不代表任何評等。</p>
      <p class="hub-disclaimer">本頁面提供之客觀排行與指標統計僅供研究參考，非屬投顧法之推薦買賣建議，使用者應獨立審慎評估風險。</p>
    </section>
  </div>
</template>

<style scoped>
.rank-index {
  display: flex;
  flex-direction: column;
  gap: 24px;
  width: 100%;
}

.rank-index__title {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
  line-height: 1.3;
}

.rank-index__list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(18rem, 1fr));
  gap: 12px 24px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.rank-index__item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-height: 48px;
}

.rank-index__link {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--el-color-primary-dark-2);
  text-decoration: underline;
  text-underline-offset: 3px;
}

.rank-index__desc {
  font-size: 1rem;
  color: var(--el-text-color-secondary);
}
</style>
