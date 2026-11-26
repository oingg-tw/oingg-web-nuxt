<script setup lang="ts">
import type { ScreenerTemplateWithSlug } from '#shared/types/hub'
import type { MetricCatalog } from '~/composables/screener/useFilterSchema'

// 選股策略（2026-11-26，使用者「有沒有畫面是可以集中看到所有選股策略介紹的？」→「選股策略照建議」，設計
// https://claude.ai/artifact/VRVKmE64K6vRiLdeuBKJKE 方案 A）：官方篩選範本的介紹集中在一頁。依類別分段，一組一張卡片：條件一條一個、
// 出處說明（範本說明「——」後面那段，最多三行，全文在條件說明頁）、今天符合幾檔、條件說明與套用。只寫檔數不列名單（同條件說明頁與首頁：
// 名單讀起來就是推薦），也不放回測報酬。入口只有「新增篩選」彈窗與網站導覽（使用者：「這樣使用流程我認為比較合理」）：篩選側欄、首頁都不加，
// 側欄跟條件說明頁一樣亮在普通股篩選
const { data: templates, error, refresh } = await useFetch<ScreenerTemplateWithSlug[]>('/api/hub/screener-templates', { key: 'hub-screener-templates', default: () => [] })
watchLoadFailure('hub-screener-templates', () => error.value, refresh)
// 有條件說明頁的才列：已上架、名稱在 SCREENER_TEMPLATE_SLUGS 裡
const available = computed(() => templates.value.filter(item => item.slug && item.status === 'AVAILABLE' && screenerTemplateNameBySlug(item.slug)))
const slugs = computed(() => available.value.map(item => item.slug!))

// 檔數一組一支（伺服器有快取，條件說明頁、首頁讀同一份）；讀不到的那組不寫檔數，不擋整頁
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
  items: group.items.map(item => ({
    ...item,
    conditions: templateConditions(item.filters, catalog.value?.categories ?? []),
    intro: strategyIntro(item.description),
    count: countOf(item.slug!)
  }))
})))
const lead = computed(() => (available.value.length ? `${available.value.length} 組篩選條件，每組都寫明出處；看每個條件的意思，或直接套用到普通股篩選。` : null))

const { breadcrumbs } = useHubPageSeo({
  title: '選股策略：每組篩選條件的出處與符合檔數',
  description: () => clampDescription(`${lead.value ?? ''}${available.value.map(item => item.name).join('、')}，每組列出條件、出處與今天符合的檔數。`),
  path: STRATEGIES_PATH,
  breadcrumbs: [
    { label: '首頁', to: '/' },
    { label: '普通股篩選', to: SCREENER_PATHS.common },
    { label: '選股策略', to: STRATEGIES_PATH }
  ]
})

const GUIDE = [
  '每一組都寫明出處。跟原研究或原作者不一樣的地方寫在說明裡，例如成長突破沒有納入原法的法人持股。',
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

    <section v-for="(group, index) in groups" :key="group.category" class="stock-page-section" :aria-labelledby="`strategies-group-${index}`">
      <h2 :id="`strategies-group-${index}`" class="stock-page-section__title">
        {{ group.category }} <span class="strategies-page__muted">{{ group.items.length }} 組</span>
      </h2>
      <ul class="strategies-page__grid">
        <li v-for="item in group.items" :key="item.id" class="app-card strategies-page__card">
          <div class="strategies-page__head">
            <h3 class="strategies-page__name">{{ item.name }}</h3>
            <el-tag v-if="item.isDefault" size="small" effect="plain">篩選頁預設</el-tag>
          </div>
          <ul class="strategies-page__conditions" :aria-label="`${item.name}的條件`">
            <li v-for="row in item.conditions" :key="row.field">{{ row.label }}（{{ row.period }}）<b>{{ row.range }}</b></li>
          </ul>
          <p v-if="item.intro" class="strategies-page__intro">{{ item.intro }}</p>
          <div class="strategies-page__foot">
            <p v-if="item.count !== null" class="strategies-page__count">今天符合 <b>{{ groupThousands(item.count) }}</b> 檔</p>
            <el-button type="primary" tag="a" :href="commonScreenerPath({ template: item.slug! })">用這組條件篩選</el-button>
            <NuxtLink :to="screenerTemplatePath(item.slug!)" class="hub-inline-link strategies-page__more">條件說明 ›</NuxtLink>
          </div>
        </li>
      </ul>
    </section>

    <StockMetricGuide id-prefix="strategies" topic="選股策略" definition-question="選股策略怎麼看？" :definition="GUIDE" />
    <p class="hub-disclaimer">本頁面提供之客觀排行與指標統計僅供研究參考，非屬投顧法之推薦買賣建議，使用者應獨立審慎評估風險。</p>
  </div>
</template>

<style scoped>
/* 一列幾張看內容區的寬度：電腦版兩張，手機一張 */
.strategies-page__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 22rem), 1fr));
  gap: 16px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.strategies-page__card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
}

.strategies-page__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.strategies-page__name {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
}

.strategies-page__conditions {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
  font-variant-numeric: tabular-nums;
}

.strategies-page__conditions b {
  margin-left: 6px;
  font-weight: 600;
  white-space: nowrap;
}

/* 出處說明最多三行，全文在條件說明頁 */
.strategies-page__intro {
  display: -webkit-box;
  margin: 0;
  overflow: hidden;
  color: var(--el-text-color-secondary);
  line-height: 1.6;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}

.strategies-page__foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 16px;
  margin-top: auto;
  padding-top: 12px;
  border-top: 1px solid var(--app-divider);
}

/* 檔數自己一行，下一行是套用與條件說明：卡片一列兩張時三樣擠不下一行 */
.strategies-page__count {
  flex-basis: 100%;
  margin: 0;
  font-variant-numeric: tabular-nums;
}

.strategies-page__more {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
}

.strategies-page__count b {
  font-size: 1.375rem;
  font-weight: 600;
}

.strategies-page__muted {
  font-size: 1rem;
  font-weight: 400;
  color: var(--el-text-color-secondary);
}
</style>
