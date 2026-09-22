<script setup lang="ts">
import { STATEMENT_DEFINITIONS } from '~/utils/financial-statement-rows'
import { clampDescription } from '~/utils/stock-digest'

// /stock/:code/income-statement — the latest filing's 損益表 alone. See balance-sheet.vue's own
// top comment for the split's full reasoning; this page is that same template with the other
// statement type.
const route = useRoute()
const router = useRouter()
const code = computed(() => String(route.params.code))

const { stock, profile, stockShortName, stockPending, isFavorite, toggleFavorite, summary } = useStockDetailSummary(code)
await useFilterSchema()

const { latest, statementOf, labelsOf, statementQuestions, statementAnswers } = await useStockStatements(code, stockShortName)
const definition = STATEMENT_DEFINITIONS.find(item => item.key === 'incomeStatement')!

const description = computed(() => {
  const answer = statementAnswers.value.incomeStatement
  // See balance-sheet.vue's own comment — the question already leads with the company name/
  // period, and appending the answer reliably clears the 50-CJK-character description floor.
  return answer ? clampDescription(`${statementQuestions.value.incomeStatement}${answer}`) : null
})

const sectorCode = computed(() => profile.value?.industry ?? null)
const { breadcrumbs } = useStockPageSeo({ code, shortName: stockShortName, topic: '損益表', titleKeywords: '損益表：營收與淨利', pathSuffix: '/income-statement', stock, summary, description, sectorCode })
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
      <StockSummaryCard :stock="stock" :is-favorite="isFavorite" :short-name="stockShortName" topic="損益表" @toggle-favorite="toggleFavorite" />
      <StockPageNav :code="code" />
      <StockBreadcrumb :items="breadcrumbs" />

      <StockQuestionSection v-if="latest" id="stock-income-statement" :question="statementQuestions.incomeStatement" :answer="statementAnswers.incomeStatement">
        <StockFinancialStatementTable
          :title="definition.label"
          :rows="definition.rows"
          :current="statementOf('incomeStatement').current"
          :prior="statementOf('incomeStatement').prior"
          :current-label="labelsOf('incomeStatement').current"
          :prior-label="labelsOf('incomeStatement').prior"
          :show-title="false"
        />
      </StockQuestionSection>
      <StockQuestionSection v-else id="stock-income-statement" :question="`${stockShortName}的損益表在哪裡？`">
        <p class="stock-answer">目前沒有這檔股票的財務報表申報資料。</p>
      </StockQuestionSection>

      <StockQuestionSection id="stock-income-statement-more" question="想看其他季度或其他報表？">
        <ul class="stock-statement-page__link-list">
          <li><NuxtLink :to="`/stock/${code}/financial-statements`">用年度與季別選擇器切換到其他季度</NuxtLink></li>
          <li><NuxtLink :to="`/stock/${code}/balance-sheet`">看 {{ stockShortName }} {{ code }} 最新一期的資產負債表</NuxtLink></li>
          <li><NuxtLink :to="`/stock/${code}/cash-flow-statement`">看 {{ stockShortName }} {{ code }} 最新一期的現金流量表</NuxtLink></li>
        </ul>
      </StockQuestionSection>

      <StockQuestionSection id="stock-income-statement-source" question="這份報表的資料多久更新一次？" answer="損益表整理自公開資訊觀測站（MOPS）的公司申報資料，公司每季申報後更新，非本站自行編製。">
        <p class="stock-answer">單位為新台幣千元；每股盈餘（EPS）為元。虧損或無申報資料的期別以「－」表示。</p>
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
