<script setup lang="ts">
import type { StockBookValueBreakdownResponse } from '#shared/types/stock-equity-composition'

// /stock/{code}/equity-source — 淨值從哪來（2026-09-27「我想要有一個圖表 可以呈現推升淨值成長的組成，
// 我希望是個堆疊柱狀圖，可以顯示出趨勢組成」）。
//
// 兩張圖先做在 /balance-sheet 上，同日搬過來——「不要放在 balance-sheet，這樣會讓原本的稽核用意失焦」，
// 而且同一輪指名財務報表那一組「就讓它忠實還原 XBRL 的內容就好」。那一組（financial-statements／
// balance-sheet／income-statement／cash-flow-statement）現在是純還原，不放任何衍生分析。
//
// 這一頁是成長動能那一組的關係頁，跟 /dividend-source 之於配息、/cash-cycle 之於營運週轉同一個位置。
// 開自己的 slug 而不是改寫 /equity-growth：那一頁在 METRIC_PAGES 裡，同一個 slug 不能同時屬於兩種
// 註冊表（assertMetricPagesDisjoint 在擋這件事）。
//
// 2026-10-14 拆頁（使用者：「equity-source 這個交代太多東西 要先拆開，一樣慣例 一個圖 一個表格」）：原本三段——存量的淨值組成、
// 流量的每股淨值逐年變動、淨值成長 vs 每股淨值成長。存量搬到 /equity-composition（跟資產、負債組成同一套元件）；成長率對照併進
// /equity-growth（那一頁本來就是淨值成長年增率對照每股淨值成長年增率，同一張圖）。這一頁只留流量，因為它才是在回答「從哪來」：
//
//   流量（元／股）這一年淨值為什麼變多變少  期初 + 淨利 + OCI + 股利 + 增資 + 股數變動 + 其他 = 期末
//
// 存量那張分不出「賺得少」和「配得多」——保留盈餘長得慢，兩種原因在圖上長得一模一樣。流量把淨利和股利拆開，正好補上。
//
// 三件量出來、直接決定版面的事（2026-09-27）：
//   1. **其他權益可以是負的**（匯率換算差額）。2330 六年有四年為負（淨值組成那一頁的負軸是真資料）。
//   2. **減資年度會讓「最大的驅動項」不是淨利。** 2432 的 2021 年每股淨值 4.73 → 96.48，本期淨利
//      只有 1.69，推上去的是股數變動 63.11。答句因此報絕對值最大的兩項，不寫死淨利與股利。
//   3. **`other` 非零不一定是實質調整。** 上游讓它吸收進位差額，0.01~0.03 那一段分不出來；但
//      144 列裡有 80 列的 |other| > 0.03，那些是真的。文案不把「其他」講成「特殊調整」。
// 段落順序一律「先圖表、再表格」（2026-09-27 直接指示，這一頁第一版寫反了被指正）。圖先回答
// 趨勢長什麼樣，表格是要核對數字的人往下看的；表格在前會讓讀者先撞上一面數字牆。
// SSR 表格仍然必須在（ssrTables >= 1 是站台檢查的硬條件，圖表本身爬蟲讀不到），只是排在圖後面。
const TOPIC = '淨值從哪來'

const route = useRoute()
const code = computed(() => String(route.params.code))
const { stock, profile, stockShortName, stockPending, isFavorite, toggleFavorite } = useStockDetailSummary(code)
const { data: filterSchema } = await useFilterSchema()

// 頁尾（2026-10-11 統一進 StockPageFooter）：來源取每股淨值這支的型錄來源；頁尾前的定義也是它（同其他個股頁的模板）
const dataSources = computed(() => collectMetricSources(filterSchema.value?.categories ?? [], ['bvps']))
const definition = computed(() => firstSentence(findMetricInSchema(filterSchema.value?.categories ?? [], 'bvps')?.metric.description))
const footerLinks = computed(() => [
  { to: metricPath('bvps'), label: '每股淨值怎麼看（新手專區）' },
  { to: `/stock/${code.value}/equity-composition`, label: '淨值組成' },
  { to: `/stock/${code.value}/equity-growth`, label: '淨值成長年增率' },
  { to: `/stock/${code.value}/balance-sheet`, label: `${stockShortName.value} ${code.value} 最新一期的資產負債表` },
  { to: `/learn/dividend-source/${code.value}`, label: '配息從哪來' }
])

// await 在 page top-level：同 key 的 useAsyncData 沒 await 而被多個同時掛載的子元件呼叫會靜默卡在初始值（2026-09-09 根因過一次）。
const { data: breakdown, error: breakdownError, refresh: refreshBreakdown } = await useAsyncData(
  () => `stock-book-value-breakdown-${code.value}`,
  () => $fetch<StockBookValueBreakdownResponse>(`/api/stock/${code.value}/book-value-breakdown`),
  { watch: [code], default: () => null }
)
// 讀取失敗交給全站彈窗（2026-10-11）
watchLoadFailure(() => `stock-book-value-breakdown:${code.value}`, () => breakdownError.value, refreshBreakdown)

const flowEntries = computed(() => breakdown.value?.entries ?? [])

const flowQuestion = computed(() => `${stockShortName.value}（${code.value}）的每股淨值這幾年為什麼變多或變少？`)

const flowAnswer = computed(() => {
  const last = flowEntries.value.at(-1)
  if (!last) return null
  const change = last.closingBvps - last.openingBvps
  const sign = change >= 0 ? '增加' : '減少'
  // 取絕對值最大的兩項，不寫死淨利與股利。寫死會在兩種情況出錯：減資年度（見檔頭第 2 點），以及
  // 一般年度最大的本來就是淨利、於是同一個數字講兩次。
  const top = bookValueFlowLayers(flowEntries.value)
    .map(layer => ({ name: layer.name, value: layer.values.at(-1) ?? 0 }))
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
    .slice(0, 2)
    .map(item => `${item.name} ${item.value} 元`)
    .join('與')
  return `${last.fiscalYear} 年每股淨值從 ${last.openingBvps} 元變成 ${last.closingBvps} 元、${sign} ${Math.abs(change).toFixed(2)} 元。變動最大的兩項是${top}。金額都是元／股，並已換算到目前的股數基準，所以逐年可以直接相比。`
})

const { breadcrumbs } = useStockPageSeo({
  code,
  shortName: stockShortName,
  topic: TOPIC,
  titleKeywords: '每股淨值的逐年變動與來源',
  pathSuffix: '/equity-source',
  stock,
  summary: computed(() => null),
  description: computed(() => clampDescription(flowAnswer.value
    ?? `${stockShortName.value}（${code.value}）目前沒有可以拆解每股淨值逐年變動的申報資料。每股淨值的逐年變動來自權益變動表。`)),
  sectorCode: computed(() => profile.value?.sectorCode ?? null)
})
</script>

<template>
  <div v-loading="stockPending" class="app-page stock-equity-source-page">
    <template v-if="stockPending" />
    <SharedStockNotFound v-else-if="!stock" />

    <template v-else>
      <StockSummaryCard :stock="stock" :is-emerging="profile?.isEmerging ?? null" :is-favorite="isFavorite" :short-name="stockShortName" :topic="TOPIC" @toggle-favorite="toggleFavorite" />
      <StockPageNav :code="code" />
      <StockBreadcrumb :items="breadcrumbs" />

      <StockQuestionSection v-if="flowAnswer" id="stock-book-value-breakdown" :question="flowQuestion" :answer="flowAnswer">
        <StockBookValueFlowChart :entries="flowEntries" />
        <SharedTableScroll :label="`${stockShortName} ${code} 的每股淨值變動拆解（元／股）`">
          <table class="seo-table" data-ssr-table>
            <caption class="visually-hidden">{{ stockShortName }} {{ code }} 的每股淨值變動拆解（元／股）</caption>
            <thead>
              <tr>
                <th scope="col">年度</th>
                <th scope="col">期初</th>
                <th scope="col">本期淨利</th>
                <th scope="col">現金股利</th>
                <th scope="col">其他綜合損益</th>
                <th scope="col">增資</th>
                <th scope="col">股數變動</th>
                <th scope="col">其他</th>
                <th scope="col">期末</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="entry in flowEntries" :key="entry.fiscalYear">
                <th scope="row">{{ entry.fiscalYear }}</th>
                <td>{{ entry.openingBvps }}</td>
                <td>{{ entry.netIncome }}</td>
                <td>{{ entry.cashDividends }}</td>
                <td>{{ entry.otherComprehensiveIncome }}</td>
                <td>{{ entry.capitalIssued }}</td>
                <td>{{ entry.shareCountEffect }}</td>
                <td>{{ entry.other }}</td>
                <td>{{ entry.closingBvps }}</td>
              </tr>
            </tbody>
          </table>
        </SharedTableScroll>
      </StockQuestionSection>
      <StockQuestionSection v-else-if="!breakdownError" id="stock-book-value-breakdown" :question="flowQuestion">
        <p class="stock-answer">目前沒有這檔股票可以拆解每股淨值逐年變動的申報資料。</p>
      </StockQuestionSection>

      <StockQuestionSection id="stock-equity-source-more" question="這些數字是從哪份報表來的？" answer="每股淨值的逐年變動來自權益變動表，整理自公開資訊觀測站（MOPS）的公司申報資料。" />
      <StockMetricGuide id-prefix="stock-equity-source" topic="每股淨值" :definition="definition ? [definition] : []" />
      <StockPageFooter :sources="dataSources" :links="footerLinks" />
    </template>
  </div>
</template>
