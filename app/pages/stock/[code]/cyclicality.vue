<script setup lang="ts">
import type { ChartLegendGroup } from '~/components/shared/SharedChartLegend.vue'
import type { CyclicalityBreakdown } from '~/utils/cyclicality'

// 景氣循環度（2026-11-28，使用者：「有辦法的設計卡片與指標，讓用戶知道這個個股本身是否屬於景氣循環股嗎」；設計圖
// https://claude.ai/artifact/MnW2nnuXRFn2TTiJUNThN5）：一家公司的財務特徵有多像景氣循環股，寫成它在上市櫃公司裡的百分位。第一段是位置
//（位置條上一格是所屬產業的中位數）與四項特徵的表，每一項底下攤開它看的兩個數字與各自的百分位；第二段是年度營業利益率的點與趨勢線，
// 獲利起伏量的就是每年離那條線多遠。
// 「是不是」只寫位置，不分高中低、不貼標籤（使用者同日要網頁前端跟數據中台核對出「理論上與實務上的最佳選擇」，理由見 app/utils/cyclicality.ts 開頭）；
// 文字不寫景氣現在走到哪個階段，也不寫任何操作。數字全部是數據中台算好的（cyclicality-breakdown）
const route = useRoute()
const code = computed(() => String(route.params.code))

const TOPIC = '景氣循環度'

const { stock, profile, stockShortName, stockPending } = useStockDetailSummary(code)
const { data, error, refresh } = await useFetch<CyclicalityBreakdown>(() => `/api/cached/stocks/${code.value}/cyclicality-breakdown`, { key: () => `stock-cyclicality-${code.value}`, watch: [code] })
// 404（興櫃、不在母體）是沒有資料，不是讀不到。讀不到的時候畫面不說「沒有」，交給全站的讀取失敗提示（它會自動重讀）：
// 數據中台改了算法、那一批還沒重算完時會回 503（經業務中台是 502），同六面向
const failure = computed(() => (error.value && error.value.statusCode !== 404 ? error.value : null))
watchLoadFailure(() => `stock-cyclicality:${code.value}`, () => failure.value, refresh)

const value = computed(() => (typeof data.value?.value === 'number' ? data.value.value : null))
const sector = computed(() => cyclicalitySector(data.value, SECTORS))
const rows = computed(() => cyclicalityRows(data.value, SECTORS))
// 合成算不出來、但有幾項算得出來的公司（缺獲利起伏）：表照列，讀者看得到是缺哪一項
const hasRows = computed(() => rows.value.some(row => row.percentile !== null))
const margin = computed(() => data.value?.profitSwing?.operatingMargin)
const trend = computed(() => cyclicalityTrend(margin.value))
const asOf = computed(() => data.value?.asOf ?? null)

const answer = computed(() => {
  if (failure.value) return ''
  if (!data.value || profile.value?.market === 'rotc') return cyclicalityMissingText('not_in_universe')
  return cyclicalityAnswer(stockShortName.value, data.value, sector.value)
})
const trendAnswer = computed(() => (trend.value
  ? `${cyclicalityTrendCaption(margin.value)}；最高 ${fixedRateText(trend.value.highest.value)}（${trend.value.highest.fiscalYear} 年），最低 ${fixedRateText(trend.value.lowest.value)}（${trend.value.lowest.fiscalYear} 年）。`
  : ''))
// 圖例與單位照全站圖表的畫法（圖上方一列）。顏色用 CSS 變數：這張圖在伺服器的 HTML 裡就有，不等瀏覽器判斷深淺色
const trendLegend = computed<ChartLegendGroup[]>(() => [{
  unit: '%',
  items: [
    { name: '年度營業利益率', color: 'var(--el-color-primary)', kind: 'dot' },
    { name: '趨勢線', color: 'currentColor', kind: 'line', dash: 'dashed' },
    ...(trend.value?.capped ? [{ name: MARGIN_CAP_NOTE, color: 'currentColor', kind: 'arrow' as const }] : [])
  ]
}])

const itemNames = CYCLICALITY_ITEMS.map(item => item.label).join('、')
const description = computed(() => clampDescription(`${stockShortName.value}（${code.value}）的景氣循環度：${itemNames}四項財報特徵各自在上市櫃公司裡的百分位、所屬產業的中位數，以及年度營業利益率離長期趨勢多遠。`))

const { breadcrumbs } = useStockPageSeo({
  code,
  shortName: stockShortName,
  topic: TOPIC,
  // 標題至多 32 字（check-stock-pages）
  titleKeywords: '景氣循環度與四項財報特徵',
  pathSuffix: '/cyclicality',
  stock,
  description,
  sectorCode: computed(() => profile.value?.sectorCode ?? null),
  noindex: computed(() => value.value === null)
})

const footer = computed(() => ({
  sources: ['公開資訊觀測站的財務報表與月營收（百分位由本站計算）；產業分類：臺灣證券交易所、證券櫃檯買賣中心'],
  freshness: asOf.value ? `資料日期 ${asOf.value}` : null,
  disclaimer: '百分位是統計上的位置，不代表本站對此個股之評等或投資建議。'
}))
// 定義與限制照數據中台寫進 openapi 與詞彙表的那兩段（2026-11-28 核對）：景氣循環度不是型錄的指標，所以文字在這裡
const guide = [
  `景氣循環度把一家公司放進上市櫃公司裡，看四項財報特徵各排在哪裡：${itemNames}。四項合成一個百分位：越高，財務特徵越像景氣循環股。金融保險業、建材營造業，以及用異業合併格式申報財報的公司不適用；財報未滿 8 年的公司算不出來；興櫃公司不在比較範圍裡。`,
  '獲利起伏：近 10 年年度營業利益率、毛利率偏離長期趨勢線的幅度，相對於十年平均有多大。先畫出十年的趨勢線，看每年通常離線多遠，再除以十年平均；比例越大，起伏相對於獲利本身越大。先去掉趨勢，穩定成長的公司才不會被當成起伏大。',
  '高點回落：近 10 年裡，近四季合計營收從高點跌多少、近四季營業利益率從高點掉幾個百分點。',
  '同業連動：近三個月營收的年增率，跟同產業其他公司中位數、全市場中位數的相關係數。產業照交易所的產業分類，上市與上櫃公司合在一起算；同一個產業裡的公司做的生意不一定一樣。',
  '重資產：不動產、廠房及設備占總資產的比例，與固定資產週轉率的高低差。兩個都要高才排得上來：資產重但週轉率很穩的公司不算。',
  '每一項先看兩個數字各自的百分位，平均後再排一次。獲利起伏占一半、其他三項的平均占一半（幾何平均），再換成百分位。獲利起伏的去趨勢做法參考標普全球評級的 Corporate Methodology：原文用在 EBITDA 等獲利指標，這裡套用在營業利益率與毛利率；其他三項是本站設計。',
  '百分位是位置，不是評分，不代表景氣現在走到哪個階段，也不代表股價之後的漲跌。多角化集團的合併報表把不同事業加在一起，起伏會互相抵銷。期間內合併、分割、轉型或處分主要事業的公司，起伏可能來自事業改變，而不是景氣。'
]
</script>

<template>
  <StockPageShell
    class="stock-cyclicality-page"
    :code="code"
    :stock="stock"
    :pending="stockPending"
    :short-name="stockShortName"
    :topic="TOPIC"
    :breadcrumbs="breadcrumbs"
    :footer="footer"
  >
    <StockQuestionSection id="stock-cyclicality" :question="`${stockShortName}有多符合景氣循環股的特徵？`" :answer="answer">
      <SharedTable v-if="hasRows" :label="`${stockShortName}景氣循環度的四項特徵${asOf ? `（${asOf}）` : ''}`" table-class="stock-cyclicality-page__table">
        <template v-if="value !== null" #header>
          <StockCyclicalityPosition :value="value" :sector="sector" />
        </template>
        <thead>
          <tr>
            <th scope="col">特徵與{{ stockShortName }}的數字</th>
            <th scope="col" class="seo-table__num">百分位</th>
          </tr>
        </thead>
        <tbody v-for="row in rows" :key="row.key">
          <tr class="stock-cyclicality-page__group">
            <th scope="rowgroup">{{ row.label }}<span v-if="row.note" class="stock-cyclicality-page__note">（{{ row.note }}）</span></th>
            <td class="seo-table__num">
              <template v-if="row.percentile !== null">{{ percentileText(row.percentile) }}</template>
              <template v-else>{{ sixDimensionMissingLabel(row.nullReason) }}<template v-if="cyclicalityItemNullText(row.nullReason)">：{{ cyclicalityItemNullText(row.nullReason) }}</template></template>
            </td>
          </tr>
          <tr v-for="measure in row.measures" :key="measure.text">
            <th scope="row" class="stock-cyclicality-page__measure">{{ measure.text }}</th>
            <td class="seo-table__num">{{ percentileText(measure.percentile) }}</td>
          </tr>
        </tbody>
      </SharedTable>
    </StockQuestionSection>
    <StockQuestionSection v-if="trend" id="stock-cyclicality-trend" :question="`${stockShortName}的獲利離長期趨勢多遠？`" :answer="trendAnswer">
      <SharedChartCard>
        <SharedChartLegend :groups="trendLegend" />
        <StockCyclicalityTrend class="stock-cyclicality-page__trend" :trend="trend" :label="cyclicalityTrendLabel(stockShortName, trend, margin)" />
      </SharedChartCard>
    </StockQuestionSection>
    <template #guide>
      <StockMetricGuide id-prefix="stock-cyclicality" :topic="TOPIC" definition-question="景氣循環度是什麼？" :definition="guide" />
    </template>
  </StockPageShell>
</template>

<style scoped>
/* 每一項一列（名稱與它的百分位），底下是它看的兩個數字：句子那一欄吃掉剩下的寬度、可以折行，百分位那一欄照內容寬（表頭的「百分位」不折） */
:deep(.stock-cyclicality-page__table) tbody th {
  white-space: normal;
}

:deep(.stock-cyclicality-page__table) .stock-cyclicality-page__group > * {
  background: var(--el-fill-color-lighter);
  font-weight: 600;
}

/* 一項的兩列數字之間不畫線（同一項的說明），項與項之間才畫 */
:deep(.stock-cyclicality-page__table) .stock-cyclicality-page__group ~ tr > * {
  border-bottom: 0;
}

:deep(.stock-cyclicality-page__table) tbody:not(:last-child) > tr:last-child > * {
  border-bottom: 1px solid var(--app-divider);
}

.stock-cyclicality-page__note {
  font-weight: 400;
  color: var(--el-text-color-secondary);
}

:deep(.stock-cyclicality-page__table) .stock-cyclicality-page__measure {
  width: 100%;
  padding-left: 32px;
  font-weight: 400;
  color: var(--el-text-color-regular);
}

/* 個股頁的圖比卡片高：圖面 14rem（手機 12rem 也看得清十個點） */
.stock-cyclicality-page__trend {
  --cycle-trend-height: 14rem;
}
</style>
