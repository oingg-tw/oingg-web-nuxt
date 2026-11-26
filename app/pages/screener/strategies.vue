<script setup lang="ts">
import type { ScreenerTemplateWithSlug } from '#shared/types/hub'
import type { MetricCatalog } from '~/composables/screener/useFilterSchema'

// 選股策略（2026-11-26，使用者「有沒有畫面是可以集中看到所有選股策略介紹的？」）：官方篩選範本一頁看完。方案 C（每一組攤開成一整段）上了
// DEV 之後使用者覺得「看起來還是髒髒的」，同日看過設計圖（https://claude.ai/artifact/VRVKmE64K6vRiLdeuBKJKE 第二版）→「改成方案D」：
// 一類一段、一類一張卡片、一組一列：名稱與條件一行、今天符合幾檔、「套用」；出處說明收在名稱底下，點名稱展開。條件說明頁 /screener/common/{代稱}
// 收進來，舊網址 301 到 #代稱，那一組自己展開。只寫檔數不列名單（名單讀起來就是推薦），也不放回測報酬。入口只有「新增篩選」彈窗與網站導覽
//（使用者：「這樣使用流程我認為比較合理」）：篩選側欄、首頁都不連過來，側欄亮在普通股篩選
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

const groups = computed(() => strategyGroups(available.value).map(group => ({
  category: group.category,
  line: STRATEGY_CATEGORY_LINES[group.category] ?? null,
  items: group.items.map((item) => {
    const conditions = templateConditions(item.filters, catalog.value?.categories ?? [])
    return {
      id: item.id,
      name: item.name,
      isDefault: item.isDefault,
      slug: item.slug!,
      conditions: conditions.map(conditionText).join('・'),
      metricLinks: conditions.flatMap(row => (row.metricPage ? [{ to: row.metricPage, label: row.label }] : [])),
      intro: strategyIntro(item.description),
      count: countOf(item.slug!)
    }
  })
})))
const total = computed(() => groups.value.reduce((sum, group) => sum + group.items.length, 0))
const lead = computed(() => (total.value ? `${total.value} 組篩選條件${groups.value.length > 1 ? `，分成 ${groups.value.length} 類` : ''}。點名稱看出處，點「套用」直接打開普通股篩選。` : null))

// 舊的條件說明頁轉過來帶 #代稱：那一組展開。伺服器畫的是收起來的，掛上之後才打開；打開只往下長，不推動上面
const openSlug = ref<string | null>(null)
const syncHash = () => {
  openSlug.value = location.hash.slice(1) || null
}
onMounted(() => {
  syncHash()
  window.addEventListener('hashchange', syncHash)
})
onBeforeUnmount(() => window.removeEventListener('hashchange', syncHash))

const { breadcrumbs } = useHubPageSeo({
  title: '選股策略：每組篩選條件的出處與符合檔數',
  description: () => clampDescription(`${lead.value ?? ''}${groups.value.flatMap(group => group.items.map(item => item.name)).join('、')}，每組列出條件、出處與今天符合的檔數。`),
  path: STRATEGIES_PATH,
  breadcrumbs: [
    { label: '首頁', to: '/' },
    { label: '普通股篩選', to: SCREENER_PATHS.common },
    { label: '選股策略', to: STRATEGIES_PATH }
  ]
})

const GUIDE = [
  '「符合」是最近一次計算的檔數。這裡只寫檔數、不列名單，名單在套用後的篩選結果裡。',
  '每一組都寫明出處，點名稱展開。跟原研究或原作者不一樣的地方寫在說明裡，例如成長突破沒有納入原法的法人持股。',
  '條件只是把公開的財報與股價數字做區間過濾，不含任何評等；指標的定義與資料來源在各指標的頁面。',
  '套用之後可以再改條件、改區間或限定類股；登入後能存成自己的篩選。'
]
</script>

<template>
  <div class="app-page strategies-page">
    <h1 class="app-page__title">選股策略</h1>
    <StockBreadcrumb :items="breadcrumbs" />
    <ScreenerNav :active-to="SCREENER_PATHS.common" />
    <p v-if="lead" class="hub-answer">{{ lead }}</p>
    <nav v-if="groups.length > 1" class="strategies-page__jump" aria-label="跳到">
      <span class="strategies-page__muted" aria-hidden="true">跳到</span>
      <ul class="hub-chip-list">
        <li v-for="group in groups" :key="group.category"><a :href="`#${group.category}`" class="hub-chip">{{ group.category }}</a></li>
      </ul>
    </nav>

    <StockQuestionSection v-for="group in groups" :id="group.category" :key="group.category" :question="group.category" :answer="group.line">
      <div class="app-card strategies-page__card">
        <div v-for="item in group.items" :id="item.slug" :key="item.id" class="strategies-row">
          <details class="app-disclosure strategies-row__more" :open="openSlug === item.slug">
            <summary>
              <h3 class="strategies-row__name">{{ item.name }}</h3>
              <el-tag v-if="item.isDefault" size="small" effect="light" disable-transitions>篩選頁預設</el-tag>
              <span class="strategies-row__conditions">{{ item.conditions }}</span>
            </summary>
            <p v-if="item.intro" class="strategies-row__text">{{ item.intro }}</p>
            <p v-if="item.metricLinks.length" class="strategies-row__text">
              指標的定義：<template v-for="(link, index) in item.metricLinks" :key="link.to"><template v-if="index">、</template><NuxtLink :to="link.to">{{ link.label }}</NuxtLink></template>
            </p>
          </details>
          <p v-if="item.count !== null" class="strategies-row__count">符合 <b>{{ groupThousands(item.count) }}</b> 檔</p>
          <a :href="commonScreenerPath({ template: item.slug })" class="strategies-row__apply">套用<span class="visually-hidden">「{{ item.name }}」</span><span aria-hidden="true"> ›</span></a>
        </div>
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

/* 一組一列。窄的時候（手機的基本樣子）檔數與「套用」在名稱與條件下面一行；卡片寬 600px 起排成一列：名稱加預設標籤一行約 400px、
   檔數「符合 1,290 檔」約 110px、套用約 56px，加上間距 */
.strategies-page__card {
  container-type: inline-size;
}

.strategies-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  grid-template-areas: 'more more' 'count apply';
  column-gap: 16px;
  padding: 2px 16px;
  border-top: 1px solid var(--app-divider);
  scroll-margin-top: calc(var(--app-header-height) + var(--app-banner-height) + 16px);
}

.strategies-row:first-child {
  border-top: 0;
}

.strategies-row__more {
  grid-area: more;
  min-width: 0;
}

/* 名稱一行、條件另起一行，跟名稱對齊（箭頭 7px＋左右 3px＋間距 10px＝23px） */
.strategies-row__more > summary {
  flex-wrap: wrap;
  row-gap: 2px;
}

.strategies-row__name {
  margin: 0;
  font-size: 1.0625rem;
  line-height: 1.5;
  font-weight: 600;
}

.strategies-row__conditions {
  flex-basis: 100%;
  padding-left: 23px;
  font-weight: 400;
  line-height: 1.6;
  color: var(--el-text-color-secondary);
  font-variant-numeric: tabular-nums;
}

.strategies-row__text {
  margin: 0 0 12px;
  padding-left: 23px;
  line-height: 1.7;
  color: var(--el-text-color-regular);
}

.strategies-row__count {
  grid-area: count;
  align-self: center;
  margin: 0;
  padding-left: 23px;
  white-space: nowrap;
  color: var(--el-text-color-secondary);
  font-variant-numeric: tabular-nums;
}

.strategies-row__count b {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.strategies-row__apply {
  grid-area: apply;
  justify-self: end;
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  font-weight: 600;
  white-space: nowrap;
  color: var(--el-color-primary);
  text-decoration: none;
}

.strategies-row__apply:hover,
.strategies-row__apply:focus-visible {
  text-decoration: underline;
}

@container (min-width: 600px) {
  .strategies-row {
    grid-template-columns: minmax(0, 1fr) auto auto;
    grid-template-areas: 'more count apply';
    align-items: start;
    padding: 0 20px;
  }

  .strategies-row__count {
    align-self: start;
    padding-left: 0;
    line-height: 44px;
  }
}
</style>
