<script setup lang="ts">
import type { MetricCatalog } from '~/composables/screener/useFilterSchema'
import type { LearnGroup } from '#shared/utils/learn-topics'
// 新手專區的組頁（2026-10-12 結構重做，凹型導覽樹的中間層）：這一組回答什麼 → 先看這幾個 → 這一組的全部指標 → 上一組／下一組。
// 「先看這幾個」是 LEARN_GROUPS 的 core，一句話取定義的第一句，跟指標教學頁同一份解析（metricGuideFrom）。
// 全部指標的表不分頁、不摺疊（知識庫：末層不分頁也不摺疊）。
const props = defineProps<{ group: LearnGroup }>()

const { data: catalog, error } = await useFetch<MetricCatalog>('/api/hub/metrics', { key: 'hub-metrics', default: () => ({ categories: [] }) })
if (error.value) throw createError({ statusCode: 503, statusMessage: '指標目錄暫時無法取得', fatal: true })

const index = LEARN_GROUPS.findIndex(item => item.slug === props.group.slug)
const previous = LEARN_GROUPS[index - 1] ?? null
const next = LEARN_GROUPS[index + 1] ?? null

const categories = computed(() =>
  bySort(catalog.value?.categories ?? [])
    .filter(category => props.group.categories.includes(category.key))
    .map(category => ({ ...category, metrics: bySort(category.metrics) }))
)
const metricCount = computed(() => categories.value.reduce((count, category) => count + category.metrics.length, 0))

const core = computed(() =>
  props.group.core.flatMap((item) => {
    if ('topic' in item) {
      const topic = findLearnTopic(item.topic)
      return topic ? [{ key: topic.slug, label: topic.topic, to: learnTopicPath(topic.slug), line: topic.summary }] : []
    }
    const metric = findMetricInSchema(catalog.value?.categories ?? [], item.metric)?.metric
    if (!metric) return []
    const definition = metricGuideFrom(findMetricCopy(item.metric), metric).definition[0]
    return [{ key: item.metric, label: metricDisplayName(metric), to: metricPath(item.metric), line: firstSentence(definition) ?? '' }]
  })
)

function periodsOf(metric: MetricCatalog['categories'][number]['metrics'][number]): string {
  return metric.fields.map(field => formatPeriodLabel(field.period) ?? field.period).join('／')
}

const path = learnTopicPath(props.group.slug)
const { breadcrumbs } = useHubPageSeo({
  title: `${props.group.question}財報指標怎麼看`,
  description: () => clampDescription(`${props.group.answer}先看${core.value.map(item => item.label).join('、')}，再看這一組全部 ${metricCount.value} 項指標。`),
  path,
  breadcrumbs: [
    { label: '首頁', to: '/' },
    { label: '新手專區', to: '/learn' },
    { label: props.group.question, to: path }
  ]
})
</script>

<template>
  <div class="app-page app-page--compact learn-group">
    <h1 class="app-page__title">{{ index + 1 }}. {{ group.question }}</h1>
    <StockBreadcrumb :items="breadcrumbs" />
    <LearnNav />

    <StockQuestionSection :id="`learn-${group.slug}-about`" question="這一組在回答什麼？" :answer="group.answer" />

    <StockQuestionSection :id="`learn-${group.slug}-core`" question="先看哪幾個？">
      <ol class="learn-group__core">
        <li v-for="item in core" :key="item.key">
          <NuxtLink :to="item.to" class="learn-group__core-link">{{ item.label }}</NuxtLink>
          <p v-if="item.line" class="learn-group__core-line">{{ item.line }}</p>
        </li>
      </ol>
      <p v-if="group.slug === 'dividends'" class="hub-answer">
        每一檔股票的配息是怎麼從營收一路算出來的，另有「配息從哪來」逐步拆解，從個股的配股配息頁尾進入，例如<NuxtLink to="/learn/dividend-source/2330" class="hub-inline-link">台積電 2330 的配息從哪來</NuxtLink>。
      </p>
    </StockQuestionSection>

    <StockQuestionSection :id="`learn-${group.slug}-all`" :question="`這一組還有哪些指標？（共 ${metricCount} 項）`">
      <section v-for="category in categories" :key="category.key" class="learn-group__category" :aria-labelledby="`learn-category-${category.key}-heading`">
        <h3 :id="`learn-category-${category.key}-heading`" class="learn-group__category-title">{{ category.name }}（{{ category.metrics.length }} 項）</h3>
        <SharedTable :label="`${category.name}指標`" :caption="`${category.name}類指標的名稱、單位與期別`">
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
        </SharedTable>
      </section>
    </StockQuestionSection>

    <nav class="learn-group__pager" aria-label="上一組與下一組">
      <NuxtLink v-if="previous" :to="learnTopicPath(previous.slug)" class="learn-group__pager-link">← 上一組：{{ previous.question }}</NuxtLink>
      <NuxtLink v-if="next" :to="learnTopicPath(next.slug)" class="learn-group__pager-link learn-group__pager-link--next">下一組：{{ next.question }} →</NuxtLink>
    </nav>

    <p class="hub-disclaimer">以上為指標與方法本身的說明，不代表本站對任何個股之評等或投資建議。</p>
  </div>
</template>

<style scoped>
.learn-group__core {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin: 0;
  padding-left: 1.5em;
}

.learn-group__core-link {
  font-weight: 600;
  color: var(--el-color-primary-dark-2);
}

.learn-group__core-line {
  margin: 4px 0 0;
  line-height: 1.7;
  color: var(--el-text-color-regular);
}

.learn-group__category + .learn-group__category {
  margin-top: 24px;
}

.learn-group__category-title {
  margin: 0 0 8px;
  font-size: 1rem;
  font-weight: 600;
}

.learn-group__pager {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 12px;
}

.learn-group__pager-link {
  display: inline-flex;
  align-items: center;
  min-height: 48px;
  padding: 0 16px;
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  color: var(--el-color-primary-dark-2);
  text-decoration: none;
}

.learn-group__pager-link--next {
  margin-left: auto;
}
</style>
