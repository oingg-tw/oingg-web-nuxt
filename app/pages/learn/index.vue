<script setup lang="ts">
import type { MetricCatalog } from '~/composables/screener/useFilterSchema'
// /learn — 新手專區首頁（2026-10-12，使用者：「把教學、說明與指標頁面分開」；原本的 /metrics 指標目錄併進來，沒有對外發布所以
// 舊網址直接拿掉、不轉址）。上半是四個關係主題，下半是本站每一項指標的總表，名稱連到 /learn/{指標} 的教學頁。
// 入口只放個股頁尾（使用者選的），網站頁尾與頭部導覽不放。
const { data: catalog, error } = await useFetch<MetricCatalog>('/api/hub/metrics', { key: 'hub-metrics', default: () => ({ categories: [] }) })
if (error.value) throw createError({ statusCode: 503, statusMessage: '指標目錄暫時無法取得', fatal: true })

const categories = computed(() => bySort(catalog.value?.categories ?? []).map(category => ({ ...category, metrics: bySort(category.metrics) })))
const metricCount = computed(() => categories.value.reduce((count, category) => count + category.metrics.length, 0))

function periodsOf(metric: MetricCatalog['categories'][number]['metrics'][number]): string {
  return metric.fields.map(field => formatPeriodLabel(field.period) ?? field.period).join('／')
}

// 四個主題：三個登記在 LEARN_TOPICS，三率三升是型錄裡的指標
const topics = computed(() => {
  const rising = findMetricInSchema(catalog.value?.categories ?? [], 'threeMarginsRising')?.metric
  return [
    ...LEARN_TOPICS.map(topic => ({ label: topic.topic, to: learnTopicPath(topic.slug), summary: topic.summary })),
    ...(rising ? [{ label: '三率三升', to: metricPath('threeMarginsRising'), summary: firstSentence(rising.badge?.summary ?? rising.description) ?? '' }] : [])
  ]
})

const { breadcrumbs } = useHubPageSeo({
  title: '新手專區：財報指標怎麼看',
  description: () => `本站 ${metricCount.value} 項財報指標各有一頁教學：是什麼、數字變大或變小代表什麼、要跟誰比、什麼時候會看錯；另有杜邦分析、現金轉換循環、三率三升與填息的說明。`,
  path: '/learn',
  breadcrumbs: [
    { label: '首頁', to: '/' },
    { label: '新手專區', to: '/learn' }
  ]
})
</script>

<template>
  <div class="app-page app-page--compact learn-index">
    <h1 class="app-page__title">新手專區：財報指標怎麼看</h1>
    <StockBreadcrumb :items="breadcrumbs" />
    <LearnNav />

    <section class="stock-page-section" aria-labelledby="learn-topics-heading">
      <h2 id="learn-topics-heading" class="stock-page-section__title">先看哪幾個主題？</h2>
      <p class="hub-answer">這幾個主題不是單一指標，而是把幾個數字放在一起看的方法；個股頁上對應的頁面都會連回這裡。</p>
      <SharedTableScroll label="新手專區的主題">
        <table class="seo-table" data-ssr-table>
          <caption class="visually-hidden">新手專區的 {{ topics.length }} 個主題</caption>
          <thead>
            <tr>
              <th scope="col">主題</th>
              <th scope="col">一句話</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="topic in topics" :key="topic.to">
              <th scope="row"><NuxtLink :to="topic.to" class="seo-table__link">{{ topic.label }}</NuxtLink></th>
              <td>{{ topic.summary }}</td>
            </tr>
          </tbody>
        </table>
      </SharedTableScroll>
    </section>

    <section class="stock-page-section" aria-labelledby="learn-metrics-heading">
      <h2 id="learn-metrics-heading" class="stock-page-section__title">每一項指標怎麼看？</h2>
      <p class="hub-answer">
        本站 {{ metricCount }} 項指標都由公開財報或交易所每日資料計算，分成 {{ categories.length }} 個類別；點名稱看它是什麼、數字變大或變小代表什麼、要跟誰比、什麼時候會看錯，以及公式。
        指標的門檻式判讀集中在<NuxtLink to="/guru-indicators" class="hub-inline-link">大師徽章</NuxtLink>；個股的實際數值在各公司的個股頁。
      </p>
    </section>

    <section v-for="category in categories" :key="category.key" class="stock-page-section" :aria-labelledby="`learn-category-${category.key}-heading`">
      <h2 :id="`learn-category-${category.key}-heading`" class="stock-page-section__title">{{ category.name }}（{{ category.metrics.length }} 項）</h2>
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
              <th scope="row"><NuxtLink :to="metricPath(metric.key)" class="seo-table__link">{{ metricDisplayName(metric) }}</NuxtLink></th>
              <td>{{ metric.nameEn ?? '－' }}</td>
              <td>{{ metric.unit }}</td>
              <td>{{ periodsOf(metric) }}</td>
            </tr>
          </tbody>
        </table>
      </SharedTableScroll>
    </section>

    <section class="stock-page-section" aria-labelledby="learn-sources-heading">
      <h2 id="learn-sources-heading" class="stock-page-section__title">資料來源</h2>
      <p class="hub-answer">財報數字來自公開資訊觀測站的 XBRL 申報（資產負債表、損益表、現金流量表、股本變動申報），每日股價與估值來自台灣證券交易所與證券櫃檯買賣中心。指標本身是計算結果，不含任何評等。</p>
    </section>
  </div>
</template>
