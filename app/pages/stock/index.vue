<script setup lang="ts">
import type { MarketDirectory } from '#shared/types/hub'
import { groupThousands } from '~/utils/stock-answers'

// /stock — 個股總表 (2026-09-19, the SEO build). Originally listed all ~2,600 companies grouped
// by 類股 on one page (a crawl path that did not exist before — see git history for that
// reasoning); rebuilt 2026-09-19 into a single 35-row 類股 table (interface-complexity review,
// Playwright-measured at 375px: the old page ran 147 phone screens). The per-sector company
// names moved entirely to /industry/{code}-{slug} (which already carried the numbers — valuation
// table, distribution stats — so nothing duplicates); this page is purely a directory OF SECTORS
// now, not of companies. Every /stock/{code} is still 2 clicks from the home page: home → this
// page's sector row → /industry/… → the individual stock page is 3, so check-click-depth.mjs's
// own BFS crawl (which expands /industry/… pages too) still reaches every symbol within its
// depth-3 limit.
//
// Data: /api/hub/directory（server/utils/hub-data.ts, cached 6h from GET /stocks' sectorCode）—
// unchanged; only the template's use of it narrowed to counts. A failed cold fetch is a 503,
// never an empty 200 that could get indexed as the page's content.
const { data: directory, error } = await useFetch<MarketDirectory>('/api/hub/directory', { key: 'hub-directory' })
if (error.value || !directory.value) throw createError({ statusCode: 503, statusMessage: '個股總表暫時無法取得', fatal: true })

const sectors = computed(() => directory.value?.sectors ?? [])
const others = computed(() => directory.value?.others ?? [])
const withSector = computed(() => sectors.value.reduce((count, sector) => count + sector.companies.length, 0))

const { breadcrumbs } = useHubPageSeo({
  title: '台股個股總表：依證交所類股瀏覽上市櫃公司',
  description: () => `台灣上市櫃 ${groupThousands(withSector.value)} 家四位數代碼普通股，依證交所 ${sectors.value.length} 個類股分列；點類股名稱看該類股每家公司的股價、本益比、殖利率與 ROE 一覽表，點公司名稱看個股頁的財報亮點與配股配息。`,
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
        證交所把上市櫃公司分成 {{ sectors.length }} 個類股，共 {{ withSector }} 家有類股歸屬的四位數代碼普通股<template v-if="others.length">（另有 {{ others.length }} 個掛在非產業代碼下、無報價的證券代號，不在本表）</template>。
        點類股名稱看該類股每家公司的股價、本益比、殖利率與 ROE 一覽表。
      </p>
      <SharedTableScroll label="證交所類股與公司家數">
        <table class="seo-table" data-ssr-table>
          <caption class="visually-hidden">證交所 {{ sectors.length }} 個類股與公司家數</caption>
          <thead>
            <tr>
              <th scope="col">類股</th>
              <th scope="col" class="seo-table__num">公司家數</th>
              <th scope="col">證交所代碼</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="sector in sectors" :key="sector.code">
              <th scope="row"><NuxtLink :to="sectorPath(sector.code) ?? '/stock'" class="seo-table__link">{{ sector.name }}</NuxtLink></th>
              <td class="seo-table__num">{{ sector.companies.length }}</td>
              <td>{{ sector.code }}</td>
            </tr>
          </tbody>
        </table>
      </SharedTableScroll>
    </section>

    <!-- No「其他證券」section: the symbols bff-ts files under a non-industry sector（07/91/98/XX）
         have no quote and their stock page is the noindex soft-404 — scripts/check-click-depth.mjs
         sampled 25 on 2026-09-19, all of them. They stay out of the stocks sitemap for the same
         reason; the count is stated in the intro so the population is honest. -->

    <section class="stock-page-section" aria-labelledby="stock-directory-sources-heading">
      <h2 id="stock-directory-sources-heading" class="stock-page-section__title">資料來源</h2>
      <p class="hub-answer">
        公司名單與類股歸屬來自台灣證券交易所與證券櫃檯買賣中心的公開資料。本頁只列類股與家數，不含任何評等；各公司頁面的數字整理自公開財報與交易所每日資料，不代表本站對任何個股之投資建議。
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
</style>
