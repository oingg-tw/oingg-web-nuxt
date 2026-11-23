<script setup lang="ts">
import type { StockSeriesResponse } from '#shared/types/stock-series'
import type { Investees, MainlandChinaInvestments } from '~/utils/investments'

// 轉投資（2026-11-23，數據中台第 5 項；設計 https://claude.ai/artifact/BffXAybhLkibJSNAcRTDkz 的 5）：兩段——投資大陸多少（帳面占淨值比
// 的圖＋最新一期的大陸被投資公司）、子公司與轉投資有哪些（使用者 11-23 選「要分」：分出子公司與關聯企業）。兩張明細都先列帳面最大的 10 家，
// 其餘按一下展開。銀行與金控也有這兩張附註，照常顯示。金額千元
const route = useRoute()
const code = computed(() => String(route.params.code))

const TOPIC = '轉投資'
const SHOWN = 10

const { stock, profile, stockShortName, stockPending, summary } = useStockDetailSummary(code)
// 三份一起抓，都經伺服器快取一天；等到了才換頁，資料晚到不會把版面往下推
const note = <T>(path: string) => useFetch<T>(() => `/api/cached/stocks/${code.value}/${path}`, { key: () => `stock-${path}-${code.value}`, watch: [code] })
const [mainlandFetch, investeesFetch, { data: series }] = await Promise.all([
  note<MainlandChinaInvestments>('mainland-china-investments'),
  note<Investees>('investees'),
  useFetch<StockSeriesResponse>(() => `/api/stock/${code.value}/series`, { query: { page: 'investments' }, key: () => `stock-series-investments-${code.value}`, watch: [code] })
])
const mainland = mainlandFetch.data
const investees = investeesFetch.data
// 404（不在名單）是沒有資料，不是讀不到：讀不到時交給全站的讀取失敗提示，畫面不說「目前沒有」
const failure = computed(() => [mainlandFetch, investeesFetch].map(fetched => fetched.error.value).find(error => error && error.statusCode !== 404) ?? null)
watchLoadFailure(() => `stock-investments:${code.value}`, () => failure.value, () => Promise.all([mainlandFetch.refresh(), investeesFetch.refresh()]))

const money = (thousand: number) => formatMoney(thousand * 1000)
const amount = (thousand: number | null) => (thousand === null ? '－' : money(thousand))
const entries = computed(() => series.value?.groups.Q_MAINLAND_40?.entries ?? [])

const mainlandText = computed(() => (mainland.value ? mainlandAnswer(mainland.value, money) : null))
const investeesText = computed(() => (investees.value ? investeesAnswer(investees.value, money) : null))
const hasRows = computed(() => !!(mainland.value?.investees.length || investees.value?.rows.length))
const emptyAnswer = computed(() => `目前沒有${stockShortName.value}的轉投資資料。`)

const expanded = reactive({ mainland: false, investees: false })
const severalInvestors = computed(() => hasSeveral((investees.value?.rows ?? []).map(row => row.investor)))

const description = computed(() => clampDescription(mainlandText.value
  ? `${stockShortName.value}（${code.value}）的轉投資：${mainlandText.value}子公司、關聯企業與大陸被投資公司的明細，資料來自財報附註。`
  : emptyAnswer.value))
const { breadcrumbs } = useStockPageSeo({
  code,
  shortName: stockShortName,
  topic: TOPIC,
  titleKeywords: '轉投資：子公司、關聯企業與大陸投資',
  pathSuffix: '/investments',
  stock,
  summary,
  description,
  sectorCode: computed(() => profile.value?.sectorCode ?? null),
  noindex: computed(() => !hasRows.value)
})

const footer = computed(() => ({
  sources: ['公開資訊觀測站：財務報告附註（大陸投資資訊、被投資公司資訊）'],
  links: [
    { to: `/stock/${code.value}/guarantees`, label: '背書保證與資金貸與' },
    { to: `/stock/${code.value}/non-current-asset-composition`, label: '非流動資產組成' },
    { to: `/stock/${code.value}/balance-sheet`, label: `${stockShortName.value} ${code.value} 最新一期的資產負債表` }
  ]
}))
const GUIDE = [
  '大陸投資帳面是投資方帳上對大陸被投資公司的投資金額合計，占淨值比的分母是歸屬母公司權益；持股是層層相乘的實質持股。累計從台灣匯出是當初匯出去的本金，經濟部投審會核准的額度用掉多少看這個數字；帳面含後來賺的、賠的。KY 公司不是台灣公司，沒有匯出的限額。',
  '被投資公司是財報附註列的轉投資，母公司與子公司各自的投資都列，同一家被兩家持有時出現兩列，家數同名算一家。子公司是集團持股合計過半或列在合併個體表的公司，其餘是關聯企業等；判不出的寫無法判斷。',
  '明細只列最新一期。附註沒有列出時大陸投資的比率算 0。'
]
</script>

<template>
  <StockPageShell
    class="stock-investments-page"
    :code="code"
    :stock="stock"
    :pending="stockPending"
    :short-name="stockShortName"
    :topic="TOPIC"
    :breadcrumbs="breadcrumbs"
    :footer="footer"
  >
    <template v-if="mainlandText || investeesText">
      <StockQuestionSection v-if="mainlandText && mainland" id="stock-investments" :question="`${stockShortName}（${code}）投資大陸多少？`" :answer="mainlandText">
        <StockRatioLinesChart page="investments" :entries="entries" />
        <template v-if="mainland.investees.length">
          <SharedTable :label="`${stockShortName}${notePeriodLabel(mainland)}的大陸被投資公司`">
            <thead>
              <tr>
                <th scope="col">大陸被投資公司</th>
                <th scope="col">主要業務</th>
                <th scope="col" class="seo-table__num">持股</th>
                <th scope="col" class="seo-table__num">期末帳面</th>
                <th scope="col" class="seo-table__num">本期投資損益</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, index) in expanded.mainland ? mainland.investees : mainland.investees.slice(0, SHOWN)" :key="index">
                <th scope="row" class="stock-investments-page__name">{{ row.investee ?? '－' }}</th>
                <td class="stock-investments-page__text">{{ row.mainBusinesses ?? '－' }}</td>
                <td class="seo-table__num">{{ percentText(row.ownershipPct) }}</td>
                <td class="seo-table__num">{{ amount(row.bookValue) }}</td>
                <td class="seo-table__num">{{ amount(row.investmentIncomeRecognized) }}</td>
              </tr>
            </tbody>
          </SharedTable>
          <el-button v-if="mainland.investees.length > SHOWN" text type="primary" class="stock-investments-page__more" :aria-expanded="expanded.mainland" @click="expanded.mainland = !expanded.mainland">
            {{ expanded.mainland ? '收起' : `顯示其餘 ${mainland.investees.length - SHOWN} 家` }}
          </el-button>
        </template>
      </StockQuestionSection>
      <StockQuestionSection v-if="investeesText && investees" id="stock-investments-investees" :question="`${stockShortName}的子公司與轉投資有哪些？`" :answer="investeesText">
        <template v-if="investees.rows.length">
          <SharedTable :label="`${stockShortName}${notePeriodLabel(investees)}的被投資公司`">
            <thead>
              <tr>
                <th scope="col">被投資公司</th>
                <th v-if="severalInvestors" scope="col">投資公司</th>
                <th scope="col">類別</th>
                <th scope="col">所在地</th>
                <th scope="col">主要業務</th>
                <th scope="col" class="seo-table__num">持股</th>
                <th scope="col" class="seo-table__num">期末帳面</th>
                <th scope="col" class="seo-table__num">本期認列損益</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, index) in expanded.investees ? investees.rows : investees.rows.slice(0, SHOWN)" :key="index">
                <th scope="row" class="stock-investments-page__name">{{ row.investee ?? '－' }}</th>
                <td v-if="severalInvestors" class="stock-investments-page__name">{{ row.investor ?? '－' }}</td>
                <td>{{ investeeKindText(row.intraGroup) }}</td>
                <td>{{ row.location ?? '－' }}</td>
                <td class="stock-investments-page__text">{{ row.mainBusinesses ?? '－' }}</td>
                <td class="seo-table__num">{{ percentText(row.ownershipPct) }}</td>
                <td class="seo-table__num">{{ amount(row.bookValue) }}</td>
                <td class="seo-table__num">{{ amount(row.investmentIncomeRecognized) }}</td>
              </tr>
            </tbody>
          </SharedTable>
          <el-button v-if="investees.rows.length > SHOWN" text type="primary" class="stock-investments-page__more" :aria-expanded="expanded.investees" @click="expanded.investees = !expanded.investees">
            {{ expanded.investees ? '收起' : `顯示其餘 ${investees.rows.length - SHOWN} 筆` }}
          </el-button>
        </template>
      </StockQuestionSection>
    </template>
    <StockQuestionSection v-else-if="!failure" id="stock-investments" :question="`${stockShortName}（${code}）投資大陸多少？`" :answer="emptyAnswer" />
    <template #guide>
      <StockMetricGuide id-prefix="stock-investments" :topic="TOPIC" :definition="GUIDE" />
    </template>
  </StockPageShell>
</template>

<style scoped>
/* 公司名稱可能很長：折行，第一欄固定在左邊時不會占掉手機大半個寬度 */
.stock-investments-page__name {
  min-width: 8em;
  max-width: 14em;
  white-space: normal;
}

/* 主要業務最長 140 字（9933）：折行，不讓表格無限變寬 */
.stock-investments-page__text {
  min-width: 10em;
  max-width: 20em;
  white-space: normal;
}

@media not all and (min-width: 768px) {
  .stock-investments-page__name {
    max-width: 9em;
  }
}

/* 「顯示其餘」貼著表格的卡片，靠左（段落是 16px 間距的直欄，按鈕預設會撐滿整列） */
.stock-investments-page__more {
  align-self: flex-start;
  margin-top: -8px;
}
</style>
