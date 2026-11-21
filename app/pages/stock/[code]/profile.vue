<script setup lang="ts">
import type { AuditOpinions } from '~/utils/audit-opinion'
// 基本資料（2026-11-08，使用者：「請設計卡片，放基本資料，如上市櫃年數，董事長是誰等等。並設計基本資料頁面」；設計頁
// https://claude.ai/artifact/56HsmA1SowvPxnZ4vJzha4）：四段，各一個問題、一句答案、一張表格卡片。指標速覽的基本資料卡點標題進來。
// 欄位是使用者確認的清單，數據中台照這份留；怎麼寫（年數、負責人、金額）在 utils/company-profile.ts，跟卡片共用
const route = useRoute()
const code = computed(() => String(route.params.code))

const TOPIC = '基本資料'

const { stock, profile, stockShortName, stockPending } = useStockDetailSummary(code)
// 等它到了才畫（同一支快取端點，跟摘要卡的公司資料幾乎同時到）：先畫四段標題再補表格，換頁時表格會把下面推動。
// 會計師意見（2026-11-22）同理：跟摘要卡同一份網站快取，這裡自己再讀一次（同一個 useAsyncData 鍵再讀，Nuxt 會取消摘要那一個請求重打）
const [{ data: detail, status }, { data: audit }] = await Promise.all([
  useCompanyProfileDetail(code),
  useAsyncData(
    () => `audit-opinions-${code.value}`,
    () => apiFetch<AuditOpinions>(`/stocks/${code.value}/audit-opinions`, { baseURL: BUSINESS_CACHED_BASE }).catch(() => null),
    { watch: [code] }
  )
])
// 404（數據中台的公司目錄沒有這家，例如已經離開櫃買名單）：說沒有資料，不收錄這一頁
const missing = computed(() => status.value === 'success' && !detail.value)
// 伺服器算的「今天」帶到瀏覽器，年數在 hydration 時不會差一天
const today = useState('taipei-today', () => holdingsTaipeiDate())

const facts = computed(() => (detail.value ? profilePageFacts(detail.value, today.value) : null))

const companyAnswer = computed(() => {
  const item = detail.value
  if (!item) return null
  const market = MARKET_TEXT[item.market ?? '']
  const sector = sectorNameOf(item)
  const years = fullYears(item.listingDate, today.value)
  const dates = [
    item.establishedDate ? `${item.establishedDate.slice(0, 4)} 年成立` : null,
    item.listingDate && market ? `${item.listingDate.slice(0, 4)} 年${market.joined}` : null
  ].filter(Boolean).join('、')
  const clauses = [sector ? `屬${sector}` : null, dates || null, years !== null && market ? `已經${market.since} ${years} 年` : null].filter(Boolean)
  return clauses.length ? `${stockShortName.value}${sector ? '' : ' '}${clauses.join('，')}。` : null
})

const officersAnswer = computed(() => {
  if (!detail.value) return null
  const chairman = officersOf(detail.value, 'chairman')
  const spokesperson = officersOf(detail.value, 'spokesperson')
  const parts = [chairman ? `董事長是${chairman}` : null, spokesperson ? `發言人是${spokesperson}` : null].filter(Boolean)
  return parts.length ? `${parts.join('，')}。` : null
})

const capitalAnswer = computed(() => {
  const item = detail.value
  if (!item || item.paidInCapitalNtd === null) return null
  const issued = item.numberOfOrdinaryShares ? `、普通股 ${formatSignificantDigits(item.numberOfOrdinaryShares, 4)}股` : ''
  const auditor = item.auditingFirm ? `；${item.declaredDataTypeName ?? '財報'}由${item.auditingFirm}簽證` : ''
  return `實收資本額 ${formatMoney(item.paidInCapitalNtd)}${issued}${auditor}。`
})

// 會計師對財報有沒有示警（2026-11-22，使用者「按照建議執行」）：答句說有沒有、最近是哪一份報告；表格只列示警的那幾期，沒有就不畫
const auditAnswerText = computed(() => auditAnswer(audit.value))
const auditWarnings = computed(() => (audit.value?.entries ?? []).filter(isAuditWarning))

const contactAnswer = computed(() => {
  const item = detail.value
  if (!item?.stockTransferAgency) return null
  return `股務代理是${item.stockTransferAgency}${item.phone ? `，公司電話 ${item.phone}` : ''}。`
})

const description = computed(() => {
  const item = detail.value
  if (!item) return null
  const market = MARKET_TEXT[item.market ?? '']
  const parts = [
    item.listingDate && market ? `${market.date} ${item.listingDate}` : null,
    item.establishedDate ? `成立日 ${item.establishedDate}` : null,
    officersOf(item, 'chairman') ? `董事長${officersOf(item, 'chairman')}` : null,
    item.paidInCapitalNtd !== null ? `實收資本額 ${formatMoney(item.paidInCapitalNtd)}` : null
  ].filter(Boolean)
  return clampDescription(`${stockShortName.value}（${code.value}）的基本資料：${parts.join('、')}，以及經營團隊、股本、簽證會計師與聯絡方式。`)
})

const { breadcrumbs } = useStockPageSeo({
  code,
  shortName: stockShortName,
  topic: TOPIC,
  titleKeywords: '基本資料：董事長、上市日、資本額與簽證會計師',
  pathSuffix: '/profile',
  stock,
  description,
  sectorCode: computed(() => profile.value?.sectorCode ?? null),
  noindex: missing
})

const footer = computed(() => ({
  sources: ['公開資訊觀測站、櫃買中心：公司基本資料'],
  freshness: detail.value?.generatedDate ? `出表日 ${detail.value.generatedDate}` : null
}))
</script>

<template>
  <StockPageShell
    class="stock-profile-page"
    :code="code"
    :stock="stock"
    :pending="stockPending"
    :short-name="stockShortName"
    :topic="TOPIC"
    :breadcrumbs="breadcrumbs"
    :footer="footer"
  >
    <template v-if="facts">
      <StockQuestionSection id="stock-profile-company" :question="`${stockShortName}是什麼樣的公司？`" :answer="companyAnswer">
        <SharedChartCard><SharedFactList :items="facts.company" :label="`${stockShortName}的公司概況`" /></SharedChartCard>
      </StockQuestionSection>
      <StockQuestionSection id="stock-profile-officers" :question="`誰在經營${stockShortName}？`" :answer="officersAnswer">
        <SharedChartCard><SharedFactList :items="facts.officers" :label="`${stockShortName}的經營團隊`" /></SharedChartCard>
      </StockQuestionSection>
      <StockQuestionSection id="stock-profile-capital" :question="`${stockShortName}的股本多大？誰簽證財報？`" :answer="capitalAnswer">
        <SharedChartCard><SharedFactList :items="facts.capital" :label="`${stockShortName}的股本與簽證會計師`" /></SharedChartCard>
      </StockQuestionSection>
      <StockQuestionSection v-if="auditAnswerText" id="stock-profile-audit" :question="`會計師對${stockShortName}的財報有沒有示警？`" :answer="auditAnswerText">
        <SharedTable v-if="auditWarnings.length" :label="`${stockShortName}被會計師示警的財報`">
          <thead>
            <tr>
              <th scope="col">期別</th>
              <th scope="col">報告</th>
              <th scope="col">會計師的意見</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="entry in auditWarnings" :key="`${entry.fiscalYear}-${entry.fiscalQuarter}`">
              <th scope="row">{{ auditPeriodLabel(entry) }}</th>
              <td>{{ auditReportLabel(entry) }}</td>
              <td>{{ auditOpinionText(entry) }}</td>
            </tr>
          </tbody>
        </SharedTable>
      </StockQuestionSection>
      <StockQuestionSection id="stock-profile-contact" :question="`怎麼聯絡${stockShortName}？`" :answer="contactAnswer">
        <SharedChartCard><SharedFactList :items="facts.contact" :label="`${stockShortName}的聯絡方式`" /></SharedChartCard>
      </StockQuestionSection>
    </template>
    <p v-else-if="missing" class="hub-answer">目前沒有{{ stockShortName }}的基本資料。</p>
    <!-- 什麼算示警放在最後一張卡片之後（卡片前的文字只寫答案） -->
    <template v-if="facts && auditAnswerText" #guide>
      <StockMetricGuide
        id-prefix="stock-profile-audit"
        topic="會計師示警"
        definition-question="什麼算會計師示警？"
        :definition="[
          '會計師每季核閱、每年查核公司的財報，報告寫的意見分成幾種。這裡算成示警的有三種：繼續經營有重大不確定性（會計師懷疑公司撐不撐得下去）、無法表示意見（會計師拿不到足夠的證據），以及年報的保留意見（有部分項目會計師不同意或查不到）。',
          '季報的「保留結論」不算：多半是部分非重要子公司的財報沒經會計師核閱，很常見（2026 年第三季有 939 家），表格也不列。'
        ]"
      />
    </template>
  </StockPageShell>
</template>
