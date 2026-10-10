<script setup lang="ts">
import type { RankingPageData } from '#shared/types/hub'
import type { MetricCatalog } from '~/composables/screener/useFilterSchema'
// /rank/{slug} — one objective screener field, the market's top 50 by that field alone
// (2026-09-19, the SEO build; variant A of the ranking pages the user chose). Data from
// /api/hub/rank/:slug（GET /screener/ranking, cached 6h）. The compliance disclaimer sits directly
// above the table, not in a footer; wording is statistical throughout; the 50 rows are links to
// the stock pages（the hub's internal-link job）. Unknown slug → 404.
//
// No sector-scoped variants: bff-ts rejects sectorCodes on the EOD valuation fields by design
// (2026-09-19), and a ranking is one URL per field so it can't become a paginated or filtered
// URL family.
const route = useRoute()
const slug = String(route.params.slug)
const definition = findRankPage(slug)
if (!definition) throw createError({ statusCode: 404, statusMessage: '找不到這個排行', fatal: true })

const { data, error } = await useFetch<RankingPageData>(`/api/hub/rank/${slug}`, { key: `hub-rank-${slug}` })
if (error.value?.statusCode === 404) throw createError({ statusCode: 404, statusMessage: '找不到這個排行', fatal: true })
if (error.value || !data.value) throw createError({ statusCode: 503, statusMessage: '排行資料暫時無法取得', fatal: true })
const { data: catalog } = await useFetch<MetricCatalog>('/api/hub/metrics', { key: 'hub-metrics', default: () => ({ categories: [] }) })

const rows = computed(() => data.value?.rows ?? [])
const asOf = computed(() => data.value?.asOf ?? null)
const orderWord = definition.direction === 'desc' ? '由高到低' : '由低到高'
const label = definition.label
const metric = computed(() => findMetricInSchema(catalog.value?.categories ?? [], definition.metricCode)?.metric ?? null)
const metricPageIndexable = isIndexableMetricSlug(metricSlug(definition.metricCode))

// 「前 50 檔」原本是寫死的字面值，出現在標題、description、h1、答句與 caption 五處。
// 2026-10-01 改成實際列數，因為 growthBaseFloor 會讓一頁的列數少於 50（營收成長年增率實測剩 29 列）。
// 其餘六頁仍然是 50，字面上一個字都沒變。
//
// 承諾的數字跟表格列數不一致是最容易被讀者抓到的那種錯：他們會數。
const shownCount = computed(() => rows.value.length)
// 少於 50 列要說出原因，否則「取前 29 檔」看起來像隨便挑的。只有設了基期門檻的頁面才有這句。
const floorNote = definition.growthBaseFloor
  ? '已排除基期數值過小的公司：基期接近零時，年增率會被放大成不具意義的數字。'
  : ''
// 篩過族群的頁面要自己說母體（見 RANK_PAGES 的 `population`）。沒有這一句，答句的「全市場有 X
// 資料的公司」就是錯的。
const populationNote = definition.screener?.population ?? ''
// 篩過族群時連那句開頭也要改：那些頁面不是「全市場有資料的公司」。
const universeText = definition.screener ? '符合條件的公司' : `全市場有${label}資料的公司`

// 市值 comes back in 元（61,850,000,000,000 for 2330）— shown in 億元 so the numbers stay readable
// in a sentence; every other field keeps its catalog unit.
const isMarketCap = definition.slug === 'market-cap'
const unit = computed(() => (isMarketCap ? '億元' : (data.value?.unit ?? '')))

function valueText(value: number | null): string {
  if (value === null) return '－'
  if (isMarketCap) return groupThousands((value / 1e8).toFixed(0))
  return Number.isInteger(value) ? String(value) : value.toFixed(2)
}

// Facts a reader should hold next to this particular field — descriptive, never evaluative.
const FIELD_NOTES: Record<string, string> = {
  // 「尚未公布股利的公司不在列」2026-09-30 拿掉：證交所從 2026-08-28 起把不配息的公司從 0.00 改成
  // 空白，上游把空白讀成 0，所以那些公司現在有值（實測全市場 516 家殖利率恰為 0）。這是由高到低的
  // 排行，它們落在最後面、不會出現在榜上，但「不在列」這句話已經不成立。
  'dividend-yield': '殖利率為交易所公布之每日數值，以最近年度現金股利除以當日收盤價；沒有配息的公司計為 0%。',
  'pe-ratio-low': '本益比低於 1 倍的公司，其近四季每股盈餘多含一次性損益（處分資產、業外收入）；虧損公司無本益比，不在列。',
  'pb-ratio-low': '股價淨值比以最近一期每股淨值計算；淨值中含大量無形資產或金融資產的公司，帳面淨值與市價的關係與製造業不同。',
  roe: '近四季 ROE 以最近四季稅後淨利除以股東權益；股本較小或負債較高的公司，同樣的獲利會得到較高的數值。',
  eps: '近四季 EPS 為最近四季每股盈餘合計，未經一次性損益調整；面額 10 元以外的公司可比性不同。',
  'market-cap': '市值為收盤價乘以發行股數，隨每日股價變動；以資料日期當天為準。',
  'revenue-growth': '單季營收年增率與去年同季比較，季節性明顯或有併購、處分事業的公司，單季數字與長期趨勢可能不同。'
}

const topThree = computed(() => rows.value.slice(0, 3).map(row => `第 ${row.rank} 名 ${row.name}（${row.symbol}）${valueText(row.value)}${unit.value === '%' ? '%' : unit.value ? ` ${unit.value}` : ''}`).join('、'))

const { breadcrumbs } = useHubPageSeo({
  title: () => `台股${label}排行：${orderWord}前 ${shownCount.value} 檔`,
  description: () => clampDescription(`${asOf.value ? `${asOf.value} ` : ''}台股${label}${orderWord}前 ${shownCount.value} 檔：${topThree.value}。名次為數值排序位置，附資料日期與指標說明。`),
  path: rankPath(slug),
  breadcrumbs: [
    { label: '首頁', to: '/' },
    { label: '排行', to: '/rank' },
    { label: `${label}排行`, to: rankPath(slug) }
  ]
})

const otherRanks = RANK_PAGES.filter(page => page.slug !== slug)
</script>

<template>
  <div class="app-page rank-page">
    <h1 class="app-page__title rank-page__title">台股{{ label }}排行：{{ orderWord }}前 {{ shownCount }} 檔<template v-if="asOf">（{{ asOf }}）</template></h1>
    <StockBreadcrumb :items="breadcrumbs" />

    <section class="stock-page-section" aria-labelledby="rank-table-heading">
      <h2 id="rank-table-heading" class="stock-page-section__title">{{ label }}{{ orderWord }}的前 {{ shownCount }} 檔是哪些？</h2>
      <p class="hub-answer">
{{ universeText }}依數值{{ orderWord }}排序，取前 {{ shownCount }} 檔<template v-if="asOf">；資料日期 {{ asOf }}</template>。{{ topThree }}。<template v-if="populationNote">{{ populationNote }}</template><template v-if="floorNote">{{ floorNote }}</template>
      </p>
      <p class="hub-disclaimer">本頁面提供之客觀排行與指標統計僅供研究參考，非屬投顧法之推薦買賣建議，使用者應獨立審慎評估風險。</p>
      <SharedTableScroll v-if="rows.length" :label="`${label}排行`">
        <table class="seo-table" data-ssr-table>
          <caption class="visually-hidden">台股{{ label }}{{ orderWord }}前 {{ shownCount }} 檔</caption>
          <thead>
            <tr>
              <th scope="col" class="seo-table__num">名次</th>
              <th scope="col">代號</th>
              <th scope="col">名稱</th>
              <th scope="col" class="seo-table__num">{{ label }}<template v-if="unit">（{{ unit }}）</template></th>
              <th scope="col">資料日期</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.symbol">
              <td class="seo-table__num">{{ row.rank }}</td>
              <th scope="row"><NuxtLink :to="`/stock/${row.symbol}`" class="seo-table__link">{{ row.symbol }}</NuxtLink></th>
              <td>{{ row.name }}</td>
              <td class="seo-table__num">{{ valueText(row.value) }}</td>
              <td>{{ row.knowledgeDate ?? '－' }}</td>
            </tr>
          </tbody>
        </table>
      </SharedTableScroll>
      <p v-else class="hub-answer">目前沒有這個指標的排行資料。</p>
    </section>

    <section class="stock-page-section" aria-labelledby="rank-metric-heading">
      <h2 id="rank-metric-heading" class="stock-page-section__title">{{ label }}是什麼？怎麼算？</h2>
      <p class="hub-answer">
        <template v-if="metric">
          本站目錄中的指標名稱為「{{ metricDisplayName(metric) }}」<template v-if="metric.nameEn">（{{ metric.nameEn }}）</template>，單位{{ metric.unit }}<template v-if="metric.sources?.length">，資料來源：{{ metric.sources.join('、') }}</template>。
          <template v-if="metric.description">{{ metric.description }}</template>
        </template>
        <template v-else>{{ FIELD_NOTES[slug] }}</template>
      </p>
      <p class="hub-answer">
        <NuxtLink v-if="metricPageIndexable" :to="metricPath(definition.metricCode)" class="hub-inline-link">看{{ label }}的指標說明</NuxtLink>
        <NuxtLink v-else to="/metrics" class="hub-inline-link">看本站所有指標的定義與公式</NuxtLink>
      </p>
    </section>

    <section class="stock-page-section" aria-labelledby="rank-notes-heading">
      <h2 id="rank-notes-heading" class="stock-page-section__title">看這份排行要注意什麼？</h2>
      <p class="hub-answer">名次只反映資料日期當天的數值排序，不含任何評等；同一數值並列時依代號排序；不同產業的{{ label }}水準本來就不同，跨產業比較時請一併看該公司所屬類股的中位數。</p>
      <p class="hub-answer">{{ FIELD_NOTES[slug] }}</p>
      <!-- 型錄自己的 limitations／misreadings（2026-09-28）。這一段本來只有上面兩句前端文案，而上游
           2026-09-28 補的敘述裡有一件我們自己寫不出來的事：同一個「本益比」有三支指標（交易所公布值／
           除權當天就換算／依財報公告日凍結），在除權息與減資前後可能差很多——實測 9904 寶成交易所 5.29
           vs 即時 2.76，差 92%——而且那不是算錯。讀者拿別的網站對照時就是會撞到這件事，所以用上游自己
           的字寫在這裡，不另外造句。 -->
      <p v-if="metric?.limitations" class="hub-answer">{{ metric.limitations }}</p>
      <p v-if="metric?.misreadings" class="hub-answer">{{ metric.misreadings }}</p>
    </section>

    <section class="stock-page-section" aria-labelledby="rank-others-heading">
      <h2 id="rank-others-heading" class="stock-page-section__title">其他排行</h2>
      <nav aria-label="其他排行">
        <ul class="hub-chip-list">
          <li v-for="other in otherRanks" :key="other.slug">
            <NuxtLink :to="rankPath(other.slug)" class="hub-chip">{{ other.label }}排行</NuxtLink>
          </li>
        </ul>
      </nav>
      <p class="hub-answer"><NuxtLink to="/rank" class="hub-inline-link">回排行總覽</NuxtLink></p>
    </section>
  </div>
</template>

<style scoped>

</style>
