<script setup lang="ts">
import type { FilterSchema } from '~/composables/screener/useFilterSchema'
import { bySort, formatPeriodLabel, metricDisplayName } from '~/composables/screener/useFilterSchema'

// /metrics — the catalog of every metric this site computes, by category (2026-09-19, the SEO
// build). Names, units and periods come from GET /metrics through the cached /api/hub/metrics.
// Only the metrics in METRIC_PAGE_SLUGS（shared/utils/hub-slugs.ts — just Piotroski F-Score while
// it is the demonstration）link to an explanation page; everything else is plain text here and
// its /metrics/{code} URL answers `noindex, follow`. The badge system is one link, not a list —
// the user is still revising the badge texts.
const { data: catalog, error } = await useFetch<FilterSchema>('/api/hub/metrics', { key: 'hub-metrics', default: () => ({ categories: [] }) })
if (error.value) throw createError({ statusCode: 503, statusMessage: '指標目錄暫時無法取得', fatal: true })

const categories = computed(() => bySort(catalog.value?.categories ?? []).map(category => ({ ...category, metrics: bySort(category.metrics) })))
const metricCount = computed(() => categories.value.reduce((count, category) => count + category.metrics.length, 0))

function periodsOf(metric: FilterSchema['categories'][number]['metrics'][number]): string {
  return metric.fields.map(field => formatPeriodLabel(field.period) ?? field.period).join('／')
}

function pageFor(code: string): string | null {
  return isIndexableMetricSlug(metricSlug(code)) ? metricPath(code) : null
}

const { breadcrumbs } = useHubPageSeo({
  title: '財報指標說明：定義、公式與資料來源',
  description: () => `本站計算的 ${metricCount.value} 項財報指標依 ${categories.value.length} 個類別列出名稱、單位與期別（單季、近四季、年度、每日）；每項指標的公式與資料來源見指標說明頁。`,
  path: '/metrics',
  breadcrumbs: [
    { label: '首頁', to: '/' },
    { label: '指標說明', to: '/metrics' }
  ]
})
</script>

<template>
  <div class="metrics-index">
    <h1 class="metrics-index__title">財報指標說明：本站 {{ metricCount }} 項指標的定義、公式與資料來源</h1>
    <StockBreadcrumb :items="breadcrumbs" />

    <section class="stock-page-section" aria-labelledby="metrics-index-intro-heading">
      <h2 id="metrics-index-intro-heading" class="stock-page-section__title">這些指標是什麼？</h2>
      <p class="hub-answer">
        每一項指標都由公開財報或交易所每日資料計算，分成 {{ categories.length }} 個類別；表中標明單位與可查的期別（單季、近四季、年度或每日）。有說明頁的指標可點名稱進入，看定義、公式、適用限制與常見誤讀。
        指標的門檻式判讀集中在<NuxtLink to="/guru-indicators" class="hub-inline-link">大師徽章</NuxtLink>；個股的實際數值在各公司的個股頁。
      </p>
    </section>

    <section v-for="category in categories" :key="category.key" class="stock-page-section" :aria-labelledby="`metrics-category-${category.key}-heading`">
      <h2 :id="`metrics-category-${category.key}-heading`" class="stock-page-section__title">{{ category.name }}（{{ category.metrics.length }} 項）</h2>
      <SharedTableScroll :label="`${category.name}指標`">
        <table class="seo-table" data-ssr-table>
          <caption class="visually-hidden">{{ category.name }}類指標的名稱、單位與期別</caption>
          <thead>
            <tr>
              <th scope="col">指標</th>
              <th scope="col">英文</th>
              <th scope="col">單位</th>
              <th scope="col">期別</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="metric in category.metrics" :key="metric.key">
              <th scope="row">
                <NuxtLink v-if="pageFor(metric.key)" :to="pageFor(metric.key)!" class="seo-table__link">{{ metricDisplayName(metric) }}</NuxtLink>
                <template v-else>{{ metricDisplayName(metric) }}</template>
              </th>
              <td>{{ metric.nameEn ?? '－' }}</td>
              <td>{{ metric.unit }}</td>
              <td>{{ periodsOf(metric) }}</td>
            </tr>
          </tbody>
        </table>
      </SharedTableScroll>
    </section>

    <section class="stock-page-section" aria-labelledby="metrics-index-sources-heading">
      <h2 id="metrics-index-sources-heading" class="stock-page-section__title">資料來源</h2>
      <p class="hub-answer">財報數字來自公開資訊觀測站的 XBRL 申報（資產負債表、損益表、現金流量表、股本變動申報），每日股價與估值來自台灣證券交易所與證券櫃檯買賣中心。指標本身是計算結果，不含任何評等。</p>
    </section>
  </div>
</template>

<style scoped>
.metrics-index {
  display: flex;
  flex-direction: column;
  gap: 24px;
  width: 100%;
}

.metrics-index__title {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
  line-height: 1.3;
}
</style>
