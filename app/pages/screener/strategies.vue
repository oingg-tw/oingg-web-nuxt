<script setup lang="ts">
import type { ScreenerTemplateWithSlug } from '#shared/types/hub'
import type { MetricCatalog } from '~/composables/screener/useFilterSchema'

// 選股策略（2026-11-26，使用者「有沒有畫面是可以集中看到所有選股策略介紹的？」；設計 https://claude.ai/artifact/VRVKmE64K6vRiLdeuBKJKE 方案 C）：
// 官方篩選範本一頁看完，每一組攤開成一整段：名稱與類別、說明全文、條件表（指標連到指標頁）、今天符合幾檔與套用。方案 A 的卡片上了 DEV 之後
// 使用者覺得「鳥鳥的」，也說條件說明頁「資訊量也沒有大到值得自己一頁」→「蓋成方案C」：條件說明頁 /screener/common/{代稱} 收進來，舊網址 301 到
// #代稱。只寫檔數不列名單（名單讀起來就是推薦），也不放回測報酬。入口只有「新增篩選」彈窗與網站導覽（使用者：「這樣使用流程我認為比較合理」）：
// 篩選側欄、首頁都不連過來，側欄亮在普通股篩選
const { data: templates, error, refresh } = await useFetch<ScreenerTemplateWithSlug[]>('/api/hub/screener-templates', { key: 'hub-screener-templates', default: () => [] })
watchLoadFailure('hub-screener-templates', () => error.value, refresh)
// 有代稱的才列（#代稱 是舊網址轉過來的落點）：已上架、名稱在 SCREENER_TEMPLATE_SLUGS 裡
const available = computed(() => templates.value.filter(item => item.slug && item.status === 'AVAILABLE' && screenerTemplateNameBySlug(item.slug)))
const slugs = computed(() => available.value.map(item => item.slug!))

// 檔數一組一支（伺服器有快取，首頁讀同一份）；讀不到的那組不寫檔數，不擋整頁
const [{ data: counts }, { data: catalog }] = await Promise.all([
  useAsyncData(
    () => `hub-strategy-counts-${slugs.value.join(',')}`,
    () => Promise.all(slugs.value.map(slug => $fetch<{ slug: string; count: number | null }>(`/api/hub/screener-template-count/${slug}`).catch(() => ({ slug, count: null })))),
    { default: () => [] }
  ),
  useFetch<MetricCatalog>('/api/hub/metrics', { key: 'hub-metrics', default: () => ({ categories: [] }) })
])
const countOf = (slug: string) => counts.value.find(item => item.slug === slug)?.count ?? null

const strategies = computed(() => strategyGroups(available.value).flatMap(group => group.items).map(item => ({
  ...item,
  slug: item.slug!,
  conditions: templateConditions(item.filters, catalog.value?.categories ?? []),
  intro: strategyIntro(item.description),
  count: countOf(item.slug!)
})))
const lead = computed(() => (strategies.value.length ? `${strategies.value.length} 組篩選條件，每組都寫明出處；看每個條件的意思，或直接套用到普通股篩選。` : null))

const { breadcrumbs } = useHubPageSeo({
  title: '選股策略：每組篩選條件的出處與符合檔數',
  description: () => clampDescription(`${lead.value ?? ''}${strategies.value.map(item => item.name).join('、')}，每組列出條件、出處與今天符合的檔數。`),
  path: STRATEGIES_PATH,
  breadcrumbs: [
    { label: '首頁', to: '/' },
    { label: '普通股篩選', to: SCREENER_PATHS.common },
    { label: '選股策略', to: STRATEGIES_PATH }
  ]
})

const GUIDE = [
  '每一組都寫明出處。跟原研究或原作者不一樣的地方寫在說明裡，例如成長突破沒有納入原法的法人持股。',
  '條件只是把公開的財報與股價數字做區間過濾，不含任何評等；指標的定義與資料來源在各指標的頁面。',
  '「今天符合」是最近一次計算的檔數。這裡只寫檔數、不列名單，名單在套用後的篩選結果裡。',
  '套用之後可以再改條件、改區間或限定類股；登入後能存成自己的篩選。'
]
</script>

<template>
  <div class="app-page strategies-page">
    <h1 class="app-page__title">選股策略</h1>
    <StockBreadcrumb :items="breadcrumbs" />
    <ScreenerNav :active-to="SCREENER_PATHS.common" />
    <p v-if="lead" class="hub-answer">{{ lead }}</p>
    <nav v-if="strategies.length > 1" class="strategies-page__jump" aria-label="跳到">
      <span class="strategies-page__muted" aria-hidden="true">跳到</span>
      <ul class="hub-chip-list">
        <li v-for="item in strategies" :key="item.id"><a :href="`#${item.slug}`" class="hub-chip">{{ item.name }}</a></li>
      </ul>
    </nav>

    <StockQuestionSection v-for="item in strategies" :id="item.slug" :key="item.id" :question="item.name" class="strategies-page__strategy">
      <p class="strategies-page__tags">
        <el-tag size="small" type="info" effect="plain">{{ item.category }}</el-tag>
        <el-tag v-if="item.isDefault" size="small" effect="plain">篩選頁預設</el-tag>
      </p>
      <!-- 說明全文放在條件表那張卡片裡：卡片前的字最多 80 字（2026-11-06「卡片之前的文字描述過多了，會失焦」），說明是這一組的內容不是前言 -->
      <SharedTable v-if="item.conditions.length" :label="`${item.name}的篩選條件`" :caption="`「${item.name}」的每一個篩選條件：指標、期間與條件`" table-class="strategies-page__table">
        <template v-if="item.intro" #header>
          <p class="strategies-page__intro">{{ item.intro }}</p>
        </template>
        <thead>
          <tr>
            <th scope="col">指標</th>
            <th scope="col">期間</th>
            <th scope="col">條件</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in item.conditions" :key="row.field">
            <th scope="row">
              <NuxtLink v-if="row.metricPage" :to="row.metricPage" class="seo-table__link">{{ row.label }}</NuxtLink>
              <template v-else>{{ row.label }}</template>
            </th>
            <td>{{ row.period }}</td>
            <td>{{ row.range }}</td>
          </tr>
        </tbody>
      </SharedTable>
      <div class="strategies-page__foot">
        <p v-if="item.count !== null" class="hub-answer">今天符合 <b class="strategies-page__count">{{ groupThousands(item.count) }}</b> 檔</p>
        <el-button type="primary" tag="a" :href="commonScreenerPath({ template: item.slug })">用這組條件篩選</el-button>
      </div>
    </StockQuestionSection>

    <StockMetricGuide id-prefix="strategies" topic="選股策略" definition-question="選股策略怎麼看？" :definition="GUIDE" />
    <p class="hub-disclaimer">本頁面提供之客觀排行與指標統計僅供研究參考，非屬投顧法之推薦買賣建議，使用者應獨立審慎評估風險。</p>
  </div>
</template>

<style scoped>
.strategies-page__jump {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.strategies-page__muted {
  color: var(--el-text-color-secondary);
}

/* 每一組之間一條線，跟上面那一組分開 */
.strategies-page__strategy {
  padding-top: 32px;
  border-top: 1px solid var(--app-divider);
}

.strategies-page__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: -8px 0 0;
}

.strategies-page__intro {
  margin: 0;
  line-height: 1.7;
  color: var(--el-text-color-regular);
}

/* 指標名稱很長（「Piotroski F-Score 財務體質評分」）：指標欄吃掉剩下的寬度、可以折行，期間與條件照內容寬，手機上三欄放得下 */
.strategies-page__table tbody th {
  width: 100%;
  white-space: normal;
}

.strategies-page__foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 16px;
}

.strategies-page__foot .hub-answer {
  margin: 0;
  font-variant-numeric: tabular-nums;
}

.strategies-page__count {
  font-size: 1.375rem;
  font-weight: 600;
}
</style>
