<script setup lang="ts">
import { clampDescription } from '~/utils/stock-digest'
import type { StockBookValueBreakdownResponse, StockEquityCompositionResponse } from '#shared/types/stock-equity-composition'

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
// **兩張圖，兩個問題，所以是兩段而不是一個切換。** 切換會把一半的答案藏掉：
//
//   存量（億元）  此刻的淨值由什麼構成      股本 + 資本公積 + 保留盈餘 + 其他權益 − 庫藏股 = 淨值
//   流量（元／股）這一年淨值為什麼變多變少  期初 + 淨利 + OCI + 股利 + 增資 + 股數變動 + 其他 = 期末
//
// 存量那張分不出「賺得少」和「配得多」——保留盈餘長得慢，兩種原因在圖上長得一模一樣。流量那張把
// 淨利和股利拆開，正好補上。反過來流量看不到累積的結果。兩張合起來才是完整的答案。
//
// 三件量出來、直接決定版面的事（2026-09-27）：
//   1. **其他權益可以是負的**（匯率換算差額）。2330 六年有四年為負，堆疊圖的負軸是真資料。
//   2. **減資年度會讓「最大的驅動項」不是淨利。** 2432 的 2021 年每股淨值 4.73 → 96.48，本期淨利
//      只有 1.69，推上去的是股數變動 63.11。答句因此報絕對值最大的兩項，不寫死淨利與股利。
//   3. **`other` 非零不一定是實質調整。** 上游讓它吸收進位差額，0.01~0.03 那一段分不出來；但
//      144 列裡有 80 列的 |other| > 0.03，那些是真的。文案不把「其他」講成「特殊調整」。
const TOPIC = '淨值從哪來'

const route = useRoute()
const router = useRouter()
const code = computed(() => String(route.params.code))
const { stock, profile, stockShortName, stockPending, isFavorite, toggleFavorite } = useStockDetailSummary(code)
await useFilterSchema()

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

// 堆疊層的順序就是視覺權重：第一層拿強調色。保留盈餘排第一，因為這一段問的就是「自己賺的還是股東
// 投的」，只有它在回答。庫藏股在恆等式裡是減項，所以送負值進去，會疊到零軸下面。
const stockLayers = computed(() => [
  { name: '保留盈餘', values: periods.value.map(p => Math.round(p.retainedEarnings / YI)) },
  { name: '資本公積', values: periods.value.map(p => Math.round(p.capitalReserve / YI)) },
  { name: '股本', values: periods.value.map(p => Math.round(p.issuedCapital / YI)) },
  { name: '其他權益', values: periods.value.map(p => Math.round(p.otherEquity / YI)) },
  { name: '庫藏股', values: periods.value.map(p => -Math.round(p.treasuryShares / YI)) }
])

// ---- 每股淨值的逐年變動（流量）--------------------------------------------------------------
const { data: breakdown } = await useAsyncData(
  () => `stock-book-value-breakdown-${code.value}`,
  () => $fetch<StockBookValueBreakdownResponse>(`/api/stock/${code.value}/book-value-breakdown`),
  { watch: [code], default: () => null }
)

const flowEntries = computed(() => breakdown.value?.entries ?? [])

// 六個中間項，順序＝視覺權重。淨利排第一（拿強調色），股利第二——這兩個就是「賺得多」與「配得多」
// 的分野，也正是上面那張圖分不出來的東西。增資與股數變動是兩件事（前者真的有錢進來，後者只是分母
// 變了），bff-ts 特別強調過，不合併。
const flowLayers = computed(() => [
  { name: '本期淨利', values: flowEntries.value.map(e => e.netIncome) },
  { name: '現金股利', values: flowEntries.value.map(e => e.cashDividends) },
  { name: '其他綜合損益', values: flowEntries.value.map(e => e.otherComprehensiveIncome) },
  { name: '增資', values: flowEntries.value.map(e => e.capitalIssued) },
  { name: '股數變動', values: flowEntries.value.map(e => e.shareCountEffect) },
  { name: '其他', values: flowEntries.value.map(e => e.other) }
])

const flowQuestion = computed(() => `${stockShortName.value}（${code.value}）的每股淨值這幾年為什麼變多或變少？`)

const flowAnswer = computed(() => {
  const last = flowEntries.value.at(-1)
  if (!last) return null
  const change = last.closingBvps - last.openingBvps
  const sign = change >= 0 ? '增加' : '減少'
  // 取絕對值最大的兩項，不寫死淨利與股利。寫死會在兩種情況出錯：減資年度（見檔頭第 2 點），以及
  // 一般年度最大的本來就是淨利、於是同一個數字講兩次。
  const top = flowLayers.value
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
  titleKeywords: '淨值組成與每股淨值的逐年變動',
  pathSuffix: '/equity-source',
  stock,
  summary: computed(() => null),
  description: computed(() => clampDescription(equityAnswer.value ?? flowAnswer.value
    ?? `${stockShortName.value}（${code.value}）目前沒有可以拆解淨值組成的申報資料。淨值的組成來自資產負債表的權益段，逐年變動來自權益變動表。`)),
  sectorCode: computed(() => profile.value?.industry ?? null)
})
</script>

<template>
  <div v-loading="stockPending" class="stock-equity-source-page">
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
      <StockSummaryCard :stock="stock" :is-favorite="isFavorite" :short-name="stockShortName" :topic="TOPIC" @toggle-favorite="toggleFavorite" />
      <StockPageNav :code="code" />
      <StockBreadcrumb :items="breadcrumbs" />

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
        <StockStackedBarChart
          :categories="periods.map(period => period.label)"
          :layers="stockLayers"
          unit="億元"
          :tooltip-header="index => `${periods[index]?.label}　淨值 ${toYi(periods[index]?.equity ?? 0)} 億`"
        />
      </StockQuestionSection>

      <StockQuestionSection v-if="flowAnswer" id="stock-book-value-breakdown" :question="flowQuestion" :answer="flowAnswer">
        <SharedTableScroll :label="`${stockShortName} ${code} 的每股淨值逐年變動`">
          <table class="seo-table" data-ssr-table>
            <caption>{{ stockShortName }} {{ code }} 每股淨值的逐年變動（元／股，已換算到目前股數基準）</caption>
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
        <StockStackedBarChart
          :categories="flowEntries.map(entry => String(entry.fiscalYear))"
          :layers="flowLayers"
          unit="元／股"
          :tooltip-header="index => `${flowEntries[index]?.fiscalYear} 年　${flowEntries[index]?.openingBvps} → ${flowEntries[index]?.closingBvps} 元`"
        />
      </StockQuestionSection>

      <StockQuestionSection v-if="!equityAnswer && !flowAnswer" id="stock-equity-source-empty" :question="equityQuestion">
        <p class="stock-answer">目前沒有這檔股票可以拆解淨值組成的申報資料。</p>
      </StockQuestionSection>

      <StockQuestionSection id="stock-equity-source-more" question="這些數字是從哪份報表來的？" answer="淨值的組成來自資產負債表的權益段，每股淨值的逐年變動來自權益變動表，兩者都整理自公開資訊觀測站（MOPS）的公司申報資料。">
        <ul class="stock-equity-source-page__link-list">
          <li><NuxtLink :to="`/stock/${code}/balance-sheet`">看 {{ stockShortName }} {{ code }} 最新一期的資產負債表原始數字</NuxtLink></li>
          <li><NuxtLink :to="`/stock/${code}/equity-growth`">看 {{ stockShortName }} {{ code }} 的淨值成長年增率</NuxtLink></li>
          <li><NuxtLink :to="`/stock/${code}/dividend-source`">看 {{ stockShortName }} {{ code }} 的配息從哪來</NuxtLink></li>
        </ul>
      </StockQuestionSection>
    </template>
  </div>
</template>

<style scoped>
.stock-equity-source-page {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.stock-equity-source-page__link-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.stock-equity-source-page__link-list a {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  color: var(--el-color-primary-dark-2);
  text-decoration: underline;
  text-underline-offset: 3px;
}
</style>
