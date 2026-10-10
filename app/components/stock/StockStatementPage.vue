<script setup lang="ts">
import type { StatementType } from '#shared/types/financial-statement'
// 三張「最新一期的單一報表」頁（/balance-sheet、/income-statement、/cash-flow-statement，2026-09-20 使用者要求各自一頁）共用的
// 頁面本體；三個路由檔只剩 <StockStatementPage statement="…" />（同 [slug].vue 的分派先例，網址與 sitemap 不變）。資料與格式
// 來自 useStockStatements（財務報表總覽頁也用它；期別選擇器與資料摘要只留在那一頁，這裡不重複）。
const props = defineProps<{ statement: StatementType }>()

const PAGES: Record<StatementType, { topic: string; titleKeywords: string; pathSuffix: string; unitNote: string }> = {
  balanceSheet: { topic: '資產負債表', titleKeywords: '資產負債表：資產、負債與權益', pathSuffix: '/balance-sheet', unitNote: '單位為新台幣千元。無申報資料的期別以「－」表示。' },
  incomeStatement: { topic: '損益表', titleKeywords: '損益表：營收與淨利', pathSuffix: '/income-statement', unitNote: '單位為新台幣千元；每股盈餘（EPS）為元。虧損或無申報資料的期別以「－」表示。' },
  cashFlowStatement: { topic: '現金流量表', titleKeywords: '現金流量表：營業、投資與籌資現金流', pathSuffix: '/cash-flow-statement', unitNote: '單位為新台幣千元。無申報資料的期別以「－」表示。' }
}
// 每個路由檔是自己的頁面元件，換頁就重掛，所以這些不用是響應式的
const page = PAGES[props.statement]
const others = (Object.keys(PAGES) as StatementType[]).filter(key => key !== props.statement).map(key => PAGES[key])
const sectionId = `stock${page.pathSuffix.replace('/', '-')}`

const route = useRoute()
const code = computed(() => String(route.params.code))

const { stock, profile, stockShortName, stockPending, isFavorite, toggleFavorite, summary } = useStockDetailSummary(code)
await useFilterSchema()

const { latest, statementOf, labelsOf, statementQuestions, statementAnswers } = await useStockStatements(code, stockShortName)
const definition = STATEMENT_DEFINITIONS.find(item => item.key === props.statement)!

// 問句已經帶公司名與期別，接上答句才穩定超過 50 個字的描述下限（只申報一兩個科目的公司，單靠名稱＋答句量過會不足）
const description = computed(() => {
  const answer = statementAnswers.value[props.statement]
  return answer ? clampDescription(`${statementQuestions.value[props.statement]}${answer}`) : null
})

const sectorCode = computed(() => profile.value?.sectorCode ?? null)
const { breadcrumbs } = useStockPageSeo({ code, shortName: stockShortName, topic: page.topic, titleKeywords: page.titleKeywords, pathSuffix: page.pathSuffix, stock, summary, description, sectorCode })
</script>

<template>
  <div v-loading="stockPending" class="app-page stock-statement-page">
    <template v-if="stockPending" />
    <SharedStockNotFound v-else-if="!stock" />

    <template v-else>
      <StockSummaryCard :stock="stock" :is-emerging="profile?.isEmerging ?? null" :is-favorite="isFavorite" :short-name="stockShortName" :topic="page.topic" @toggle-favorite="toggleFavorite" />
      <StockPageNav :code="code" />
      <StockBreadcrumb :items="breadcrumbs" />

      <StockQuestionSection v-if="latest" :id="sectionId" :question="statementQuestions[statement]" :answer="statementAnswers[statement]">
        <StockFinancialStatementTable
          :title="definition.label"
          :rows="definition.rows"
          :current="statementOf(statement).current"
          :prior="statementOf(statement).prior"
          :current-label="labelsOf(statement).current"
          :prior-label="labelsOf(statement).prior"
          :show-title="false"
        />
      </StockQuestionSection>
      <StockQuestionSection v-else :id="sectionId" :question="`${stockShortName}的${page.topic}在哪裡？`">
        <p class="stock-answer">目前沒有這檔股票的財務報表申報資料。</p>
      </StockQuestionSection>

      <StockQuestionSection :id="`${sectionId}-more`" question="想看其他季度或其他報表？">
        <ul class="stock-statement-page__link-list">
          <li><NuxtLink :to="`/stock/${code}/financial-statements`">用年度與季別選擇器切換到其他季度</NuxtLink></li>
          <li v-for="other in others" :key="other.pathSuffix"><NuxtLink :to="`/stock/${code}${other.pathSuffix}`">看 {{ stockShortName }} {{ code }} 最新一期的{{ other.topic }}</NuxtLink></li>
        </ul>
      </StockQuestionSection>

      <StockQuestionSection :id="`${sectionId}-source`" question="這份報表的資料多久更新一次？" :answer="`${page.topic}整理自公開資訊觀測站（MOPS）的公司申報資料，公司每季申報後更新，非本站自行編製。`">
        <p class="stock-answer">{{ page.unitNote }}</p>
      </StockQuestionSection>
    </template>
  </div>
</template>

<style scoped>
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
