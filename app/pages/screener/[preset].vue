<script setup lang="ts">
import type { ScreenerTemplateWithSlug } from '#shared/types/hub'
import type { FilterSchema } from '~/composables/screener/useFilterSchema'
import { formatPeriodLabel, locateFieldInSchema, metricDisplayName } from '~/composables/screener/useFilterSchema'
import { groupThousands } from '~/utils/stock-answers'

// /screener/{slug} — 條件說明頁 for one official screener template (2026-09-19, the SEO build;
// variant B of the ranking pages the user chose, and the vault's own answer to「策略×篩選清單頁不
// 予採用」): the template's conditions as a table（indicator, period, range）, how many companies
// currently match — a count, never the list（a list would read as a recommendation; a count is a
// statistic）— and a CTA that opens the screener with this template applied. Names/descriptions
// come from bff-ts's GET /screener/templates verbatim; the slug table is this app's
// (shared/utils/hub-slugs.ts). Unknown slug → 404.
const route = useRoute()
const slug = String(route.params.preset)
const templateName = screenerTemplateNameBySlug(slug)
if (!templateName) throw createError({ statusCode: 404, statusMessage: '找不到這組篩選條件', fatal: true })

const { data: templates, error } = await useFetch<ScreenerTemplateWithSlug[]>('/api/hub/screener-templates', { key: 'hub-screener-templates', default: () => [] })
if (error.value) throw createError({ statusCode: 503, statusMessage: '篩選範本暫時無法取得', fatal: true })
const template = computed(() => templates.value.find(item => item.slug === slug) ?? null)
if (!template.value) throw createError({ statusCode: 404, statusMessage: '找不到這組篩選條件', fatal: true })

const [{ data: countData }, { data: catalog }] = await Promise.all([
  useFetch<{ slug: string; count: number | null }>(`/api/hub/screener-template-count/${slug}`, { key: `hub-template-count-${slug}`, default: () => ({ slug, count: null }) }),
  useFetch<FilterSchema>('/api/hub/metrics', { key: 'hub-metrics', default: () => ({ categories: [] }) })
])

const matchCount = computed(() => countData.value?.count ?? null)

interface ConditionRow {
  field: string
  metricCode: string
  label: string
  period: string
  range: string
  metricPage: string | null
}

function rangeText(filter: ScreenerTemplateWithSlug['filters'][number], unit: string): string {
  const suffix = unit === '%' ? '%' : unit && unit !== '無單位' ? ` ${unit}` : ''
  const min = filter.min !== null ? `${filter.min}${suffix}` : null
  const max = filter.max !== null ? `${filter.max}${suffix}` : null
  let text = min && max ? `${min} 到 ${max}` : min ? `≥ ${min}` : max ? `≤ ${max}` : '有值即可'
  if (filter.exclude) text = `排除：${text}`
  return text
}

const conditions = computed<ConditionRow[]>(() =>
  (template.value?.filters ?? []).map(filter => {
    const located = locateFieldInSchema(catalog.value?.categories ?? [], filter.field)
    const metricCode = filter.field.split('.')[0] ?? filter.field
    const slugOf = metricSlug(metricCode)
    return {
      field: filter.field,
      metricCode,
      label: located ? metricDisplayName(located.metric) : metricCode,
      period: located ? (formatPeriodLabel(located.field.period) ?? located.field.period) : (filter.field.split('.')[1] ?? ''),
      range: rangeText(filter, located?.metric.unit ?? ''),
      metricPage: isIndexableMetricSlug(slugOf) ? metricPath(metricCode) : null
    }
  })
)

const conditionSummary = computed(() => conditions.value.map(row => `${row.label}（${row.period}）${row.range}`).join('；'))
const otherTemplates = computed(() => templates.value.filter(item => item.slug && item.slug !== slug && item.status === 'AVAILABLE'))

const { breadcrumbs } = useHubPageSeo({
  title: `${templateName}篩選條件說明：指標、區間與符合家數`,
  description: () => {
    const count = matchCount.value !== null ? `目前全市場 ${groupThousands(matchCount.value)} 家公司符合` : '附目前符合家數'
    return `「${templateName}」官方篩選範本的條件：${conditionSummary.value}；${count}，可一鍵套用至個股篩選器再自行調整。`
  },
  path: screenerTemplatePath(slug),
  breadcrumbs: [
    { label: '首頁', to: '/' },
    { label: '個股篩選', to: '/screener' },
    { label: `${templateName}篩選條件`, to: screenerTemplatePath(slug) }
  ]
})
</script>

<template>
  <div class="preset-page">
    <h1 class="preset-page__title">「{{ templateName }}」篩選條件說明</h1>
    <StockBreadcrumb :items="breadcrumbs" />

    <section class="stock-page-section" aria-labelledby="preset-conditions-heading">
      <h2 id="preset-conditions-heading" class="stock-page-section__title">這組條件包含哪些指標？</h2>
      <p v-if="template?.description" class="hub-answer">{{ template.description }}</p>
      <p class="hub-answer">共 {{ conditions.length }} 個條件<template v-if="template?.category">，分類「{{ template.category }}」</template>：{{ conditionSummary }}。</p>
      <SharedTableScroll v-if="conditions.length" :label="`${templateName}篩選條件`">
        <table class="seo-table" data-ssr-table>
          <caption class="visually-hidden">「{{ templateName }}」的每一個篩選條件：指標、期間與區間</caption>
          <thead>
            <tr>
              <th scope="col">指標</th>
              <th scope="col">期間</th>
              <th scope="col">條件區間</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in conditions" :key="row.field">
              <th scope="row">
                <NuxtLink v-if="row.metricPage" :to="row.metricPage" class="seo-table__link">{{ row.label }}</NuxtLink>
                <template v-else>{{ row.label }}</template>
              </th>
              <td>{{ row.period }}</td>
              <td>{{ row.range }}</td>
            </tr>
          </tbody>
        </table>
      </SharedTableScroll>
    </section>

    <section class="stock-page-section" aria-labelledby="preset-count-heading">
      <h2 id="preset-count-heading" class="stock-page-section__title">目前有多少家公司符合？</h2>
      <p class="hub-answer">
        <template v-if="matchCount !== null">以本站最新一次計算，全市場同時符合以上 {{ conditions.length }} 個條件的公司有 {{ groupThousands(matchCount) }} 家。名單只在篩選器中顯示，本頁不列出。</template>
        <template v-else>符合家數目前無法計算；到篩選器套用這組條件即可看到結果。</template>
      </p>
    </section>

    <section class="stock-page-section" aria-labelledby="preset-howto-heading">
      <h2 id="preset-howto-heading" class="stock-page-section__title">怎麼使用這組條件？</h2>
      <p class="hub-answer">按下方按鈕會以這組條件開啟個股篩選器；之後可以再加減條件、改區間、限定類股，或依任一欄位排序。未登入也能使用，登入後可把調整過的條件存成自己的篩選。</p>
      <el-button type="primary" tag="a" :href="`/screener?template=${slug}`" class="preset-page__cta">套用至篩選器</el-button>
    </section>

    <section v-if="otherTemplates.length" class="stock-page-section" aria-labelledby="preset-others-heading">
      <h2 id="preset-others-heading" class="stock-page-section__title">其他篩選條件</h2>
      <nav aria-label="其他篩選條件">
        <ul class="hub-chip-list">
          <li v-for="item in otherTemplates" :key="item.id">
            <NuxtLink :to="screenerTemplatePath(item.slug!)" class="hub-chip">{{ item.name }}</NuxtLink>
          </li>
        </ul>
      </nav>
    </section>

    <section class="stock-page-section" aria-labelledby="preset-note-heading">
      <h2 id="preset-note-heading" class="stock-page-section__title">說明</h2>
      <p class="hub-answer">範本名稱、分類與條件由本站的篩選服務維護；指標定義與資料來源見各指標的說明。條件只是把公開財報數字做區間過濾，不含任何評等。</p>
      <p class="hub-disclaimer">本頁面提供之客觀排行與指標統計僅供研究參考，非屬投顧法之推薦買賣建議，使用者應獨立審慎評估風險。</p>
    </section>
  </div>
</template>

<style scoped>
.preset-page {
  display: flex;
  flex-direction: column;
  gap: 24px;
  width: 100%;
}

.preset-page__title {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
  line-height: 1.3;
}

.preset-page__cta {
  align-self: flex-start;
  min-height: 48px;
  font-size: 1rem;
}
</style>
