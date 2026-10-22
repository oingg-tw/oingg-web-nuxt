<script setup lang="ts">
import type { RankingRow } from '#shared/types/hub'
// /rank — 排行的首頁（2026-09-19 SEO build）。2026-10-21 重做（使用者：「rank 希望 sidebar 區分 普通股與 etf」，同日總經特區的首頁因為
//「內容與sidebar是重複資訊」改成最新數值）：排行有了側欄（RankNav，普通股／ETF 兩組）之後，原本這一頁的「有哪些排行」清單就是側欄的
// 複本。現在答「每一份排行現在的第一名是誰」：排行名稱、第一名、數值，普通股與 ETF 各一張表，點排行名稱看前 50 檔。用詞同排行頁
//（由高到低／由低到高，不寫最強、最佳），合規說明照舊放在本頁。
const { data: leaders, error } = await useFetch<{ slug: string; leader: RankingRow | null; asOf: string | null; unit: string | null }[]>('/api/hub/rank-leaders', { key: 'hub-rank-leaders' })
if (error.value || !leaders.value) throw createError({ statusCode: 503, statusMessage: '排行資料暫時無法取得', fatal: true })

const commonPages = RANK_PAGES.filter(page => page.universe !== 'etf')
const etfPages = RANK_PAGES.filter(page => page.universe === 'etf')
const someLabels = (pages: RankPageDefinition[], count: number) => pages.slice(0, count).map(page => page.label).join('、')
const { breadcrumbs } = useHubPageSeo({
  title: '台股排行：普通股與 ETF 各項指標的前 50 檔',
  // 名稱從 RANK_PAGES 推，不手打：曾經只算了數量、名稱留著已撤掉的那一頁。全部列出會超過 90 字（check-hub-pages），只舉前幾個
  description: `台股 ${RANK_PAGES.length} 種單一指標排行，各列前 50 檔：普通股 ${commonPages.length} 種（${someLabels(commonPages, 4)} 等），ETF ${etfPages.length} 種（${someLabels(etfPages, 3)}等），本頁列出每一種目前的第一名與數值。`,
  path: '/rank',
  breadcrumbs: [
    { label: '首頁', to: '/' },
    { label: '排行', to: '/rank' }
  ]
})

const orderWord = (page: RankPageDefinition) => (page.direction === 'desc' ? '由高到低' : '由低到高')
const groups = computed(() => [
  { key: 'common', title: '普通股', pages: commonPages },
  { key: 'etf', title: 'ETF', pages: etfPages }
].map(group => ({
  ...group,
  rows: group.pages.map((page) => {
    const entry = leaders.value?.find(item => item.slug === page.slug)
    const unit = entry?.unit ?? ''
    return {
      page,
      leader: entry?.leader ?? null,
      value: entry?.leader ? `${rankValueText(page, entry.leader.value)}${unit === '%' ? '%' : unit ? ` ${unit}` : ''}` : '－'
    }
  })
})))
</script>

<template>
  <div class="app-page rank-index">
    <h1 class="app-page__title rank-index__title">台股排行：依單一指標排序的前 50 檔</h1>
    <StockBreadcrumb :items="breadcrumbs" />
    <RankNav />

    <section class="stock-page-section" aria-labelledby="rank-index-leaders-heading">
      <h2 id="rank-index-leaders-heading" class="stock-page-section__title">每一份排行現在的第一名是誰？</h2>
      <p class="hub-answer">每一份排行只依一個指標排序；下表是各排行目前的第一名與它的數值，點排行名稱看前 50 檔與資料日期。</p>
      <template v-for="group in groups" :key="group.key">
        <h3 class="rank-index__group">{{ group.title }}</h3>
        <SharedTable :label="`${group.title}各排行的第一名`" :caption="`${group.title}各項排行目前的第一名與數值`" table-class="rank-index__table">
          <thead>
            <tr>
              <th scope="col">排行</th>
              <th scope="col">第一名</th>
              <th scope="col" class="seo-table__num">數值</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in group.rows" :key="row.page.slug">
              <th scope="row">
                <NuxtLink :to="rankPath(row.page.slug)" class="seo-table__link">{{ row.page.label }}</NuxtLink>
                <span class="rank-index__order">{{ orderWord(row.page) }}</span>
              </th>
              <td>
                <NuxtLink v-if="row.leader" :to="securityPath(row.leader.symbol)" class="seo-table__link">{{ row.leader.name }} {{ row.leader.symbol }}</NuxtLink>
                <template v-else>暫時無法取得</template>
              </td>
              <td class="seo-table__num">{{ row.value }}</td>
            </tr>
          </tbody>
        </SharedTable>
      </template>
    </section>

    <section class="stock-page-section" aria-labelledby="rank-index-howto-heading">
      <h2 id="rank-index-howto-heading" class="stock-page-section__title">排行怎麼讀？</h2>
      <p class="hub-answer">名次只是數值排序後的位置：同一數值並列時依代號排序，交易所每日公布的欄位以資料日期當天為準，財報欄位以最近一期申報為準，ETF 的規模、受益人數與報酬率以投信投顧公會基金月報的最新月份為準。排行不比較產業或資產類型的差異，也不代表任何評等。</p>
      <p class="hub-disclaimer">本頁面提供之客觀排行與指標統計僅供研究參考，非屬投顧法之推薦買賣建議，使用者應獨立審慎評估風險。</p>
    </section>
  </div>
</template>

<style scoped>
.rank-index__group {
  margin: 16px 0 8px;
  font-size: 1.125rem;
  font-weight: 600;
}

/* 排行名稱與「由高到低」兩行：手機上表格不左右捲 */
.rank-index__table th,
.rank-index__table td {
  white-space: normal;
}

.rank-index__order {
  display: block;
  color: var(--el-text-color-secondary);
  font-weight: 400;
}
</style>
