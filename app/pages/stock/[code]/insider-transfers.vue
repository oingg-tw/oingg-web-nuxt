<script setup lang="ts">
import type { InsiderTransfers } from '~/utils/insider-transfers'

// 內部人申報轉讓（2026-11-22，數據中台 B 批第 12 項；使用者「按照建議執行」：不顯示申報人與受讓人姓名；設計
// https://claude.ai/artifact/BffXAybhLkibJSNAcRTDkz）：董監、經理人與大股東轉讓持股前的事前申報，依出表日分組、一位申報人一列，期滿沒轉讓的
// 那一列底下寫一句。只寫身分與人數，不做依人名查詢（09-13 法律研究：目的外利用違反個資法第 20 條）。多數公司沒有申報，所以不進 sitemap、
// 沒有任何一筆就 noindex。出處照政府資料開放授權條款第 1 版的附件寫在頁尾（同重大訊息頁）
const route = useRoute()
const code = computed(() => String(route.params.code))

const TOPIC = '內部人申報轉讓'

const { stock, profile, stockShortName, stockPending } = useStockDetailSummary(code)
// 申報與公司資料（普通股股數算占比、市場別認興櫃）一起等它到了才換頁：頁面沒有讀取中的樣子，資料晚到不會把版面往下推
const [{ data, error, refresh }, { data: detail }] = await Promise.all([
  useFetch<InsiderTransfers>(() => `/api/cached/stocks/${code.value}/insider-transfers`, { key: () => `stock-insider-transfers-${code.value}`, watch: [code] }),
  useCompanyProfileDetail(code)
])
// 404（不在名單）是沒有資料，不是讀不到
watchLoadFailure(() => `stock-insider-transfers:${code.value}`, () => (error.value?.statusCode === 404 ? null : error.value), refresh)
const entries = computed(() => data.value?.entries ?? [])
// 伺服器算的「今天」帶到瀏覽器：今天／昨天的組名在 hydration 時不會不一樣
const today = useState('taipei-today', () => holdingsTaipeiDate())
const yesterday = computed(() => new Date(Date.parse(`${today.value}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10))
const groups = computed(() => insiderTransferGroups(entries.value).map(group => ({
  ...group,
  label: `${group.day === today.value ? '今天 ' : group.day === yesterday.value ? '昨天 ' : ''}${shortDayLabel(group.day)}`
})))
const emerging = computed(() => detail.value?.market === 'rotc')

const answer = computed(() => {
  if (emerging.value) return '興櫃公司的內部人申報轉讓目前沒有資料來源，這裡不列。'
  return insiderTransferAnswer(entries.value, detail.value?.numberOfOrdinaryShares ?? null) ?? `${stockShortName.value}最近沒有內部人申報轉讓。`
})
const description = computed(() => clampDescription(`${stockShortName.value}（${code.value}）董監、經理人與大股東的持股轉讓事前申報：身分、轉讓方式、預定轉讓張數、轉讓前後持股與期間，資料取自臺灣證券交易所與證券櫃檯買賣中心。`))

const { breadcrumbs } = useStockPageSeo({
  code,
  shortName: stockShortName,
  topic: TOPIC,
  titleKeywords: '內部人申報轉讓：董監與大股東的持股轉讓',
  pathSuffix: '/insider-transfers',
  stock,
  description,
  sectorCode: computed(() => profile.value?.sectorCode ?? null),
  noindex: computed(() => !entries.value.length)
})

const footer = {
  sources: ['臺灣證券交易所（2026）上市公司每日內部人持股轉讓事前申報表（持股轉讓日報表、持股未轉讓日報表）', '證券櫃檯買賣中心（2026）上櫃公司每日內部人持股轉讓事前申報表（持股轉讓日報表、持股未轉讓日報表）'],
  links: [{ to: 'https://data.gov.tw/license', label: '政府資料開放授權條款第 1 版', external: true }],
  disclaimer: '以上申報依政府資料開放授權條款第 1 版，取自臺灣證券交易所與證券櫃檯買賣中心的開放資料；正式內容以公開資訊觀測站為準，不代表本站對此個股之評等或投資建議。'
}
const GUIDE = [
  '公司的董事、監察人、經理人與持股超過 10% 的大股東，要轉讓持股前得先向主管機關申報，寫明轉讓方式、預定轉讓多少與期間。這一頁列出最近的申報，一位申報人一列；同一次申報贈與好幾個人時合成一列，寫受讓人有幾位。',
  '只寫身分與人數，不寫申報人與受讓人的姓名。期間過了沒有轉讓的，那一列底下寫「期間內沒有轉讓」。1 張是 1,000 股。',
  '上市公司的資料取自臺灣證券交易所（2026 年 9 月底起），上櫃公司取自證券櫃檯買賣中心（2026 年 11 月起）；興櫃公司目前沒有來源。'
]
</script>

<template>
  <StockPageShell
    class="stock-insider-transfers-page"
    :code="code"
    :stock="stock"
    :pending="stockPending"
    :short-name="stockShortName"
    :topic="TOPIC"
    :breadcrumbs="breadcrumbs"
    :footer="footer"
  >
    <StockQuestionSection id="stock-insider-transfers" :question="`${stockShortName}的內部人最近申報轉讓多少？`" :answer="answer">
      <SharedTable v-for="group in groups" :key="group.day" :label="`${stockShortName}在 ${group.label} 申報的內部人持股轉讓`">
        <template #header>
          <h3 class="stock-insider-transfers-page__day">{{ group.label }} 申報</h3>
        </template>
        <thead>
          <tr>
            <th scope="col">身分</th>
            <th scope="col">方式</th>
            <th scope="col" class="seo-table__num">預定轉讓</th>
            <th scope="col" class="seo-table__num">持股：轉讓前 → 後</th>
            <th scope="col">轉讓期間</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="(entry, index) in group.items" :key="`${group.day}-${index}`">
            <tr>
              <th scope="row">{{ entry.declarantRole }}</th>
              <td>{{ transferMethodText(entry) }}</td>
              <td class="seo-table__num">{{ lotsText(sharesOf(entry.plannedTransferShares)) }}</td>
              <td class="seo-table__num">{{ holdingChangeText(entry) }}</td>
              <td>{{ transferPeriodText(entry) }}</td>
            </tr>
            <tr v-if="untransferredText(entry)" class="seo-table__remark">
              <td colspan="5"><span class="seo-table__remark-text">{{ untransferredText(entry) }}</span></td>
            </tr>
          </template>
        </tbody>
      </SharedTable>
    </StockQuestionSection>
    <template #guide>
      <StockMetricGuide id-prefix="stock-insider-transfers" :topic="TOPIC" definition-question="內部人申報轉讓是什麼？" :definition="GUIDE" />
    </template>
  </StockPageShell>
</template>

<style scoped>
.stock-insider-transfers-page__day {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}
</style>
