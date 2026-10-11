<script setup lang="ts">
import type { MetricCatalog } from '~/composables/screener/useFilterSchema'
// /learn — 新手專區首頁（2026-10-12 重做，使用者：「learn 新手專區的設計簡直失敗透頂 毫無結構可言」；選了「首頁是學習順序 1→6」）。
// 不再放全部指標的大表（那在各組頁）：首頁只回答「從哪裡開始、照什麼順序」，六組各一段，每段一句話＋先看的幾個＋進組頁。
// 順序的理由：先確認公司賺錢、錢是真的、不會倒，才談配多少、貴不貴、會不會成長——前三組是門檻，後三組才是取捨。
// 入口只放個股頁尾（使用者選的），網站頁尾與頭部導覽不放。
const { data: catalog } = await useFetch<MetricCatalog>('/api/hub/metrics', { key: 'hub-metrics', default: () => ({ categories: [] }) })

const groups = computed(() =>
  LEARN_GROUPS.map(group => ({
    ...group,
    links: group.core.flatMap((item) => {
      if ('topic' in item) {
        const topic = findLearnTopic(item.topic)
        return topic ? [{ key: topic.slug, label: topic.topic, to: learnTopicPath(topic.slug) }] : []
      }
      const metric = findMetricInSchema(catalog.value?.categories ?? [], item.metric)?.metric
      return metric ? [{ key: item.metric, label: metricDisplayName(metric), to: metricPath(item.metric) }] : []
    })
  }))
)

const { breadcrumbs } = useHubPageSeo({
  title: '新手專區：財報指標從哪裡開始看',
  description: '把看一家公司拆成六個問題：賺不賺錢、賺的是不是真錢、會不會倒、配給股東多少、現在貴不貴、還會不會成長。每個問題先看幾個指標，再看完整清單。',
  path: '/learn',
  breadcrumbs: [
    { label: '首頁', to: '/' },
    { label: '新手專區', to: '/learn' }
  ]
})
</script>

<template>
  <div class="app-page app-page--compact learn-index">
    <h1 class="app-page__title">新手專區：財報指標從哪裡開始看</h1>
    <StockBreadcrumb :items="breadcrumbs" />
    <LearnNav />

    <StockQuestionSection id="learn-how" question="要照什麼順序看？" answer="把看一家公司拆成六個問題，照 1 到 6 的順序：前三個確認公司賺錢、賺的是真錢、不會倒，後三個才談配多少、貴不貴、會不會成長。">
      <p class="hub-answer">每個問題先看列出的幾個指標就夠了；想再深入，進那一組可以看到全部指標。個股頁上每一個指標的頁尾，也都連回這裡的說明。</p>
    </StockQuestionSection>

    <StockQuestionSection v-for="(group, index) in groups" :id="`learn-step-${group.slug}`" :key="group.slug" :question="`${index + 1}. ${group.question}`" :answer="group.answer">
      <p class="hub-answer">
        先看：<template v-for="(link, linkIndex) in group.links" :key="link.key"><template v-if="linkIndex">、</template><NuxtLink :to="link.to" class="hub-inline-link">{{ link.label }}</NuxtLink></template>
      </p>
      <p class="hub-answer"><NuxtLink :to="learnTopicPath(group.slug)" class="hub-inline-link">看「{{ group.question }}」這一組的全部指標</NuxtLink></p>
    </StockQuestionSection>

    <p class="hub-disclaimer">以上為指標與方法本身的說明，不代表本站對任何個股之評等或投資建議。</p>
  </div>
</template>
