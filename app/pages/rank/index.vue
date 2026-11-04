<script setup lang="ts">
import type { RankPreview } from '#shared/types/hub'
// /rank — 排行的首頁（2026-09-19 SEO build）。2026-11-03 改成分類卡片（使用者看了三個方案選 B：「B 是對的」）：原本只答「每一份排行
// 現在的第一名是誰」，一份只看到一個名字，第一名又常是極端值，看不出該點哪一份。現在 RANK_CATEGORIES 一類一張卡，卡內用分段鈕切換
// 同類的排行，先列前 5 名（清單同排行頁的 RankList），底下連到完整名單。每份排行的前 5 名都畫進伺服器輸出的 HTML（沒選的用 v-show
// 藏起來），搜尋引擎照樣讀得到；選哪一份是頁內狀態，不進網址（一個欄位一個網址）。用詞同排行頁（由高到低／由低到高，不寫最強、最佳），
// 合規說明照舊放在本頁
const { data: previews, error } = await useFetch<RankPreview[]>('/api/hub/rank-leaders', { key: 'hub-rank-leaders' })
if (error.value || !previews.value) throw createError({ statusCode: 503, statusMessage: '排行資料暫時無法取得', fatal: true })
const commonPages = RANK_PAGES.filter(page => page.universe !== 'etf')
const etfPages = RANK_PAGES.filter(page => page.universe === 'etf')
const someLabels = (pages: RankPageDefinition[], count: number) => pages.slice(0, count).map(page => page.label).join('、')
const { breadcrumbs } = useHubPageSeo({
  title: '台股排行：普通股與 ETF 各項指標的前 50 檔',
  // 名稱從 RANK_PAGES 推，不手打：曾經只算了數量、名稱留著已撤掉的那一頁。全部列出會超過 90 字（check-hub-pages），只舉前幾個
  description: `台股 ${RANK_PAGES.length} 種單一指標排行，各列前 50 檔：普通股 ${commonPages.length} 種（${someLabels(commonPages, 3)}等），ETF ${etfPages.length} 種（${someLabels(etfPages, 3)}等），本頁分類列出每一種的前 5 名。`,
  path: '/rank',
  breadcrumbs: [
    { label: '首頁', to: '/' },
    { label: '排行', to: '/rank' }
  ]
})
const orderWord = (page: RankPageDefinition) => (page.direction === 'desc' ? '由高到低' : '由低到高')
// 連結字寫全名：讀屏的連結清單裡「看規模前 50 檔」看不出是 ETF
const subjectOf = (page: RankPageDefinition) => (page.universe === 'etf' ? `ETF ${page.label}` : page.label)
const cards = computed(() => RANK_CATEGORIES.map((category) => {
  const items = RANK_PAGES.filter(page => page.category === category.key).map((page) => {
    const preview = previews.value?.find(item => item.slug === page.slug)
    // 列上沒有日期時用的資料日期：基金月報寫月份、全年數字寫年度（同排行頁的標題）
    const period = page.monthlyReport && preview?.asOf ? `基金月報 ${preview.asOf}` : page.fullYear && preview?.valueYear ? `${preview.valueYear} 年全年` : ''
    return { page, rows: preview?.rows ?? [], count: preview?.count ?? 0, unit: preview?.unit ?? '', period }
  })
  return { ...category, group: items[0]?.page.universe === 'etf' ? 'ETF' : '普通股', items }
}))
// 每張卡片選的排行（slug），預設第一份
const picked = reactive<Record<string, string>>(Object.fromEntries(RANK_CATEGORIES.map(category => [category.key, RANK_PAGES.find(page => page.category === category.key)?.slug ?? ''])))
</script>

<template>
  <div class="app-page rank-index">
    <h1 class="app-page__title rank-index__title">台股排行：依單一指標排序的前 50 檔</h1>
    <StockBreadcrumb :items="breadcrumbs" />
    <RankNav />
    <p class="hub-answer">{{ RANK_PAGES.length }} 份排行，各依一個指標排序。每張卡片切換同類的排行，先列前 5 名；點「看前 50 檔」看完整名單、資料日期與指標說明。</p>
    <div class="rank-index__cards">
      <section v-for="card in cards" :key="card.key" class="rank-card" :aria-labelledby="`rank-card-${card.key}`">
        <div class="rank-card__head">
          <h2 :id="`rank-card-${card.key}`" class="rank-card__title"><span class="rank-card__group">{{ card.group }}</span>{{ card.title }}</h2>
          <el-radio-group v-if="card.items.length > 1" v-model="picked[card.key]" :aria-label="`${card.group}${card.title}：選擇排行`" class="app-radio-fill">
            <el-radio-button v-for="item in card.items" :key="item.page.slug" :value="item.page.slug">{{ item.page.short ?? item.page.label }}</el-radio-button>
          </el-radio-group>
        </div>
        <div v-for="item in card.items" v-show="picked[card.key] === item.page.slug" :key="item.page.slug" class="rank-card__panel">
          <RankList v-if="item.rows.length" :rows="item.rows" :page="item.page">
            <template #head="{ sharedDate, hasRowDates }">
              <p class="rank-card__caption">
                <strong>{{ item.page.label }}<template v-if="item.unit">（{{ item.unit }}）</template></strong>
                <span>{{ orderWord(item.page) }}</span>
                <span v-if="sharedDate">資料日期 {{ sharedDate }}</span>
                <span v-else-if="hasRowDates">各家資料日期不同</span>
                <span v-else-if="item.period">{{ item.period }}</span>
              </p>
            </template>
          </RankList>
          <p v-else class="rank-card__caption">{{ item.page.label }}的排行暫時無法取得。</p>
          <NuxtLink :to="rankPath(item.page.slug)" class="rank-card__more">
            看{{ subjectOf(item.page) }}前 {{ item.count || 50 }} 檔<span aria-hidden="true">›</span>
          </NuxtLink>
        </div>
      </section>
    </div>
    <section class="stock-page-section" aria-labelledby="rank-index-howto-heading">
      <h2 id="rank-index-howto-heading" class="stock-page-section__title">排行怎麼讀？</h2>
      <p class="hub-answer">名次只是數值排序後的位置：同一數值並列時依代號排序，交易所每日公布的欄位以資料日期當天為準，財報欄位以最近一期申報為準，ETF 的規模、受益人數、淨申購、定期定額與報酬率以投信投顧公會基金月報的最新月份為準，折溢價率以最近一個交易日為準。排行不比較產業或資產類型的差異，也不代表任何評等。</p>
      <p class="hub-disclaimer">本頁面提供之客觀排行與指標統計僅供研究參考，非屬投顧法之推薦買賣建議，使用者應獨立審慎評估風險。</p>
    </section>
  </div>
</template>

<style scoped>
/* 卡片：手機一欄，夠寬時兩欄以上；同一列的卡片等高，「看前 50 檔」貼在卡片底 */
.rank-index__cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 22rem), 1fr));
  gap: 16px;
  margin: 16px 0 32px;
}

.rank-card {
  display: flex;
  flex-direction: column;
  background: var(--app-card-bg);
  border: 1px solid var(--app-surface-border);
  border-radius: 12px;
  overflow: hidden;
}

.rank-card__head {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 16px 0;
}

.rank-card__title {
  margin: 0;
  font-size: 1.25rem;
  line-height: 1.4;
}

.rank-card__group {
  display: block;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--el-text-color-secondary);
}

.rank-card__panel {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.rank-card__caption {
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 4px 8px;
  padding: 12px 16px;
  color: var(--el-text-color-secondary);

  strong {
    color: var(--el-text-color-primary);
  }
}

.rank-card__more {
  margin-top: auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 48px;
  padding: 0 16px;
  border-top: 1px solid var(--app-divider);
  color: var(--el-color-primary-dark-2);
  font-weight: 600;
  text-decoration: none;
}

.rank-card__more:hover,
.rank-card__more:focus-visible {
  text-decoration: underline;
  text-underline-offset: 3px;
}
</style>
