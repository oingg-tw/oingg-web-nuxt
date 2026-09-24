<script setup lang="ts">
import { clampDescription } from '~/utils/stock-digest'
import { factValue, joinClauses } from '~/utils/stock-answers'

// /stock/:code/dividend-source — 配息從哪來（2026-09-24,「sidebar 亮點與風險下面加一個…我這一頁要
// 放從現金殖利率倒推回營收的每個環節」, named「對 本質上是股息從哪來 找回來 然後改名成 配息從哪來」）.
//
// This URL existed before（64b6e38 merged it into /dividend and dropped its waterfall chart）and
// the 股息從哪裡來 section was deleted from /dividend earlier today. Neither removal was because
// the content was wrong — it was on a page whose subject was「殖利率是多少」, which made that page
// carry two subjects. Here it is the whole subject, and the chain reaches further in both
// directions than it ever did as a section.
//
// The chain is a chain of IDENTITIES, which is the only reason it can be published at all: every
// step is one filed figure times one filed rate, so nothing here predicts anything. Verified
// against live data before the page was written（2330 2026Q2: 每股營收 171.23 × 稅後淨利率 50.38%
// = EPS 86.27, and 86.27 × 盈餘發放率 23.76% = 每股股利 20.50, both to the cent）.
//
// Not a waterfall, not a Sankey — the same 高齡友善圖表選型規範 ruling that removed the original
// bridge chart: a flow diagram asks the reader to track width, direction and branching at once.
// One table, one row per step, each row naming the arithmetic that produced it.
const route = useRoute()
const code = computed(() => String(route.params.code))

const TOPIC = '配息從哪來'

const { stock, profile, stockShortName, stockPending, isFavorite, toggleFavorite } = useStockDetailSummary(code)
const { digest } = await useStockPageDigest(code, 'dividend-source', { shortName: stockShortName })

// Same key as useStockDetailSummary's own call → deduped, not a second request. Needed here for
// the two DATES that `stock` flattens away, and they are the difference between this page being
// right and being visibly wrong: the exchange computes 殖利率 on its own valuation date, while the
// summary card shows the latest close. Caught by arithmetic on the rendered page — 2330 showed
// 殖利率 0.89% beside 每股股利 20.50 元 and 股價 2500.00 元, which divide to 0.82%. The identity does
// hold; 0.89% is 20.50 ÷ that day's close（~2303 on 2026-09-18）. Printing the newest price next to
// a yield computed five days earlier asserted a division that does not work.
const { data: summary } = useStockSummary(code)
const yieldDate = computed(() => summary.value?.valuation?.tradeDate ?? null)
const priceDate = computed(() => summary.value?.price?.tradeDate ?? null)
const datesDiffer = computed(() => yieldDate.value !== null && priceDate.value !== null && yieldDate.value !== priceDate.value)

const revenuePerShare = computed(() => factValue(digest.value, 'revenuePerShare'))
const grossMargin = computed(() => factValue(digest.value, 'grossMargin'))
const operatingMargin = computed(() => factValue(digest.value, 'operatingMargin'))
const netProfitMargin = computed(() => factValue(digest.value, 'netProfitMargin'))
const eps = computed(() => factValue(digest.value, 'eps'))
const payoutRatio = computed(() => factValue(digest.value, 'dividendPayoutRatio'))
const dividendPerShare = computed(() => factValue(digest.value, 'dividendPerShare'))

const amount = (value: number | null | undefined): string => (value === null || value === undefined ? '－' : `${value.toFixed(2)} 元`)
const percent = (value: number | null | undefined): string => (value === null || value === undefined ? '－' : `${value.toFixed(2)}%`)

// One row per link of the chain, newest filing throughout. `from` states the arithmetic that
// produces this row's own number out of the row BELOW it — the table is read downwards, which is
// the 倒推 direction the page is about: start at the number a reader already has, end at revenue.
//
// `to` is the page that answers about that one step on its own. Every step has one today; a step
// that ever loses its page renders as plain text rather than pointing somewhere approximate.
interface ChainStep {
  label: string
  value: string
  from: string
  to?: string
}

const steps = computed<ChainStep[]>(() => [
  {
    label: '現金殖利率',
    value: percent(stock.value?.dividendYield),
    // The divisor is named by its DATE, not by the summary card's price — see the dates comment
    // above. Quoting a price here that the yield was not computed from is how this row first
    // shipped, and it made the row state a division that does not work.
    from: `每股股利 ${amount(dividendPerShare.value)} ÷ ${yieldDate.value === null ? '交易所當日收盤價' : `${yieldDate.value} 收盤價`}`,
    to: `/stock/${code.value}/dividend`
  },
  {
    label: '每股股利',
    value: amount(dividendPerShare.value),
    // A loss-making company can still pay: 6916 2026Q2 pays 0.28 元 on EPS -0.89 元, and the payout
    // ratio comes back null because its denominator is negative（analysis-ts's own
    // zero_or_negative_denominator）. Printing「EPS -0.89 × 盈餘發放率 －」would state a
    // multiplication the reader can see does not produce 0.28. The replacement is still a bare
    // fact — a negative denominator makes the ratio undefined, and a period that earned nothing
    // did not fund the payment — with no word about whether that is good or bad.
    from:
      eps.value !== null && eps.value <= 0
        ? `本期 EPS ${amount(eps.value)} 為負，盈餘發放率的分母不成立，這次配發不是由本期盈餘產生`
        : `EPS ${amount(eps.value)} × 盈餘發放率 ${percent(payoutRatio.value)}`,
    to: `/stock/${code.value}/dividend-payout-ratio`
  },
  {
    label: 'EPS（每股稅後淨利）',
    value: amount(eps.value),
    from: `每股營收 ${amount(revenuePerShare.value)} × 稅後淨利率 ${percent(netProfitMargin.value)}`,
    to: `/stock/${code.value}/eps`
  },
  {
    label: '稅後淨利率',
    value: percent(netProfitMargin.value),
    // 「業外損益與所得稅」is the one unquantified step in the chain, and as of 2026-09-24 it no
    // longer has to be: analysis-ts added nonOperatingIncomePerShare plus five sub-items
    //（interestIncome / otherIncome / otherGainsLosses / equityMethodIncome / financeCost — the
    // last a DEDUCTION, positive means cost）, Q and TTM, 元. It is left as prose here on purpose:
    // the backfill was still running（verified directly at :4000 — 1101 returns values, 2330 and
    // 2317 return no rows at all）, and naming a figure the most-read symbol cannot show is worse
    // than naming none.
    //
    // When wiring it, the trap analysis-ts flagged and I have not yet had to hit: on the low-
    // coverage items（預期信用減損 ~62%, 其他營業收益費損 ~5%, 權益法 ~41%）**null means zero, not
    // missing** — the company has no such line. Skipping them as gaps makes the sum fail on MOST
    // companies. Tolerance is ±0.005 per item, ~±0.05 over the chain; never test exact equality.
    from: `營業利益率 ${percent(operatingMargin.value)} 再減業外損益與所得稅`,
    to: `/stock/${code.value}/net-profit-margin`
  },
  {
    label: '營業利益率',
    value: percent(operatingMargin.value),
    from: `毛利率 ${percent(grossMargin.value)} 再減營業費用`,
    to: `/stock/${code.value}/operating-margin`
  },
  {
    label: '毛利率',
    value: percent(grossMargin.value),
    from: `每股營收 ${amount(revenuePerShare.value)} 減營業成本後占營收的比率`,
    to: `/stock/${code.value}/gross-margin`
  },
  {
    label: '每股營收',
    value: amount(revenuePerShare.value),
    from: '這條鏈的起點：近四季營收除以流通在外股數',
    to: `/stock/${code.value}/monthly-revenue`
  }
])

const hasChain = computed(() => revenuePerShare.value !== null && eps.value !== null)

// Facts only — each clause survives having its adjectives deleted, and no step is compared with a
// threshold, an industry figure or a previous period.
const chainAnswer = computed(() => {
  if (!hasChain.value) return null
  const clauses = [
    `${stockShortName.value}近四季每股營收 ${amount(revenuePerShare.value)}`,
    `稅後淨利率 ${percent(netProfitMargin.value)}`,
    `兩者相乘得到 EPS ${amount(eps.value)}`
  ]
  if (payoutRatio.value !== null) clauses.push(`再乘上盈餘發放率 ${percent(payoutRatio.value)}，得到每股股利 ${amount(dividendPerShare.value)}`)
  return joinClauses(clauses)
})

const cadenceAnswer = computed(() =>
  stock.value?.price === undefined
    ? '殖利率的分母是股價，每個交易日收盤後都會變；分子與上游每一步都來自財報，一季更新一次。'
    : `殖利率的分母是股價（${priceDate.value === null ? '最新收盤' : `${priceDate.value} 收盤`} ${amount(stock.value.price)}），每個交易日收盤後都會變；分子與上游每一步都來自財報，一季更新一次。`
)

const { breadcrumbs } = useStockPageSeo({
  code,
  shortName: stockShortName,
  topic: TOPIC,
  titleKeywords: '從營收一路推到現金殖利率',
  pathSuffix: '/dividend-source',
  stock,
  summary: computed(() => null),
  description: computed(() =>
    clampDescription(
      hasChain.value
        ? `${stockShortName.value}（${code.value}）的配息如何從營收算出來：每股營收、毛利率、營業利益率、稅後淨利率、EPS、盈餘發放率到每股股利，逐步列出每一個環節。`
        : `${stockShortName.value}（${code.value}）目前沒有足夠的財報資料可以逐步列出配息的來源。`
    )
  ),
  sectorCode: computed(() => profile.value?.industry ?? null)
})
</script>

<template>
  <div v-loading="stockPending" class="stock-dividend-source-page">
    <template v-if="stock">
      <StockSummaryCard :stock="stock" :is-favorite="isFavorite" :short-name="stockShortName" :topic="TOPIC" @toggle-favorite="toggleFavorite" />
      <StockPageNav :code="code" />
      <StockBreadcrumb :items="breadcrumbs" />

      <StockQuestionSection
        v-if="hasChain"
        id="stock-dividend-source-chain"
        :question="`${stockShortName}（${code}）配的息，是從哪一塊錢來的？`"
        :answer="chainAnswer"
      >
        <SharedTableScroll :label="`${stockShortName} ${code} 從營收到配息的每一個環節`">
          <table class="seo-table" data-ssr-table>
            <caption>{{ stockShortName }} {{ code }} 從現金殖利率往回推到營收（由下往上是財報的計算順序）</caption>
            <thead>
              <tr>
                <th scope="col">這一步</th>
                <th scope="col">這一檔的數字</th>
                <th scope="col">怎麼從下一列算出來</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="step in steps" :key="step.label">
                <th scope="row">
                  <NuxtLink v-if="step.to" :to="step.to">{{ step.label }}</NuxtLink>
                  <template v-else>{{ step.label }}</template>
                </th>
                <td>{{ step.value }}</td>
                <td>{{ step.from }}</td>
              </tr>
            </tbody>
          </table>
        </SharedTableScroll>
      </StockQuestionSection>

      <!-- Why the top row moves on a different clock from every row under it. This is the one thing
           the table above cannot show, because the table has no time axis at all. -->
      <StockQuestionSection id="stock-dividend-source-cadence" question="為什麼殖利率每天在動，上面那些數字卻不動？" :answer="cadenceAnswer">
        <el-card shadow="never" class="stock-dividend-source-page__card">
          <div class="stock-dividend-source-page__prose">
            <p>
              表格最上面一列每個交易日更新，其餘每一列都是財報數字。<strong>殖利率＝每股股利 ÷ 股價</strong>：分子一年調整一次，分母每個交易日收盤都會變，所以殖利率天天不同，不是因為公司的獲利天天在變。
            </p>
            <p>
              同一個算式反過來看也成立——股價下跌時殖利率會上升，此時分子沒有任何改變。要看配息本身的變化，看的是表格下方那幾列。
            </p>
            <p v-if="datesDiffer">
              兩個日期在本頁上也看得到：表格裡的殖利率以 <strong>{{ yieldDate }}</strong> 的收盤價計算，頁面最上方摘要卡的股價是 <strong>{{ priceDate }}</strong> 的收盤價 {{ amount(stock?.price) }}。日期不同時，殖利率不會等於用摘要卡那個股價直接相除的結果。
            </p>
            <p v-else>
              本站的殖利率取自交易所每日收盤後的資料，上游各列取自公開財報，兩者的資料截止日不同。
            </p>
          </div>
        </el-card>
      </StockQuestionSection>

      <!-- 股息從哪裡來 as it shipped 2026-09-18 and was A/B chosen by the user directly（直式算式、
           一張卡三個數字、說明移到算式後面、法定盈餘公積）. Restored unchanged: the request was
          「找回來」, not "rebuild". It answers a DIFFERENT question from the table above — that one
           walks the income statement, this one crosses to the cash-flow statement, where 帳上的獲利
           and 手上的現金 are not the same number. -->
      <StockQuestionSection id="stock-dividend-source-cash" question="帳上賺到的錢，公司真的有現金可以發嗎？" :answer="null">
        <StockDividendCashChainCard :symbol="stock.code" />
      </StockQuestionSection>

      <StockPageDigest :digest="digest" />
    </template>

    <el-result v-else-if="!stockPending" icon="warning" sub-title="請確認股票代號是否正確">
      <template #title>
        <h1 class="stock-not-found__title">找不到這檔股票</h1>
      </template>
      <template #extra>
        <el-button type="primary" @click="navigateTo('/')">回首頁</el-button>
      </template>
    </el-result>
  </div>
</template>

<style scoped>
.stock-dividend-source-page__card {
  margin-bottom: 16px;
}

.stock-dividend-source-page__prose {
  font-size: 1rem;
  line-height: 1.8;
}

.stock-dividend-source-page__prose p {
  margin: 0 0 12px;
  color: var(--el-text-color-regular);
}

.stock-dividend-source-page__prose p:last-child {
  margin-bottom: 0;
}
</style>
