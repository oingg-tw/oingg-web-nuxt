<script setup lang="ts">
import type { ScreenerTemplateWithSlug } from '#shared/types/hub'
import type { MetricCatalog } from '~/composables/screener/useFilterSchema'
// 公式的 HTML 由伺服器排好（/api/hub/formula/[key]），這一頁只要 KaTeX 的 CSS，不載 KaTeX 的 JS（2026-10-16）
import 'katex/dist/katex.min.css'
// 新手專區的一頁教學（2026-10-12，使用者：「把教學、說明與指標頁面分開」），由 pages/learn/[slug].vue 分派過來。兩種 slug：
//   - 關係主題（LEARN_TOPICS：dupont／cash-cycle／dividend-fill）：文字原本寫在對應的個股頁上
//   - 型錄裡的指標（metricSlug(code)）：原本的 /metrics/{code} 搬來，加上個股頁原本的通則區（變大或變小、跟誰比、什麼時候會看錯），
//     定義與注意事項跟個股頁同一份解析（metricGuideFrom：前端文案優先、型錄補空），不再是說明頁只讀型錄的另一套文字
// 主題先比對；型錄沒有叫 dupont／cash-cycle／dividend-fill 的指標。camelCase 或不認得的 slug 是 404，讓 kebab 網址是唯一的。
// 說明頁不反向連結個股（vault 規則，2026-09-19 起）。
const props = defineProps<{ slug: string }>()
const slug = props.slug
const topic = findLearnTopic(slug)
const code = metricCodeFromSlug(slug)
if (!topic && metricSlug(code) !== slug) throw createError({ statusCode: 404, statusMessage: '找不到這個主題', fatal: true })

const [{ data: catalog, error }, { data: templates }, { data: formula }] = await Promise.all([
  useFetch<MetricCatalog>('/api/hub/metrics', { key: 'hub-metrics', default: () => ({ categories: [] }) }),
  useFetch<ScreenerTemplateWithSlug[]>('/api/hub/screener-templates', { key: 'hub-screener-templates', default: () => [] }),
  // 公式在伺服器排好（2026-10-16）：瀏覽器不必載入 KaTeX，HTML 跟著 payload 到；主題頁沒有單一指標，不問
  useFetch<{ html: string | null }>(`/api/hub/formula/${code}`, { key: `hub-formula-${code}`, immediate: !topic, default: () => ({ html: null }) })
])
if (!topic && error.value) throw createError({ statusCode: 503, statusMessage: '指標目錄暫時無法取得', fatal: true })
const located = computed(() => (topic ? null : findMetricInSchema(catalog.value?.categories ?? [], code)))
if (!topic && !located.value) throw createError({ statusCode: 404, statusMessage: '找不到這個主題', fatal: true })

const metric = computed(() => located.value?.metric ?? null)
const category = computed(() => located.value?.category ?? null)
const name = computed(() => topic?.topic ?? metricDisplayName(metric.value!))
const formulaHtml = computed(() => (metric.value ? formula.value?.html ?? null : null))

const guide = computed(() => metricGuideFrom(findMetricCopy(code), metric.value))
const facts = computed(() => {
  if (!metric.value || !category.value) return null
  const periods = metric.value.fields.map(field => formatPeriodLabel(field.period) ?? field.period)
  return `${name.value}屬於「${category.value.name}」類指標，單位${metric.value.unit}，本站提供${periods.join('、')}的數值。`
})
const definition = computed(() => (topic ? topic.definition : [...guide.value.definition, ...(facts.value ? [facts.value] : [])]))
const badge = computed(() => metric.value?.badge ?? null)
// 所屬的組（2026-10-12 結構重做）：麵包屑多一層、側欄標出目前位置
const group = computed(() => (topic ? findLearnGroup(topic.group) : category.value ? learnGroupOfCategory(category.value.key) : null))

const hasFullText = computed(() => !!topic || (guide.value.definition.length > 0 && guide.value.limitations.length > 0 && guide.value.misreadings.length > 0))
const indexable = !!topic || (isIndexableMetricSlug(slug) && hasFullText.value)

const siblings = computed(() => category.value?.metrics.filter(item => item.key !== code) ?? [])
const rankPages = RANK_PAGES.filter(page => page.metricCode === code)
const templatePages = computed(() => (topic ? [] : templates.value.filter(template => template.slug && template.status === 'AVAILABLE' && template.filters.some(filter => filter.field.split('.')[0] === code))))

// The short form of the name for the <title>（「Piotroski F-Score 是什麼？…」rather than the
// catalog's full「Piotroski F-Score 財務體質評分」）keeps it inside 32 CJK-equivalent characters
// with the brand suffix: the English name when the catalog has one, else a Latin-led name cut
// before its Chinese gloss; a Chinese name（毛利率）is used as is. The h1 keeps the full name.
const titleName = computed(() => {
  const full = name.value
  if (metric.value?.nameEn && metric.value.nameEn.length < full.length) return metric.value.nameEn
  return /^[A-Za-z]/.test(full) ? full.replace(/\s+[　-鿿].*$/, '') : full
})
const spaced = (text: string) => `${text}${/[A-Za-z0-9]$/.test(text) ? ' ' : ''}`

// 「Piotroski F-Score 財務體質評分是什麼？」/「ROE（Return on Equity）是什麼？」
const heading = computed(() => {
  const english = metric.value?.nameEn && metric.value.nameEn !== name.value ? `（${metric.value.nameEn}）` : ''
  return `${spaced(`${name.value}${english}`)}是什麼？`
})

const summaryText = computed(() => topic?.summary ?? firstSentence(guide.value.definition[0]) ?? '')
const { breadcrumbs } = useHubPageSeo({
  title: `${spaced(titleName.value)}是什麼？怎麼看`,
  description: () => clampDescription(summaryText.value ? `${summaryText.value}本頁說明它是什麼、數字變大或變小代表什麼、要跟誰比、什麼時候會看錯，以及公式與資料來源。` : `${name.value}的定義、怎麼看、適用限制與常見誤讀，以及公式與資料來源。`),
  path: topic ? learnTopicPath(slug) : metricPath(code),
  breadcrumbs: [
    { label: '首頁', to: '/' },
    { label: '新手專區', to: '/learn' },
    ...(group.value ? [{ label: group.value.question, to: learnTopicPath(group.value.slug) }] : []),
    { label: name.value, to: topic ? learnTopicPath(slug) : metricPath(code) }
  ],
  noindex: !indexable
})
</script>

<template>
  <div class="app-page app-page--compact learn-page">
    <h1 class="app-page__title">{{ heading }}</h1>
    <StockBreadcrumb :items="breadcrumbs" />
    <LearnNav :active-to="group ? learnTopicPath(group.slug) : undefined" />

    <StockMetricGuide
      id-prefix="learn"
      :topic="name"
      :definition-question="topic?.definitionQuestion ?? `${spaced(name)}的定義是什麼？`"
      :definition-answer="topic?.definitionAnswer ?? null"
      :definition="definition"
      :rule="badge?.threshold?.note ?? null"
      :citation="badge?.author ? { author: badge.author, url: badge.sourceUrl ?? null } : null"
      :reading="topic ? null : guide.reading"
      :limitations="topic ? topic.limitations : guide.limitations"
      :misreadings="topic ? [] : guide.misreadings"
    />

    <StockQuestionSection v-if="formulaHtml || metric?.sources?.length" id="learn-formula" question="怎麼計算？">
      <!-- tabindex="0" + role/aria-label (2026-09-20) — a real axe scrollable-region-focusable
           finding: the wider formulas overflow at 375px, and a horizontally-scrollable region needs
           its own keyboard focus stop or a keyboard user cannot reach the part scrolled off-screen. -->
      <div v-if="formulaHtml" class="learn-page__formula" tabindex="0" role="group" :aria-label="`${name}的計算公式`" v-html="formulaHtml" />
      <p v-if="metric?.sources?.length" class="hub-answer">資料來源：{{ metric.sources.join('、') }}。</p>
      <p v-if="metric?.referenceUrl || metric?.academicSourceUrl" class="hub-answer">
        <template v-if="metric.academicSourceUrl"><a :href="metric.academicSourceUrl" target="_blank" rel="noopener" class="hub-inline-link">原始文獻（另開新視窗）</a></template>
        <template v-if="metric.academicSourceUrl && metric.referenceUrl">・</template>
        <template v-if="metric.referenceUrl"><a :href="metric.referenceUrl" target="_blank" rel="noopener" class="hub-inline-link">一般說明（另開新視窗）</a></template>
      </p>
    </StockQuestionSection>

    <StockQuestionSection v-if="!topic" id="learn-related" question="相關指標與功能有哪些？">
      <p v-if="siblings.length" class="hub-answer">
        同屬「{{ category!.name }}」的指標：<template v-for="(item, index) in siblings" :key="item.key"><template v-if="index">、</template><NuxtLink :to="metricPath(item.key)" class="hub-inline-link">{{ metricDisplayName(item) }}</NuxtLink></template>。
      </p>
      <ul v-if="rankPages.length || templatePages.length || badge" class="learn-page__related">
        <li v-for="page in rankPages" :key="page.slug"><NuxtLink :to="rankPath(page.slug)" class="hub-inline-link">台股{{ page.label }}排行</NuxtLink></li>
        <li v-for="template in templatePages" :key="template.id"><NuxtLink :to="screenerTemplatePath(template.slug!)" class="hub-inline-link">「{{ template.name }}」篩選條件說明</NuxtLink></li>
        <li v-if="badge">此指標在大師徽章系統中有對應徽章：<NuxtLink :to="`/guru-indicators#guru-badge-${code}`" class="hub-inline-link">看大師徽章</NuxtLink></li>
      </ul>
    </StockQuestionSection>

    <p class="hub-disclaimer">以上為指標與方法本身的說明，不代表本站對任何個股之評等或投資建議。</p>
  </div>
</template>

<style scoped>
.learn-page__formula {
  padding: 16px;
  overflow-x: auto;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 12px;
  background: var(--el-fill-color-blank);
  font-size: 1.125rem;
}

.learn-page__related {
  margin: 0;
  padding-left: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 1rem;
  line-height: 1.7;
}
</style>
