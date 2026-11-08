<script setup lang="ts">
// 基本資料（2026-11-08，使用者：「請設計卡片，放基本資料，如上市櫃年數，董事長是誰等等。並設計基本資料頁面」；設計頁
// https://claude.ai/artifact/56HsmA1SowvPxnZ4vJzha4）：四段，各一個問題、一句答案、一張表格卡片。指標速覽的基本資料卡點標題進來。
// 欄位是使用者確認的清單，數據中台照這份留；怎麼寫（年數、負責人、金額）在 utils/company-profile.ts，跟卡片共用
const route = useRoute()
const code = computed(() => String(route.params.code))

const TOPIC = '基本資料'

const { stock, profile, stockShortName, stockPending } = useStockDetailSummary(code)
// 等它到了才畫（同一支快取端點，跟摘要卡的公司資料幾乎同時到）：先畫四段標題再補表格，換頁時表格會把下面推動
const { data: detail, status } = await useCompanyProfileDetail(code)
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
  const issued = item.issuedShares ? `、已發行 ${formatSignificantDigits(item.issuedShares, 4)}股` : ''
  const auditor = item.auditingFirm ? `；${item.declaredDataTypeName ?? '財報'}由${item.auditingFirm}簽證` : ''
  return `實收資本額 ${formatMoney(item.paidInCapitalNtd)}${issued}${auditor}。`
})

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
  freshness: detail.value?.generatedDate ? `資料日期 ${detail.value.generatedDate}` : null
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
      <StockQuestionSection id="stock-profile-contact" :question="`怎麼聯絡${stockShortName}？`" :answer="contactAnswer">
        <SharedChartCard><SharedFactList :items="facts.contact" :label="`${stockShortName}的聯絡方式`" /></SharedChartCard>
      </StockQuestionSection>
    </template>
    <p v-else-if="missing" class="hub-answer">目前沒有{{ stockShortName }}的基本資料。</p>
  </StockPageShell>
</template>
