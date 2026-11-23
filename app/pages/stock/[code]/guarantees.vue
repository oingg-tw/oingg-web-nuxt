<script setup lang="ts">
import type { StockSeriesResponse } from '#shared/types/stock-series'
import type { EndorsementsGuarantees, LoansToOthers, RelatedPartyTransactions } from '~/utils/guarantees'

// 背書保證與資金貸與（2026-11-23，數據中台第 4 項；設計 https://claude.ai/artifact/BffXAybhLkibJSNAcRTDkz 的 4，使用者 11-22「按照建議
// 執行」）：三段——替別人背書保證多少（兩條占淨值比的圖＋最新一期的明細）、借錢給別人多少、跟關係人交易有多大。占淨值比只算合併報表以外
// 的對象，表格照列全部、標出集團內外。明細先列 10 筆（集團外在前），其餘按一下展開。金融保險業不適用：說一句、不收錄。金額千元
const route = useRoute()
const code = computed(() => String(route.params.code))

const TOPIC = '背書保證與資金貸與'
const SHOWN = 10

const { stock, profile, stockShortName, stockPending, summary } = useStockDetailSummary(code)
// 四份一起抓，都經伺服器快取一天；等到了才換頁，資料晚到不會把版面往下推
const note = <T>(path: string) => useFetch<T>(() => `/api/cached/stocks/${code.value}/${path}`, { key: () => `stock-${path}-${code.value}`, watch: [code] })
const [guaranteesFetch, loansFetch, relatedFetch, { data: series }] = await Promise.all([
  note<EndorsementsGuarantees>('endorsements-guarantees'),
  note<LoansToOthers>('loans-to-others'),
  note<RelatedPartyTransactions>('related-party-transactions'),
  useFetch<StockSeriesResponse>(() => `/api/stock/${code.value}/series`, { query: { page: 'guarantees' }, key: () => `stock-series-guarantees-${code.value}`, watch: [code] })
])
const guarantees = guaranteesFetch.data
const loans = loansFetch.data
const related = relatedFetch.data
// 404（不在名單）是沒有資料，不是讀不到：讀不到時交給全站的讀取失敗提示，畫面不說「目前沒有」
const failure = computed(() => [guaranteesFetch, loansFetch, relatedFetch].map(fetched => fetched.error.value).find(error => error && error.statusCode !== 404) ?? null)
watchLoadFailure(() => `stock-guarantees:${code.value}`, () => failure.value, () => Promise.all([guaranteesFetch.refresh(), loansFetch.refresh(), relatedFetch.refresh()]))

const money = (thousand: number) => formatMoney(thousand * 1000)
const amount = (thousand: number | null) => (thousand === null ? '－' : money(thousand))
const entries = computed(() => series.value?.groups.Q_GUARANTEES_32?.entries ?? [])
// 金融保險業（類股 17）：三個比率都是 not_applicable_industry
const financial = computed(() => profile.value?.sectorCode === '17')

const guaranteeText = computed(() => (guarantees.value ? guaranteeAnswer(guarantees.value, money) : null))
const loanText = computed(() => (loans.value ? loanAnswer(loans.value, money) : null))
// 關係人交易的兩個比率讀指標的同一期（端點與指標都是最新一期有資產負債表的季）
const relatedText = computed(() => {
  const value = related.value
  if (!value) return null
  const entry = entries.value.find(item => item.fiscalYear === value.fiscalYear && item.fiscalQuarter === value.fiscalQuarter)
  return relatedPartyAnswer(value, entry?.values.relatedPartySalesToRevenue?.value ?? null, entry?.values.relatedPartyPurchasesToCostOfRevenue?.value ?? null)
})
const hasRows = computed(() => !!(guarantees.value?.rows.length || loans.value?.rows.length || related.value?.rows.length))
const emptyAnswer = computed(() => (financial.value
  ? `${stockShortName.value}屬金融保險業，背書保證、資金貸與與關係人交易的比率不適用。`
  : `目前沒有${stockShortName.value}的背書保證與資金貸與資料。`))

const expanded = reactive({ guarantees: false, loans: false })
const guaranteeRows = computed(() => exposureOrder(guarantees.value?.rows ?? []))
const loanRows = computed(() => exposureOrder(loans.value?.rows ?? []))
const externalCount = (rows: { intraGroup: boolean | null }[]) => rows.filter(row => row.intraGroup !== true).length
const severalEndorsers = computed(() => hasSeveral(guaranteeRows.value.map(row => row.endorser)))
const severalLenders = computed(() => hasSeveral(loanRows.value.map(row => row.lender)))
const relatedColumns = computed(() => (related.value ? relatedPartyColumns(related.value) : null))

const description = computed(() => clampDescription(guaranteeText.value && !financial.value
  ? `${stockShortName.value}（${code.value}）的背書保證與資金貸與：${guaranteeText.value}資金貸與、關係人交易的明細，資料來自財報附註。`
  : emptyAnswer.value))
const { breadcrumbs } = useStockPageSeo({
  code,
  shortName: stockShortName,
  topic: TOPIC,
  titleKeywords: '背書保證、資金貸與與關係人交易',
  pathSuffix: '/guarantees',
  stock,
  summary,
  description,
  sectorCode: computed(() => profile.value?.sectorCode ?? null),
  noindex: computed(() => financial.value || !hasRows.value)
})

const footer = computed(() => ({
  sources: ['公開資訊觀測站：財務報告附註（為他人背書保證、資金貸與他人、關係人交易）'],
  links: [
    { to: `/stock/${code.value}/investments`, label: '轉投資' },
    { to: `/stock/${code.value}/solvency`, label: '償債能力比率' },
    { to: `/stock/${code.value}/balance-sheet`, label: `${stockShortName.value} ${code.value} 最新一期的資產負債表` }
  ]
}))
const GUIDE = [
  '背書保證是公司替別人的借款或履約作擔保，對方還不出錢時要代為償還；資金貸與是公司把錢借給別人。兩種都要在財報附註逐筆揭露，金額是期末餘額。',
  '占淨值比只算合併報表以外的對象：替子公司背書、借錢給子公司，子公司的負債與資產已經在合併報表裡，所以不算；表格照列全部，標出集團內外。集團內外是比對同一份財報的合併個體與被投資公司名單判斷的，判不出的算在集團外。分母是歸屬母公司權益。',
  '資金貸與的期末餘額是董事會核准的額度，實際動支可能比較少，表格兩欄都列。背書保證的兩種限額是每家背書者自己訂的。',
  '關係人交易是跟關聯企業、合資與其他關係人的買賣；合併報表已經扣掉集團內互相買賣的部分。比率是單季的，第 4 季用全年減前三季推出來，年報只揭露全年，所以第 4 季的表格列全年。進貨與營業成本認列的時點不同，營收很小的公司會超過 100%。',
  '明細只列最新一期。附註沒有列出時比率算 0：申報寫「無」與沒有放附表分不出來。'
]
</script>

<template>
  <StockPageShell
    class="stock-guarantees-page"
    :code="code"
    :stock="stock"
    :pending="stockPending"
    :short-name="stockShortName"
    :topic="TOPIC"
    :breadcrumbs="breadcrumbs"
    :footer="footer"
  >
    <template v-if="!financial && guaranteeText && guarantees">
      <StockQuestionSection id="stock-guarantees" :question="`${stockShortName}（${code}）替別人背書保證多少？`" :answer="guaranteeText">
        <StockRatioLinesChart page="guarantees" :entries="entries" />
        <template v-if="guaranteeRows.length">
          <SharedTable :label="`${stockShortName}${notePeriodLabel(guarantees)}的背書保證`" class="stock-guarantees-page__table">
            <thead>
              <tr>
                <th scope="col">背書保證對象</th>
                <th v-if="severalEndorsers" scope="col">背書者</th>
                <th scope="col">集團內外</th>
                <th scope="col">關係</th>
                <th scope="col" class="seo-table__num">期末餘額</th>
                <th scope="col" class="seo-table__num">占淨值</th>
                <th scope="col" class="seo-table__num">限額（單一對象／總額）</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, index) in expanded.guarantees ? guaranteeRows : guaranteeRows.slice(0, SHOWN)" :key="index">
                <th scope="row" class="stock-guarantees-page__name">{{ row.counterparty ?? '－' }}</th>
                <td v-if="severalEndorsers" class="stock-guarantees-page__name">{{ row.endorser ?? '－' }}</td>
                <td>{{ groupText(row.intraGroup) }}</td>
                <td>{{ relationshipText(row) }}</td>
                <td class="seo-table__num">{{ amount(row.endingBalance) }}</td>
                <td class="seo-table__num">{{ percentText(row.endingBalanceToEquity) }}</td>
                <td class="seo-table__num">{{ guaranteeLimitText(row, money) }}</td>
              </tr>
              <tr class="is-latest">
                <th scope="row">集團外 {{ externalCount(guaranteeRows) }} 筆合計</th>
                <td :colspan="severalEndorsers ? 3 : 2" />
                <td class="seo-table__num">{{ amount(guarantees.totals.externalEndingBalance) }}</td>
                <td class="seo-table__num">{{ percentText(guarantees.totals.externalEndingBalanceToEquity) }}</td>
                <td />
              </tr>
              <tr class="is-latest">
                <th scope="row">全部 {{ guaranteeRows.length }} 筆合計</th>
                <td :colspan="severalEndorsers ? 3 : 2" />
                <td class="seo-table__num">{{ amount(guarantees.totals.endingBalance) }}</td>
                <td class="seo-table__num">{{ percentText(guarantees.totals.endingBalanceToEquity) }}</td>
                <td />
              </tr>
            </tbody>
          </SharedTable>
          <el-button v-if="guaranteeRows.length > SHOWN" text type="primary" class="stock-guarantees-page__more" :aria-expanded="expanded.guarantees" @click="expanded.guarantees = !expanded.guarantees">
            {{ expanded.guarantees ? '收起' : `顯示其餘 ${guaranteeRows.length - SHOWN} 筆` }}
          </el-button>
        </template>
      </StockQuestionSection>
      <StockQuestionSection v-if="loanText && loans" id="stock-guarantees-loans" :question="`${stockShortName}借錢給別人多少？`" :answer="loanText">
        <template v-if="loanRows.length">
          <SharedTable :label="`${stockShortName}${notePeriodLabel(loans)}的資金貸與`" class="stock-guarantees-page__table">
            <thead>
              <tr>
                <th scope="col">資金貸與對象</th>
                <th v-if="severalLenders" scope="col">貸出資金的公司</th>
                <th scope="col">集團內外</th>
                <th scope="col">關係人</th>
                <th scope="col">性質</th>
                <th scope="col" class="seo-table__num">期末餘額</th>
                <th scope="col" class="seo-table__num">實際動支</th>
                <th scope="col" class="seo-table__num">利率</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, index) in expanded.loans ? loanRows : loanRows.slice(0, SHOWN)" :key="index">
                <th scope="row" class="stock-guarantees-page__name">{{ row.counterparty ?? '－' }}</th>
                <td v-if="severalLenders" class="stock-guarantees-page__name">{{ row.lender ?? '－' }}</td>
                <td>{{ groupText(row.intraGroup) }}</td>
                <td>{{ row.isRelatedParty === null ? '－' : row.isRelatedParty ? '是' : '否' }}</td>
                <td>{{ natureText(row) }}</td>
                <td class="seo-table__num">{{ amount(row.endingBalance) }}</td>
                <td class="seo-table__num">{{ amount(row.actualAmountProvided) }}</td>
                <td class="seo-table__num">{{ interestRateText(row) }}</td>
              </tr>
              <tr class="is-latest">
                <th scope="row">集團外 {{ externalCount(loanRows) }} 筆合計</th>
                <td :colspan="severalLenders ? 4 : 3" />
                <td class="seo-table__num">{{ amount(loans.totals.externalEndingBalance) }}</td>
                <td colspan="2" />
              </tr>
              <tr class="is-latest">
                <th scope="row">全部 {{ loanRows.length }} 筆合計</th>
                <td :colspan="severalLenders ? 4 : 3" />
                <td class="seo-table__num">{{ amount(loans.totals.endingBalance) }}</td>
                <td colspan="2" />
              </tr>
            </tbody>
          </SharedTable>
          <el-button v-if="loanRows.length > SHOWN" text type="primary" class="stock-guarantees-page__more" :aria-expanded="expanded.loans" @click="expanded.loans = !expanded.loans">
            {{ expanded.loans ? '收起' : `顯示其餘 ${loanRows.length - SHOWN} 筆` }}
          </el-button>
        </template>
      </StockQuestionSection>
      <StockQuestionSection v-if="relatedText && related" id="stock-guarantees-related" :question="`${stockShortName}跟關係人交易有多大？`" :answer="relatedText">
        <SharedTable v-if="related.rows.length && relatedColumns" :label="`${stockShortName}${notePeriodLabel(related)}的關係人交易`" class="stock-guarantees-page__table">
          <thead>
            <tr>
              <th scope="col">科目</th>
              <th scope="col">對象類別</th>
              <th v-for="label in relatedColumns.labels" :key="label" scope="col" class="seo-table__num">{{ label }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, index) in related.rows" :key="index">
              <th scope="row">{{ row.account ?? '－' }}</th>
              <td>{{ row.category ?? '－' }}</td>
              <td class="seo-table__num">{{ amount(relatedColumns.ytd ? row.amountYtd : row.amountQuarter) }}</td>
              <td class="seo-table__num">{{ amount(relatedColumns.ytd ? row.amountPriorYearYtd : row.amountPriorYearQuarter) }}</td>
            </tr>
          </tbody>
        </SharedTable>
      </StockQuestionSection>
    </template>
    <StockQuestionSection v-else-if="financial || !failure" id="stock-guarantees" :question="`${stockShortName}（${code}）替別人背書保證多少？`" :answer="emptyAnswer" />
    <template #guide>
      <StockMetricGuide id-prefix="stock-guarantees" :topic="TOPIC" :definition="GUIDE" />
    </template>
  </StockPageShell>
</template>

<style scoped>
/* 對象、背書者的名稱可能很長（CTCI Engineering ＆ Construction Sdn. Bhd.）：折行，第一欄固定在左邊時不會占掉手機大半個寬度 */
.stock-guarantees-page__name {
  min-width: 8em;
  max-width: 14em;
  white-space: normal;
}

@media not all and (min-width: 768px) {
  .stock-guarantees-page__name {
    max-width: 9em;
  }
}

/* 「顯示其餘」貼著表格的卡片，靠左（段落是 16px 間距的直欄，按鈕預設會撐滿整列） */
.stock-guarantees-page__more {
  align-self: flex-start;
  margin-top: -8px;
}
</style>
