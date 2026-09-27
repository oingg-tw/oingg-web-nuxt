<script setup lang="ts">
import { STATEMENT_DEFINITIONS } from '~/utils/financial-statement-rows'
import { clampDescription } from '~/utils/stock-digest'
import type { StockEquityCompositionResponse } from '#shared/types/stock-equity-composition'

// /stock/:code/balance-sheet — the latest filing's 資產負債表 alone, split out of
// financial-statements.vue 2026-09-20 per direct request ("資產負債表/損益表/現金流量表各自讓他們是
// /stock/2330/某某表"). Data/formatting come from useStockStatements.ts (shared with the other
// two split pages and financial-statements.vue itself, which keeps the interactive "browse any
// period" widget and the 資料摘要與來源 digest — neither duplicated here, per that same request).
const route = useRoute()
const router = useRouter()
const code = computed(() => String(route.params.code))

const { stock, profile, stockShortName, stockPending, isFavorite, toggleFavorite, summary } = useStockDetailSummary(code)
await useFilterSchema()

const { latest, statementOf, labelsOf, statementQuestions, statementAnswers } = await useStockStatements(code, stockShortName)
const definition = STATEMENT_DEFINITIONS.find(item => item.key === 'balanceSheet')!

const description = computed(() => {
  const answer = statementAnswers.value.balanceSheet
  // The question already leads with the company name/period; appending the answer gives a
  // reliably ≥50-CJK-character sentence even for a symbol with only one or two filed line items
  // (a bare name+answer combo measured under the 50 floor for some symbols).
  return answer ? clampDescription(`${statementQuestions.value.balanceSheet}${answer}`) : null
})

// 淨值組成（2026-09-27）。放在這一頁而不是新開一頁：歸屬母公司權益的六項組成就是資產負債表權益段的
// 逐行拆解，這一頁本來沒有任何圖表，而新頁要自己付 sitemap／nav／麵包屑／SEO 那一整套。
// await 在 page top-level：同 key 的 useAsyncData 沒 await 而被多個同時掛載的子元件呼叫會靜默卡在
// 初始值（2026-09-09 根因過一次）。
const { data: composition } = await useAsyncData(
  () => `stock-equity-composition-${code.value}`,
  () => $fetch<StockEquityCompositionResponse>(`/api/stock/${code.value}/equity-composition`),
  { watch: [code], default: () => null }
)

const YI = 1e5
const toYi = (value: number) => Math.round(value / YI).toLocaleString('en-US')
const periods = computed(() => composition.value?.periods ?? [])
const latestComposition = computed(() => periods.value.at(-1) ?? null)

const equityQuestion = computed(() => `${stockShortName.value}（${code.value}）的淨值是股東投入的還是公司賺來的？`)

const equityAnswer = computed(() => {
  const last = latestComposition.value
  if (!last || !last.equity) return null
  const share = (value: number) => `${((value / last.equity) * 100).toFixed(1)}%`
  const first = periods.value[0]
  // 只陳述佔比與變化量，不下判語——「保留盈餘佔比高」在不同公司是不同意思（成熟公司累積 vs 不配息），
  // 這一頁沒有立場分辨那個。
  const trend = first && first !== last ? `${first.label} 年底是 ${toYi(first.equity)} 億元。` : ''
  return `${last.label}歸屬母公司權益 ${toYi(last.equity)} 億元，其中保留盈餘 ${toYi(last.retainedEarnings)} 億元、佔 ${share(last.retainedEarnings)}，股本與資本公積合計 ${toYi(last.issuedCapital + last.capitalReserve)} 億元、佔 ${share(last.issuedCapital + last.capitalReserve)}。${trend}`
})

const sectorCode = computed(() => profile.value?.industry ?? null)
const { breadcrumbs } = useStockPageSeo({ code, shortName: stockShortName, topic: '資產負債表', titleKeywords: '資產負債表：資產、負債與權益', pathSuffix: '/balance-sheet', stock, summary, description, sectorCode })
</script>

<template>
  <div v-loading="stockPending" class="stock-statement-page">
    <template v-if="stockPending" />
    <el-result v-else-if="!stock" icon="warning" sub-title="請確認股票代號是否正確">
      <template #title>
        <h1 class="stock-not-found__title">找不到這檔股票</h1>
      </template>
      <template #extra>
        <el-button type="primary" @click="router.push('/')">回首頁</el-button>
      </template>
    </el-result>

    <template v-else>
      <StockSummaryCard :stock="stock" :is-favorite="isFavorite" :short-name="stockShortName" topic="資產負債表" @toggle-favorite="toggleFavorite" />
      <StockPageNav :code="code" />
      <StockBreadcrumb :items="breadcrumbs" />

      <StockQuestionSection v-if="latest" id="stock-balance-sheet" :question="statementQuestions.balanceSheet" :answer="statementAnswers.balanceSheet">
        <StockFinancialStatementTable
          :title="definition.label"
          :rows="definition.rows"
          :current="statementOf('balanceSheet').current"
          :prior="statementOf('balanceSheet').prior"
          :current-label="labelsOf('balanceSheet').current"
          :prior-label="labelsOf('balanceSheet').prior"
          :show-title="false"
        />
      </StockQuestionSection>
      <StockQuestionSection v-else id="stock-balance-sheet" :question="`${stockShortName}的資產負債表在哪裡？`">
        <p class="stock-answer">目前沒有這檔股票的財務報表申報資料。</p>
      </StockQuestionSection>

      <StockQuestionSection v-if="equityAnswer" id="stock-equity-composition" :question="equityQuestion" :answer="equityAnswer">
        <SharedTableScroll :label="`${stockShortName} ${code} 的淨值組成逐年數據`">
          <table class="seo-table" data-ssr-table>
            <caption>{{ stockShortName }} {{ code }} 歸屬母公司權益的組成（億元，庫藏股為減項）</caption>
            <thead>
              <tr>
                <th scope="col">年度</th>
                <th scope="col">保留盈餘</th>
                <th scope="col">資本公積</th>
                <th scope="col">股本</th>
                <th scope="col">其他權益</th>
                <th scope="col">庫藏股</th>
                <th scope="col">歸屬母公司權益</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="period in periods" :key="`${period.rocYear}-${period.season}`">
                <th scope="row">{{ period.label }}</th>
                <td>{{ toYi(period.retainedEarnings) }}</td>
                <td>{{ toYi(period.capitalReserve) }}</td>
                <td>{{ toYi(period.issuedCapital) }}</td>
                <td>{{ toYi(period.otherEquity) }}</td>
                <td>{{ period.treasuryShares ? `−${toYi(period.treasuryShares)}` : '—' }}</td>
                <td>{{ toYi(period.equity) }}</td>
              </tr>
            </tbody>
          </table>
        </SharedTableScroll>
        <StockEquityCompositionChart :periods="periods" />
      </StockQuestionSection>

      <StockQuestionSection id="stock-balance-sheet-more" question="想看其他季度或其他報表？">
        <ul class="stock-statement-page__link-list">
          <li><NuxtLink :to="`/stock/${code}/financial-statements`">用年度與季別選擇器切換到其他季度</NuxtLink></li>
          <li><NuxtLink :to="`/stock/${code}/income-statement`">看 {{ stockShortName }} {{ code }} 最新一期的損益表</NuxtLink></li>
          <li><NuxtLink :to="`/stock/${code}/cash-flow-statement`">看 {{ stockShortName }} {{ code }} 最新一期的現金流量表</NuxtLink></li>
        </ul>
      </StockQuestionSection>

      <StockQuestionSection id="stock-balance-sheet-source" question="這份報表的資料多久更新一次？" answer="資產負債表整理自公開資訊觀測站（MOPS）的公司申報資料，公司每季申報後更新，非本站自行編製。">
        <p class="stock-answer">單位為新台幣千元。無申報資料的期別以「－」表示。</p>
      </StockQuestionSection>
    </template>
  </div>
</template>

<style scoped>
.stock-statement-page {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.stock-statement-page__link-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.stock-statement-page__link-list a {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  color: var(--el-color-primary-dark-2);
  text-decoration: underline;
  text-underline-offset: 3px;
}
</style>
