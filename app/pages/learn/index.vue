<script setup lang="ts">
import { Search } from '@element-plus/icons-vue'
import type { MetricCatalog } from '~/composables/screener/useFilterSchema'
import type { StockSuggestion } from '~/composables/stock/useStockSearch'
// /learn — 新手專區首頁，以「配息從哪來」為主線（2026-10-12，使用者：「你還記得配息哪裡來那一頁嗎? 我希望以這一頁為核心，或是
// 至少保留這頁的互動教學精神」；選了「當首頁主線，六組掛在鏈上」「預設台積電，讀者可以換」）。
//
// 三段：① 用一家真實公司的數字一步切一刀（營收→毛利→營業利益→EPS→股利），每一步底下是那一步可以往下看的教學；② 這條鏈對應
// 哪三組；③ 鏈上看不到的三件事。六組的順序就是這個順序（LEARN_GROUPS）。
// 換公司只換 useState，不進網址：這一頁是教學頁，例子是哪一家不是它的身分（同一個網址不該因為參數變成兩千多頁）。
// 入口只放個股頁尾（使用者選的），網站頁尾與頭部導覽不放。
const exampleCode = useState('learn-example-code', () => '2330')
const { stockShortName } = useStockDetailSummary(exampleCode)
const { chainAnswer, chartDrawn, segment } = await useDividendSourceChain(exampleCode, stockShortName)
const { data: catalog } = await useFetch<MetricCatalog>('/api/hub/metrics', { key: 'hub-metrics', default: () => ({ categories: [] }) })

// 換一家公司：只收一般股（ETF、特別股沒有這條損益表鏈）
const { keyword, fetchSuggestions } = useStockSearch()
const autocompleteRef = ref<{ $el?: Node } | null>(null)
useAutocompleteActiveDescendantFix(autocompleteRef)
function commonOnly(query: string, callback: (results: StockSuggestion[]) => void) {
  fetchSuggestions(query, results => callback(results.filter(item => !isCompanyEntry(item) || item.kind === 'common')))
}
function pick(item: Record<string, unknown>) {
  const suggestion = item as unknown as StockSuggestion
  if (!isCompanyEntry(suggestion)) return
  exampleCode.value = suggestion.code
  keyword.value = ''
}

const groups = computed(() =>
  LEARN_GROUPS.map((group, index) => ({
    ...group,
    number: index + 1,
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
// 前三組在鏈上的位置
const ON_CHAIN: Record<string, string> = {
  earnings: '圖上第 1 到第 4 步：從營收一路切到 EPS。',
  dividends: '圖上第 5 步：EPS 裡有多少發給了股東。',
  valuation: '圖之外再一步：每股股利除以股價是殖利率；股價跟 EPS、淨值相比，就是本益比、股價淨值比。'
}
const onChain = computed(() => groups.value.filter(group => ON_CHAIN[group.slug]))
const offChain = computed(() => groups.value.filter(group => !ON_CHAIN[group.slug]))

const { breadcrumbs } = useHubPageSeo({
  title: '新手專區：從一家公司的配息看懂財報',
  description: '用一家真實公司的數字，從營收一步一步切到配給股東的股利，每一步都能往下看那一步用到的指標；再看鏈上看不到的三件事：錢是不是真的、會不會倒、會不會成長。',
  path: '/learn',
  breadcrumbs: [
    { label: '首頁', to: '/' },
    { label: '新手專區', to: '/learn' }
  ]
})
</script>

<template>
  <div class="app-page app-page--compact learn-index">
    <h1 class="app-page__title">新手專區：從一家公司的配息看懂財報</h1>
    <StockBreadcrumb :items="breadcrumbs" />
    <LearnNav />

    <StockQuestionSection id="learn-chain" :question="`${stockShortName}配的息，是從哪一塊錢來的？`" :answer="chainAnswer ?? undefined">
      <div class="learn-index__picker">
        <span class="learn-index__picker-label">換一家公司：</span>
        <ClientOnly>
          <el-autocomplete
            ref="autocompleteRef"
            v-model="keyword"
            class="learn-index__picker-input"
            :fetch-suggestions="commonOnly"
            placeholder="輸入股票代號或名稱，例如 2317"
            aria-label="換一家公司當例子：輸入股票代號或名稱"
            clearable
            @select="pick"
          >
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
            <template #default="{ item }">
              <span v-if="item.code === NO_MATCH_SENTINEL">{{ item.name }}</span>
              <span v-else>{{ item.name }} {{ item.code }}</span>
            </template>
          </el-autocomplete>
          <template #fallback>
            <span class="learn-index__picker-fallback">目前的例子是 {{ stockShortName }} {{ exampleCode }}</span>
          </template>
        </ClientOnly>
      </div>
      <LearnDividendChain :segment="segment" :drawn="chartDrawn" step-links />
      <p class="hub-answer">想看這一家的完整拆解與逐列數字：<NuxtLink :to="`/learn/dividend-source/${exampleCode}`" class="hub-inline-link">{{ stockShortName }} {{ exampleCode }} 的配息從哪來</NuxtLink>。</p>
    </StockQuestionSection>

    <StockQuestionSection id="learn-on-chain" question="這條鏈對應哪幾組指標？" answer="鏈上的五步分屬三組：前四步看公司賺不賺錢，第五步看配給股東多少，再拿股價來比就是貴不貴。">
      <section v-for="group in onChain" :key="group.slug" class="learn-index__group" :aria-labelledby="`learn-group-${group.slug}-heading`">
        <h3 :id="`learn-group-${group.slug}-heading`" class="learn-index__group-title">{{ group.number }}. {{ group.question }}</h3>
        <p class="hub-answer">{{ ON_CHAIN[group.slug] }}{{ group.answer }}</p>
        <p class="hub-answer">
          先看：<template v-for="(link, linkIndex) in group.links" :key="link.key"><template v-if="linkIndex">、</template><NuxtLink :to="link.to" class="hub-inline-link">{{ link.label }}</NuxtLink></template>。<NuxtLink :to="learnTopicPath(group.slug)" class="hub-inline-link">看這一組的全部指標</NuxtLink>
        </p>
      </section>
    </StockQuestionSection>

    <StockQuestionSection id="learn-off-chain" question="這條鏈上看不到什麼？" answer="損益表只說這一年賺了多少，說不出錢有沒有真的收進來、公司扛不扛得住負債、明年會不會更好。這三件事各自是一組。">
      <section v-for="group in offChain" :key="group.slug" class="learn-index__group" :aria-labelledby="`learn-group-${group.slug}-heading`">
        <h3 :id="`learn-group-${group.slug}-heading`" class="learn-index__group-title">{{ group.number }}. {{ group.question }}</h3>
        <p class="hub-answer">{{ group.answer }}</p>
        <p class="hub-answer">
          先看：<template v-for="(link, linkIndex) in group.links" :key="link.key"><template v-if="linkIndex">、</template><NuxtLink :to="link.to" class="hub-inline-link">{{ link.label }}</NuxtLink></template>。<NuxtLink :to="learnTopicPath(group.slug)" class="hub-inline-link">看這一組的全部指標</NuxtLink>
        </p>
      </section>
    </StockQuestionSection>

    <p class="hub-disclaimer">以上為指標與方法本身的說明，圖上的公司只是例子，不代表本站對任何個股之評等或投資建議。</p>
  </div>
</template>

<style scoped>
.learn-index__picker {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.learn-index__picker-input {
  width: min(20rem, 100%);
}

.learn-index__picker-fallback {
  color: var(--el-text-color-secondary);
}

.learn-index__group + .learn-index__group {
  margin-top: 20px;
}

.learn-index__group-title {
  margin: 0 0 8px;
  font-size: 1.125rem;
  font-weight: 600;
}
</style>
