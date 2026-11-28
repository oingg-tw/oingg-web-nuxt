<script setup lang="ts">
import type { AuditOpinions } from '~/utils/audit-opinion'
import type { RegulatoryEvents } from '~/utils/regulatory-events'
import type { StockSeriesResponse } from '#shared/types/stock-series'
// 基本資料（2026-11-08，使用者：「請設計卡片，放基本資料，如上市櫃年數，董事長是誰等等。並設計基本資料頁面」；設計頁
// https://claude.ai/artifact/56HsmA1SowvPxnZ4vJzha4）：四段，各一個問題、一句答案、一張表格卡片。指標速覽的基本資料卡點標題進來。
// 欄位是使用者確認的清單，數據中台照這份留；怎麼寫（年數、負責人、金額）在 utils/company-profile.ts，跟卡片共用
const route = useRoute()
const code = computed(() => String(route.params.code))

const TOPIC = '基本資料'

const { stock, profile, stockShortName, stockPending } = useStockDetailSummary(code)
// 等它到了才畫（同一支快取端點，跟摘要卡的公司資料幾乎同時到）：先畫四段標題再補表格，換頁時表格會把下面推動。
// 會計師意見（2026-11-22）同理：跟摘要卡同一份網站快取，這裡自己再讀一次（同一個 useAsyncData 鍵再讀，Nuxt 會取消摘要那一個請求重打）
// 主要管理階層薪酬（2026-11-22）：伺服器的 series 計畫 profile（近 5 年 FY），同一套快取
// 裁罰、違反申報規定與經營權異動（2026-11-28）：同會計師意見，讀不到（或 404：不在公司目錄）就不畫那一段，不寫成「查不到」
const [{ data: detail, status }, { data: audit }, { data: regulatory }, { data: series }] = await Promise.all([
  useCompanyProfileDetail(code),
  useAsyncData(
    () => `audit-opinions-${code.value}`,
    () => apiFetch<AuditOpinions>(`/stocks/${code.value}/audit-opinions`, { baseURL: BUSINESS_CACHED_BASE }).catch(() => null),
    { watch: [code] }
  ),
  useAsyncData(
    () => `regulatory-events-${code.value}`,
    () => apiFetch<RegulatoryEvents>(`/stocks/${code.value}/regulatory-events`, { baseURL: BUSINESS_CACHED_BASE }).catch(() => null),
    { watch: [code] }
  ),
  useFetch<StockSeriesResponse>(() => `/api/stock/${code.value}/series`, { query: { page: 'profile' }, key: () => `stock-series-profile-${code.value}`, watch: [code] })
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

// 經營團隊一年領多少（2026-11-22，數據中台 B 批第 6 項）：答句寫最新一年，表格列近 5 年；金控沒有這張附註，整段不畫
const keyManagement = computed(() => keyManagementYears(series.value?.groups.FY_KEY_MGMT_5?.entries ?? []))
const keyManagementText = computed(() => keyManagementAnswer(keyManagement.value))

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

// 裁罰、違反申報規定與經營權異動（2026-11-28，使用者 11-25 挑的交易所警示資料）：答句說有幾筆或從哪天以來查不到，表格只列日期、種類、
// 金額，底下一句寫對象與法條；違規事由連到公開資訊觀測站的專區。興櫃沒有這類來源，整段不畫
// 基本資料讀不到的公司整頁只有一句「目前沒有…」（下面的 v-if="facts"）：這一段不畫，頁尾的出處也跟著不列
const regulatoryText = computed(() => (facts.value ? regulatoryAnswer(regulatory.value, stockShortName.value) : null))
const regulatoryList = computed(() => (hasRegulatoryCoverage(regulatory.value) ? regulatoryRows(regulatory.value) : []))
const regulatoryLinks = computed(() => (hasRegulatoryCoverage(regulatory.value) ? regulatorySources(regulatory.value) : []))
// 專區的網址帶不到市場別（公開觀測站 2026-11-28 驗過：裁罰、經營權異動的專區上市、上櫃同一頁，要在頁面裡選；違反申報規定上櫃是另一頁），
// 所以連結後面說這家公司要選哪一個。哪幾頁共用是公開資訊觀測站的版面、會變，這裡不寫死是哪幾頁
const regulatoryMarket = computed(() => MARKET_TEXT[detail.value?.market ?? '']?.name)
// 名單是什麼、從哪天起完整，放在最後一張卡片之後（卡片前的文字只寫答案）
const regulatoryGuide = computed(() => (hasRegulatoryCoverage(regulatory.value)
  ? [
      '證期局裁罰是金管會證券期貨局處的罰鍰，受罰的可能是公司、公司的行為負責人或個人，表格寫的是哪一種，不寫姓名。違反申報規定是公司沒有照資訊申報、重大訊息或說明記者會的規定申報或公開資訊，由臺灣證券交易所或證券櫃檯買賣中心依上市、上櫃契約收違約金，不是罰鍰。經營權異動是兩所公布經營權有變動的公司與異動日。',
      `名單取自兩所的開放資料，這家公司所在市場的名單從 ${regulatorySince(regulatory.value)} 起完整；更早的案件只有當時還列在名單上的才有，所以查不到不代表沒有。這裡只列日期、種類、對象、法條與金額，照名單原文、不加評價；違規的事由請看公開資訊觀測站的專區。`
    ]
  : []))

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

// 三份名單取自兩所的開放資料，出處照政府資料開放授權條款第 1 版的附件寫（同重大訊息頁）；轉上市（櫃）的公司兩所都可能有案件，兩所都列。
// 資料名稱照兩所開放資料的原名（半形括號也是）；名稱本身有頓號，所以各用引號分開
const regulatoryDatasets = (market: string) => ['金管會證券期貨局裁罰案件專區', '違反資訊申報、重大訊息及說明記者會規定專區', '經營權及營業範圍異(變)動專區-經營權異動公司'].map(name => `「${market}公司${name}」`).join('')
const footer = computed(() => ({
  sources: [
    '公開資訊觀測站、櫃買中心：公司基本資料',
    ...(keyManagementText.value ? ['公開資訊觀測站：財務報告附註（主要管理階層薪酬）'] : []),
    ...(regulatoryText.value ? [`臺灣證券交易所（2026）${regulatoryDatasets('上市')}`, `證券櫃檯買賣中心（2026）${regulatoryDatasets('上櫃')}`] : [])
  ],
  freshness: detail.value?.generatedDate ? `出表日 ${detail.value.generatedDate}` : null,
  links: regulatoryText.value ? [{ to: 'https://data.gov.tw/license', label: '政府資料開放授權條款第 1 版', external: true }] : []
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
      <StockQuestionSection v-if="keyManagementText" id="stock-profile-key-management" :question="`${stockShortName}的經營團隊一年領多少？`" :answer="keyManagementText">
        <SharedTable :label="`${stockShortName}的主要管理階層薪酬`">
          <thead>
            <tr>
              <th scope="col">年度</th>
              <th scope="col" class="seo-table__num">主要管理階層薪酬</th>
              <th scope="col" class="seo-table__num">占稅後淨利</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="year in keyManagement" :key="year.fiscalYear">
              <th scope="row">{{ year.fiscalYear }}</th>
              <td class="seo-table__num">{{ formatMoney(year.compensation * 1000) }}</td>
              <td class="seo-table__num" :title="year.ratio === null ? nullReasonTitle({ value: null, nullReason: year.ratioReason }) : undefined">{{ year.ratio === null ? nullReasonShortText(year.ratioReason) : `${year.ratio.toFixed(2)}%` }}</td>
            </tr>
          </tbody>
        </SharedTable>
        <p class="hub-answer">主要管理階層是董事與公司認定的高階經理人（國際會計準則第 24 號）；財報沒有寫人數，所以不算每人平均。</p>
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
      <StockQuestionSection v-if="regulatoryText" id="stock-profile-regulatory" :question="`${stockShortName}有沒有裁罰、違反申報規定或經營權異動的紀錄？`" :answer="regulatoryText">
        <SharedTable v-if="regulatoryList.length" :label="`${stockShortName}的裁罰、違反申報規定與經營權異動`">
          <thead>
            <tr>
              <th scope="col">日期</th>
              <th scope="col">種類</th>
              <th scope="col" class="seo-table__num">金額</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="(row, index) in regulatoryList" :key="index">
              <tr>
                <th scope="row">{{ row.date }}</th>
                <td class="stock-profile-page__event-kind">{{ row.kind }}</td>
                <td class="seo-table__num">{{ row.amount }}</td>
              </tr>
              <tr v-if="row.remark" class="seo-table__remark">
                <td colspan="3"><span class="seo-table__remark-text">{{ row.remark }}</span></td>
              </tr>
            </template>
          </tbody>
        </SharedTable>
        <!-- 有紀錄才放連結（沒有紀錄時沒有案件可查，卡片之間的字也會太多） -->
        <p v-if="regulatoryList.length && regulatoryLinks.length" class="hub-answer">
          名單的原文在公開資訊觀測站：<template v-for="(link, index) in regulatoryLinks" :key="link.label"><template v-if="index">、</template><a :href="link.href" target="_blank" rel="noopener noreferrer">{{ link.label }}（另開新視窗）</a></template><template v-if="regulatoryMarket">。頁面要選市場別時，請選「{{ regulatoryMarket }}」。</template>
        </p>
      </StockQuestionSection>
      <StockQuestionSection id="stock-profile-contact" :question="`怎麼聯絡${stockShortName}？`" :answer="contactAnswer">
        <SharedChartCard><SharedFactList :items="facts.contact" :label="`${stockShortName}的聯絡方式`" /></SharedChartCard>
      </StockQuestionSection>
    </template>
    <p v-else-if="missing" class="hub-answer">目前沒有{{ stockShortName }}的基本資料。</p>
    <!-- 什麼算示警放在最後一張卡片之後（卡片前的文字只寫答案） -->
    <template v-if="facts && (auditAnswerText || regulatoryText)" #guide>
      <StockMetricGuide
        v-if="auditAnswerText"
        id-prefix="stock-profile-audit"
        topic="會計師示警"
        definition-question="什麼算會計師示警？"
        :definition="[
          '會計師每季核閱、每年查核公司的財報，報告寫的意見分成幾種。這裡算成示警的有三種：繼續經營有重大不確定性（會計師懷疑公司撐不撐得下去）、無法表示意見（會計師拿不到足夠的證據；季報的核閱報告叫「無法作成結論」），以及年報的保留意見（有部分項目會計師不同意或查不到）。',
          '季報的「保留結論」不算：多半是部分非重要子公司的財報沒經會計師核閱，很常見（2026 年第三季有 939 家），表格也不列。'
        ]"
      />
      <StockMetricGuide v-if="regulatoryText" id-prefix="stock-profile-regulatory" topic="裁罰與經營權異動" definition-question="裁罰、違反申報規定與經營權異動的名單是什麼？" :definition="regulatoryGuide" />
    </template>
  </StockPageShell>
</template>

<style scoped>
/* 裁罰那張表的種類可以折行（表格的格子預設不折）：手機放不下日期、種類、金額三欄時折種類，不讓表格左右捲；兩行的字數盡量平均，
   不留一個字在第二行（不支援的瀏覽器照一般折行） */
.stock-profile-page__event-kind {
  white-space: normal;
  text-wrap: balance;
}
</style>
