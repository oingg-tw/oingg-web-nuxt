<script setup lang="ts">
import type { ScreenerTemplateWithSlug } from '#shared/types/hub'
import type { FilterSchema } from '~/composables/screener/useFilterSchema'
import { formatPeriodLabel, metricDisplayName } from '~/composables/screener/useFilterSchema'
import { findMetricInSchema } from '~/utils/stock-digest'
import { renderFormulaHtml } from '~/utils/render-formula'
import { clampDescription } from '~/utils/stock-digest'

// /metrics/{kebab-code} — one metric's explanation page (2026-09-19, the SEO build), the vault's
// five-block template as questions: 定義 / 怎麼計算 / 限制 / 常見誤讀 / 相關指標與功能. The text
// comes from GET /metrics' own description / limitations / misreadings（analysis-ts, 2026-09-19,
// the first batch covers the badge metrics）; the formula is KaTeX-rendered on the server from
// formulaLatex. No stock is linked from here（vault rule: 說明頁不反向連結個股）and no badge copy
// is repeated — a metric with a badge gets one link to the badge system.
//
// Indexable only for METRIC_PAGE_SLUGS（just piotroski-f-score, the user's demonstration）AND when
// all three text fields exist; every other known code renders the same page `noindex, follow`.
// A camelCase or unknown code is a 404 so the kebab URL stays the only one.
const route = useRoute()
const slug = String(route.params.code)
const code = metricCodeFromSlug(slug)
if (metricSlug(code) !== slug) throw createError({ statusCode: 404, statusMessage: '找不到這個指標', fatal: true })

const [{ data: catalog, error }, { data: templates }] = await Promise.all([
  useFetch<FilterSchema>('/api/hub/metrics', { key: 'hub-metrics', default: () => ({ categories: [] }) }),
  useFetch<ScreenerTemplateWithSlug[]>('/api/hub/screener-templates', { key: 'hub-screener-templates', default: () => [] })
])
if (error.value) throw createError({ statusCode: 503, statusMessage: '指標目錄暫時無法取得', fatal: true })
const located = computed(() => findMetricInSchema(catalog.value?.categories ?? [], code))
if (!located.value) throw createError({ statusCode: 404, statusMessage: '找不到這個指標', fatal: true })

const metric = computed(() => located.value!.metric)
const category = computed(() => located.value!.category)
const name = computed(() => metricDisplayName(metric.value))
const periods = computed(() => metric.value.fields.map(field => formatPeriodLabel(field.period) ?? field.period))
const formulaHtml = computed(() => renderFormulaHtml(metric.value.formulaLatex, true))

function paragraphs(text: string | null | undefined): string[] {
  return (text ?? '').split(/\n\s*\n/).map(part => part.trim()).filter(Boolean)
}

const definition = computed(() => metric.value.description ?? null)
const limitations = computed(() => paragraphs(metric.value.limitations))
const misreadings = computed(() => paragraphs(metric.value.misreadings))
const hasFullText = computed(() => !!definition.value && limitations.value.length > 0 && misreadings.value.length > 0)
const indexable = isIndexableMetricSlug(slug) && hasFullText.value

const definitionAnswer = computed(() => {
  const facts = `${name.value}屬於「${category.value.name}」類指標，單位${metric.value.unit}，本站提供${periods.value.join('、')}的數值。`
  return definition.value ? `${definition.value}${facts}` : facts
})

const siblings = computed(() => category.value.metrics.filter(item => item.key !== code))
const rankPages = RANK_PAGES.filter(page => page.metricCode === code)
const templatePages = computed(() => templates.value.filter(template => template.slug && template.status === 'AVAILABLE' && template.filters.some(filter => filter.field.split('.')[0] === code)))

// The short form of the name for the <title>（「Piotroski F-Score 是什麼？…」rather than the
// catalog's full「Piotroski F-Score 財務體質評分」）keeps it inside 32 CJK-equivalent characters
// with the brand suffix: the English name when the catalog has one, else a Latin-led name cut
// before its Chinese gloss; a Chinese name（毛利率）is used as is. The h1 keeps the full name.
const titleName = computed(() => {
  const full = name.value
  if (metric.value.nameEn && metric.value.nameEn.length < full.length) return metric.value.nameEn
  return /^[A-Za-z]/.test(full) ? full.replace(/\s+[　-鿿].*$/, '') : full
})

// 「Piotroski F-Score 財務體質評分是什麼？」/「ROE（Return on Equity）是什麼？」— a space only after
// a Latin/digit ending.
const heading = computed(() => {
  const english = metric.value.nameEn && metric.value.nameEn !== name.value ? `（${metric.value.nameEn}）` : ''
  const base = `${name.value}${english}`
  return `${base}${/[A-Za-z0-9]$/.test(base) ? ' ' : ''}是什麼？`
})

const { breadcrumbs } = useHubPageSeo({
  title: `${titleName.value}${/[A-Za-z0-9]$/.test(titleName.value) ? ' ' : ''}是什麼？公式、限制與常見誤讀`,
  description: () => clampDescription(definition.value ? `${definition.value}本頁列出公式、資料來源、適用限制與常見誤讀。` : `${name.value}的定義、公式、資料來源、適用限制與常見誤讀，以及使用這項指標的排行與篩選條件。`),
  path: metricPath(code),
  breadcrumbs: [
    { label: '首頁', to: '/' },
    { label: '指標說明', to: '/metrics' },
    { label: name.value, to: metricPath(code) }
  ],
  noindex: !indexable
})
</script>

<template>
  <div class="metric-page">
    <h1 class="metric-page__title">{{ heading }}</h1>
    <StockBreadcrumb :items="breadcrumbs" />

    <StockQuestionSection id="metric-definition" :question="`${name}的定義是什麼？`" :answer="definitionAnswer" />

    <StockQuestionSection id="metric-formula" question="怎麼計算？">
      <div v-if="formulaHtml" class="metric-page__formula" v-html="formulaHtml" />
      <p v-else class="hub-answer">本站尚未公開這項指標的公式。</p>
      <p v-if="metric.sources?.length" class="hub-answer">資料來源：{{ metric.sources.join('、') }}。</p>
      <p v-if="metric.referenceUrl || metric.academicSourceUrl" class="hub-answer">
        <template v-if="metric.academicSourceUrl"><a :href="metric.academicSourceUrl" target="_blank" rel="noopener" class="hub-inline-link">原始文獻</a></template>
        <template v-if="metric.academicSourceUrl && metric.referenceUrl">・</template>
        <template v-if="metric.referenceUrl"><a :href="metric.referenceUrl" target="_blank" rel="noopener" class="hub-inline-link">一般說明（外部連結）</a></template>
      </p>
    </StockQuestionSection>

    <StockQuestionSection id="metric-limitations" question="有什麼限制？">
      <p v-for="(paragraph, index) in limitations" :key="index" class="hub-answer">{{ paragraph }}</p>
      <p v-if="!limitations.length" class="hub-answer">這項指標的適用限制說明尚未整理。</p>
    </StockQuestionSection>

    <StockQuestionSection id="metric-misreadings" question="常見誤讀有哪些？">
      <p v-for="(paragraph, index) in misreadings" :key="index" class="hub-answer">{{ paragraph }}</p>
      <p v-if="!misreadings.length" class="hub-answer">這項指標的常見誤讀說明尚未整理。</p>
    </StockQuestionSection>

    <StockQuestionSection id="metric-related" question="相關指標與功能有哪些？">
      <p v-if="siblings.length" class="hub-answer">同屬「{{ category.name }}」的指標：{{ siblings.map(item => metricDisplayName(item)).join('、') }}。<NuxtLink to="/metrics" class="hub-inline-link">回指標目錄</NuxtLink></p>
      <ul v-if="rankPages.length || templatePages.length || metric.badge" class="metric-page__related">
        <li v-for="page in rankPages" :key="page.slug"><NuxtLink :to="rankPath(page.slug)" class="hub-inline-link">台股{{ page.label }}排行</NuxtLink></li>
        <li v-for="template in templatePages" :key="template.id"><NuxtLink :to="screenerTemplatePath(template.slug!)" class="hub-inline-link">「{{ template.name }}」篩選條件說明</NuxtLink></li>
        <li v-if="metric.badge">此指標在大師徽章系統中有對應徽章：<NuxtLink :to="`/guru-indicators#guru-badge-${code}`" class="hub-inline-link">看大師徽章</NuxtLink></li>
      </ul>
      <p class="hub-disclaimer">以上為指標本身的說明，不代表本站對任何個股之評等或投資建議。</p>
    </StockQuestionSection>
  </div>
</template>

<style scoped>
.metric-page {
  display: flex;
  flex-direction: column;
  gap: 24px;
  width: 100%;
}

.metric-page__title {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
  line-height: 1.3;
}

.metric-page__formula {
  padding: 16px;
  overflow-x: auto;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 12px;
  background: var(--el-fill-color-blank);
  font-size: 1.125rem;
}

.metric-page__related {
  margin: 0;
  padding-left: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 1rem;
  line-height: 1.7;
}
</style>
