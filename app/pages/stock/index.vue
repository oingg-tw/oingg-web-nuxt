<script setup lang="ts">
import type { MarketDirectory } from '#shared/types/hub'
import { groupThousands } from '~/utils/stock-answers'

// /stock — 個股總表 (2026-09-19, the SEO build): every listed four-digit symbol, grouped by
// 證交所類股, on one page. This is the crawl path that did not exist before: a crawler starting
// at / reached no stock page at all (the header nav had no anchors and the home page linked to
// five routes), so 13,000 stock URLs lived in the sitemap alone. From here every /stock/{code}
// is two clicks from the home page, and every sector heading links to its /industry/… table.
//
// Deliberately ONE exhaustive directory rather than 36 near-identical previews: the sector pages
// carry the numbers (valuation table, distribution stats), this page carries the names — the two
// don't duplicate each other. The company lists are plain <a> elements, not NuxtLink: ~2,600
// router-link component instances (each with its own prefetch observer) is real hydration and
// memory cost on a page whose job is to be a list, and a full page load into a stock page is fine.
//
// Data: /api/hub/directory（server/utils/hub-data.ts, cached 6h from GET /stocks' sectorCode）.
// A failed cold fetch is a 503, never an empty 200 that could get indexed as the page's content.
const { data: directory, error } = await useFetch<MarketDirectory>('/api/hub/directory', { key: 'hub-directory' })
if (error.value || !directory.value) throw createError({ statusCode: 503, statusMessage: '個股總表暫時無法取得', fatal: true })

const sectors = computed(() => directory.value?.sectors ?? [])
const others = computed(() => directory.value?.others ?? [])
const total = computed(() => directory.value?.total ?? 0)
const withSector = computed(() => sectors.value.reduce((count, sector) => count + sector.companies.length, 0))

const { breadcrumbs } = useHubPageSeo({
  title: '台股個股總表：依證交所類股瀏覽上市櫃公司',
  description: () => `台灣上市櫃 ${groupThousands(total.value)} 家四位數代碼普通股，依證交所 ${sectors.value.length} 個類股分列；每家公司連到本站的財報亮點、配股配息、公司健檢、財務報表與指標歷史頁。`,
  path: '/stock',
  breadcrumbs: [
    { label: '首頁', to: '/' },
    { label: '個股總表', to: '/stock' }
  ]
})
</script>

<template>
  <div class="stock-directory">
    <h1 class="stock-directory__title">台股上市櫃個股總表（依證交所類股）</h1>
    <StockBreadcrumb :items="breadcrumbs" />

    <section class="stock-page-section" aria-labelledby="stock-directory-overview-heading">
      <h2 id="stock-directory-overview-heading" class="stock-page-section__title">台股有哪些類股？</h2>
      <p class="hub-answer">
        證交所把上市櫃公司分成 {{ sectors.length }} 個類股。本站收錄 {{ total }} 家四位數代碼的普通股，其中 {{ withSector }} 家有類股歸屬，{{ others.length }} 家掛在非產業代碼下。
        點類股名稱看該類股每家公司的股價、本益比、殖利率與 ROE 一覽表；點公司名稱看個股頁。
      </p>
      <nav aria-label="類股目錄">
        <ul class="hub-chip-list">
          <li v-for="sector in sectors" :key="sector.code">
            <a :href="`#sector-${sector.code}`" class="hub-chip">{{ sector.name }}（{{ sector.companies.length }}）</a>
          </li>
        </ul>
      </nav>
    </section>

    <section
      v-for="sector in sectors"
      :id="`sector-${sector.code}`"
      :key="sector.code"
      class="stock-page-section stock-directory__sector"
      :aria-labelledby="`sector-${sector.code}-heading`"
    >
      <h2 :id="`sector-${sector.code}-heading`" class="stock-page-section__title">
        <NuxtLink :to="sectorPath(sector.code) ?? '/stock'" class="stock-directory__sector-link">{{ sector.name }}</NuxtLink>
        <span class="stock-directory__sector-count">（{{ sector.companies.length }} 家）</span>
      </h2>
      <ul class="hub-company-list">
        <li v-for="company in sector.companies" :key="company.symbol">
          <a :href="`/stock/${company.symbol}`" class="hub-company-list__link">{{ company.symbol }} {{ company.name }}</a>
        </li>
      </ul>
    </section>

    <section v-if="others.length" id="sector-others" class="stock-page-section stock-directory__sector" aria-labelledby="sector-others-heading">
      <h2 id="sector-others-heading" class="stock-page-section__title">
        其他證券
        <span class="stock-directory__sector-count">（未歸入產業類股，{{ others.length }} 家）</span>
      </h2>
      <ul class="hub-company-list">
        <li v-for="company in others" :key="company.symbol">
          <a :href="`/stock/${company.symbol}`" class="hub-company-list__link">{{ company.symbol }} {{ company.name }}</a>
        </li>
      </ul>
    </section>

    <section class="stock-page-section" aria-labelledby="stock-directory-sources-heading">
      <h2 id="stock-directory-sources-heading" class="stock-page-section__title">資料來源</h2>
      <p class="hub-answer">
        公司名單與類股歸屬來自台灣證券交易所與證券櫃檯買賣中心的公開資料。本頁只列名稱與代碼，不含任何評等；各公司頁面的數字整理自公開財報與交易所每日資料，不代表本站對任何個股之投資建議。
      </p>
    </section>
  </div>
</template>

<style scoped>
.stock-directory {
  display: flex;
  flex-direction: column;
  gap: 24px;
  width: 100%;
}

.stock-directory__title {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
  line-height: 1.3;
}

.stock-directory__sector {
  scroll-margin-top: calc(var(--app-header-height) + var(--app-banner-height) + 16px);
}

.stock-directory__sector-link {
  color: var(--el-color-primary-dark-2);
  text-decoration: underline;
  text-underline-offset: 3px;
}

.stock-directory__sector-count {
  font-weight: 400;
  color: var(--el-text-color-secondary);
}
</style>
