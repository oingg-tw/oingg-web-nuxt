<script setup lang="ts">
import type { MetricsHistoryEntry } from '#shared/types/metrics-history'

// /stock/{code}/cash-cycle — 現金循環的組成（2026-09-26「存貨天數加收現天數等於營運週期 所以 營運週期
// 可以做成拆解？」→「我希望他跟杜邦分析一樣 是可以讓人看這個指標就學到東西」）。
//
// 營運周轉那一組的關係頁，跟 /margins 之於三率、/solvency 之於安全韌性、/dupont 之於 ROE 同一個位置。
// 開在自己的 slug 而不是改寫 /operating-cycle：那一頁是單指標頁，在 METRIC_PAGES 裡，改寫它會讓同一個
// slug 同時屬於兩種註冊表（assertMetricPagesDisjoint 就是在擋這件事）。
//
// 為什麼這一組值得一個關係頁：**它是一條可以自己驗算的恆等鏈**，跟損益表那條一樣。
//
//     存貨天數 ＋ 收現天數 ＝ 營運週期
//     營運週期 － 付現天數 ＝ 現金轉換循環
//
// 2330 近四季實測閉合到小數點後兩位（72.56 + 26.49 = 99.05；99.05 − 21.03 = 78.02）。抽樣 15 家中
// 11 家可畫、全部閉合。恆等式成立是這一頁說得出口的前提——本站不做評等，能講的是「這些數字之間的
// 關係是什麼」，而關係要真的成立才講得下去。
//
// 三件實測出來、直接決定版面的事：
//   1. **現金轉換循環可以是負的，而且那是最值得看的情況。** 2603 長榮 −19.4 天＝先收到客戶的錢才付給
//      供應商，等於供應商在幫它周轉。抽樣 11 家就有 1 家，不是邊緣案例——圖表必須能往零以下走，不能
//      當成錯誤擋掉。
//   2. **金融、租賃業畫不出來。** 2881 富邦金、5871 中租、2207 和泰車全部是 null，因為它們沒有存貨與
//      應收帳款這個概念。要一句「這個行業不適用」而不是空圖，跟 /dupont 對金融業的處理同一個做法。
//   3. **上游缺口會讓整段消失。** 2412 中華電因為缺 114Q1／Q2 兩季財報，最近六期所有 TTM 指標都是
//      null。那不是這一頁的問題，但畫面上要讀得出來是「還沒收到」而不是「這家公司沒有這個數字」。
const TOPIC = '現金循環的組成'

const route = useRoute()
const code = computed(() => String(route.params.code))
const { stock, profile, stockShortName, stockPending, isFavorite, toggleFavorite } = useStockDetailSummary(code)
const { series, readFailed: seriesReadFailed, refresh: refreshSeries } = await useStockPageDigest(code, 'cash-cycle', { shortName: stockShortName })
const { data: filterSchema } = await useFilterSchema()
// 頁尾的資料來源（2026-10-11 補上，原本這頁沒寫）：這一頁畫的那組指標各自的來源，從型錄來
const dataSources = computed(() => collectMetricSources(filterSchema.value?.categories ?? [], series.value?.groups?.TTM_CYCLE_20?.codes ?? []))
// 這一頁直接讀 TTM_CYCLE_20 那一組：整包讀不到、或伺服器那一組讀不到（null，不是空陣列）都是讀取失敗，不是「沒有這組數字」
const cycleReadFailed = computed(() => seriesReadFailed.value || series.value?.groups?.TTM_CYCLE_20 === null)
watchLoadFailure(() => `stock-cash-cycle:${code.value}`, () => series.value?.groups?.TTM_CYCLE_20 === null, refreshSeries)

const entries = computed<MetricsHistoryEntry[]>(() => series.value?.groups?.TTM_CYCLE_20?.entries ?? [])

// 頁尾的相關頁面（2026-10-12）：上面說明裡提到的五個天數，各自有指標頁
// 頁尾第一個連結是新手專區的完整說明（2026-10-12「把教學、說明與指標頁面分開」）：這一頁只留一句定義
const TOPIC_GUIDE = findLearnTopic('cash-cycle')!
const footerLinks = computed(() => [
  { to: learnTopicPath(TOPIC_GUIDE.slug), label: `${TOPIC_GUIDE.topic}怎麼看（新手專區）` },
  { to: `/stock/${code.value}/inventory-days`, label: '存貨週轉天數' },
  { to: `/stock/${code.value}/receivables-days`, label: '應收帳款收現天數' },
  { to: `/stock/${code.value}/payables-days`, label: '應付帳款付現天數' },
  { to: `/stock/${code.value}/operating-cycle`, label: '營運週期' },
  { to: `/stock/${code.value}/cash-conversion-cycle`, label: '現金轉換循環' }
])
// 最新一期「五個數字都在」的那一期。不是單純取最後一期：上游缺口會讓最近幾期整片是 null（2412 就是
// 這樣），取最後一期會得到一頁空白，往回找則會顯示它最後一次算得出來的那一期，並在旁邊標明是哪一期。
const latest = computed(() =>
  [...entries.value].reverse().find(entry =>
    ['inventoryDays', 'receivablesDays', 'payablesDays', 'operatingCycle', 'cashConversionCycle']
      .every(codeName => entry.values[codeName]?.value != null)) ?? null)

const val = (codeName: string): number | null => latest.value?.values[codeName]?.value ?? null
const inventoryDays = computed(() => val('inventoryDays'))
const receivablesDays = computed(() => val('receivablesDays'))
const payablesDays = computed(() => val('payablesDays'))
const operatingCycle = computed(() => val('operatingCycle'))
const cashCycle = computed(() => val('cashConversionCycle'))
const hasCycle = computed(() => latest.value !== null)

const periodLabel = computed(() => (latest.value ? `${latest.value.fiscalYear} Q${latest.value.fiscalQuarter}` : null))
// 最新一期有沒有值。沒有就代表上游缺口——畫面上要說得出是「還沒收到」而不是「沒有這個數字」。
const newestPeriod = computed(() => {
  const last = entries.value.at(-1)
  return last ? `${last.fiscalYear} Q${last.fiscalQuarter}` : null
})
const isStale = computed(() => hasCycle.value && newestPeriod.value !== null && periodLabel.value !== newestPeriod.value)

const days = (value: number | null): string => (value === null ? '－' : `${value.toFixed(1)} 天`)

// 恆等式自己驗一次再宣稱。容許值取 ±0.05 天：三個子項各自四捨五入到小數點後兩位，相加的誤差不會超過
// 這個量級。對不起來就不印算式——跟 /dividend-source 的 reconciles() 同一條原則：不宣稱，不是不顯示。
const closes = (parts: number[], total: number | null): boolean =>
  total !== null && Math.abs(parts.reduce((a, b) => a + b, 0) - total) <= 0.05

const cycleCloses = computed(() =>
  inventoryDays.value !== null && receivablesDays.value !== null
  && closes([inventoryDays.value, receivablesDays.value], operatingCycle.value))
const cashCloses = computed(() =>
  operatingCycle.value !== null && payablesDays.value !== null
  && closes([operatingCycle.value, -payablesDays.value], cashCycle.value))

// 杜邦那一頁教得動人的關鍵：答句把算式用這家公司的真實數字念出來，讀者看著自己在看的公司，恆等式當場
// 成立。這一頁照做。
const cycleAnswer = computed(() => {
  if (!hasCycle.value) return null
  const base = `${stockShortName.value}的貨平均要放 ${days(inventoryDays.value)}才賣出去，賣出去之後還要再等 ${days(receivablesDays.value)}才收到錢。`
  return cycleCloses.value
    ? `${base}兩段加起來 ${days(operatingCycle.value)}，這一趟就叫營運週期。`
    : `${base}營運週期是 ${days(operatingCycle.value)}。`
})

const cashAnswer = computed(() => {
  if (!hasCycle.value || cashCycle.value === null) return null
  // 負數不是「墊錢的日子是負幾天」——那句話沒有意義。負數代表供應商給的帳期比整趟生意還長，方向要
  // 整句反過來講，不是在正數的句子後面補一句。
  if (cashCycle.value < 0) {
    return cashCloses.value
      ? `供應商讓公司晚 ${days(payablesDays.value)}再付錢，比整趟 ${days(operatingCycle.value)}還長 ${days(Math.abs(cashCycle.value))}。所以這門生意不但不用自己墊錢，還多出這幾天的貨款可以先拿去用。`
      : `營運週期 ${days(operatingCycle.value)}，應付帳款付現天數 ${days(payablesDays.value)}，現金轉換循環 ${days(cashCycle.value)}——負數代表公司先收到錢才付出去。`
  }
  return cashCloses.value
    ? `這 ${days(operatingCycle.value)}裡，有 ${days(payablesDays.value)}是供應商讓公司晚點再付的，剩下的 ${days(cashCycle.value)}才是公司自己要墊錢的日子。`
    : `營運週期 ${days(operatingCycle.value)}，應付帳款付現天數 ${days(payablesDays.value)}，現金轉換循環 ${days(cashCycle.value)}。`
})

// 天數換算成「一年的幾分之幾」。這是這一頁比杜邦多做的一件事：天數是抽象的，而「相當於把一年營收的
// 兩成卡在生意裡」是讀者有感覺的量級。用 365 天換算，不需要任何額外資料。
const cashShare = computed(() =>
  cashCycle.value === null ? null : Math.round((cashCycle.value / 365) * 1000) / 10)

const rows = computed(() => {
  if (!hasCycle.value) return []
  return [
    { op: '', label: '存貨週轉天數', value: days(inventoryDays.value), from: '貨進倉庫到賣出去，平均放幾天', to: `/stock/${code.value}/inventory-days` },
    { op: '＋', label: '應收帳款收現天數', value: days(receivablesDays.value), from: '賣出去到收到錢，平均等幾天', to: `/stock/${code.value}/receivables-days` },
    { op: '＝', label: '營運週期', value: days(operatingCycle.value), from: cycleCloses.value ? '上面兩段相加' : '財報申報值。這一期它不等於上面兩段相加', to: `/stock/${code.value}/operating-cycle` },
    { op: '－', label: '應付帳款付現天數', value: days(payablesDays.value), from: '跟供應商進貨到付錢，平均隔幾天', to: `/stock/${code.value}/payables-days` },
    { op: '＝', label: '現金轉換循環', value: days(cashCycle.value), from: cashCloses.value ? '營運週期減掉付現天數' : '財報申報值', to: `/stock/${code.value}/cash-conversion-cycle` }
  ]
})

// 逐期表：只列五個數字齊全的期別。缺一個就整列不印——這一頁的主題是它們之間的關係，印一列殘缺的數字
// 會讓讀者以為關係算不出來。
const history = computed(() =>
  [...entries.value].reverse()
    .filter(entry => ['inventoryDays', 'receivablesDays', 'payablesDays', 'operatingCycle', 'cashConversionCycle']
      .every(codeName => entry.values[codeName]?.value != null))
    .map(entry => ({
      period: `${entry.fiscalYear} Q${entry.fiscalQuarter}`,
      inventory: entry.values.inventoryDays!.value!,
      receivables: entry.values.receivablesDays!.value!,
      payables: entry.values.payablesDays!.value!,
      cycle: entry.values.operatingCycle!.value!,
      cash: entry.values.cashConversionCycle!.value!
    })))

const historyText = computed(() => historyTableText({ shortName: stockShortName.value, code: code.value, topic: '現金循環', basis: '近四季', count: history.value.length, from: history.value.at(-1)?.period ?? '', to: history.value[0]?.period ?? '' }))
const historyAnswer = computed(() => (history.value.length < 2 ? null : historyText.value.answer))
// 拆解表的表名（caption 藏起來，同 SharedTableScroll 的 label；2026-10-13 統一）
const breakdownLabel = computed(() => `${stockShortName.value} ${code.value} ${periodLabel.value ?? ''} 的現金循環拆解（近四季）`)

const { breadcrumbs } = useStockPageSeo({
  code,
  shortName: stockShortName,
  topic: TOPIC,
  titleKeywords: '現金循環 存貨天數與收款付款天數',
  pathSuffix: '/cash-cycle',
  stock,
  summary: computed(() => null),
  description: computed(() =>
    clampDescription(
      hasCycle.value
        ? `${stockShortName.value}（${code.value}）的存貨週轉天數 ${days(inventoryDays.value)}、應收帳款收現天數 ${days(receivablesDays.value)}，合計營運週期 ${days(operatingCycle.value)}；減去應付帳款付現天數 ${days(payablesDays.value)}後，現金轉換循環為 ${days(cashCycle.value)}，資料期間 ${periodLabel.value}。`
        : `${stockShortName.value}（${code.value}）目前沒有可以計算現金循環的資料。金融、租賃業沒有存貨與應收帳款的概念，這組數字對它們不適用。`
    )
  ),
  sectorCode: computed(() => profile.value?.sectorCode ?? null)
})
</script>

<template>
  <div v-loading="stockPending" class="app-page app-page--compact stock-cash-cycle-page">
    <template v-if="stock">
      <StockSummaryCard :stock="stock" :is-emerging="profile?.isEmerging ?? null" :is-favorite="isFavorite" :short-name="stockShortName" :topic="TOPIC" @toggle-favorite="toggleFavorite" />
      <StockPageNav :code="code" />
      <StockBreadcrumb :items="breadcrumbs" />

      <StockQuestionSection id="stock-cash-cycle-value" :question="`${stockShortName}（${code}）的錢，從進貨到收回來要幾天？`" :answer="cycleAnswer">
        <!-- 互動時間軸包在卡片裡，跟 /dividend-source 同一個理由（2026-09-26「希望用戶知道底下的上下
             一步跟圖表一組的」）：標題、圖、說明、按鈕是同一個元件的四部分，散在區塊裡沒有邊界的話
             按鈕讀起來像頁面層級的控制項。 -->
        <el-card v-if="hasCycle" shadow="never" class="stock-cash-cycle-page__chart-card">
          <StockCashCycleTimeline
            :inventory-days="inventoryDays"
            :receivables-days="receivablesDays"
            :payables-days="payablesDays"
            :operating-cycle="operatingCycle"
            :cash-cycle="cashCycle"
            :period-label="periodLabel"
          />
        </el-card>
        <p v-if="!hasCycle && !cycleReadFailed" class="stock-answer">
          這家公司沒有這組數字。金融、保險、租賃業沒有存貨與應收帳款這個概念，這幾個天數對它們不適用。
        </p>
        <p v-else-if="isStale" class="stock-answer">
          上面這組數字是 {{ periodLabel }} 的；最新一期（{{ newestPeriod }}）沒有數值。
        </p>
      </StockQuestionSection>

      <StockQuestionSection v-if="historyAnswer" id="stock-cash-cycle-history" :question="historyText.question" :answer="historyAnswer">
        <SharedTableScroll :label="historyText.label">
          <table class="seo-table" data-ssr-table>
            <caption class="visually-hidden">{{ historyText.label }}</caption>
            <thead>
              <tr>
                <th scope="col">期別</th>
                <th scope="col">存貨天數</th>
                <th scope="col">收現天數</th>
                <th scope="col">營運週期</th>
                <th scope="col">付現天數</th>
                <th scope="col">現金轉換循環</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in history" :key="row.period">
                <th scope="row">{{ row.period }}</th>
                <td class="seo-table__num">{{ row.inventory.toFixed(1) }}</td>
                <td class="seo-table__num">{{ row.receivables.toFixed(1) }}</td>
                <td class="seo-table__num">{{ row.cycle.toFixed(1) }}</td>
                <td class="seo-table__num">{{ row.payables.toFixed(1) }}</td>
                <td class="seo-table__num">{{ row.cash.toFixed(1) }}</td>
              </tr>
            </tbody>
          </table>
        </SharedTableScroll>
      </StockQuestionSection>

      <StockQuestionSection v-if="hasCycle" id="stock-cash-cycle-chain" question="這幾天裡，哪幾天是公司自己出的錢？" :answer="cashAnswer">
        <SharedTableScroll :label="breakdownLabel">
          <table class="seo-table" data-ssr-table>
            <caption class="visually-hidden">{{ breakdownLabel }}</caption>
            <thead>
              <tr>
                <th scope="col" aria-hidden="true"></th>
                <th scope="col">項目</th>
                <th scope="col">天數</th>
                <th scope="col">怎麼來的</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in rows" :key="row.label">
                <td class="stock-cash-cycle-page__op" aria-hidden="true">{{ row.op }}</td>
                <th scope="row">{{ row.label }}</th>
                <td class="seo-table__num">{{ row.value }}</td>
                <td>
                  {{ row.from }}
                  <NuxtLink :to="row.to" class="hub-inline-link">看這一項</NuxtLink>
                </td>
              </tr>
            </tbody>
          </table>
        </SharedTableScroll>

        <p v-if="cashShare !== null && cashShare > 0" class="stock-answer">
          換個講法：{{ days(cashCycle) }}大約是一年的 {{ cashShare }}%，也就是公司隨時有相當於 {{ cashShare }}% 年營業額的錢卡在這門生意裡動不了。
        </p>
        <p v-else-if="cashShare !== null && cashShare < 0" class="stock-answer">
          換個講法：這相當於一年營業額的 {{ Math.abs(cashShare) }}%，是公司可以一直拿在手上運用、還沒付出去的貨款。
        </p>
      </StockQuestionSection>


      <!-- 一句定義（2026-10-12 起完整說明在新手專區 /learn/cash-cycle，頁尾第一個連結）。金融、保險、租賃業不適用寫在上面的空資料說明裡。 -->
      <StockMetricGuide id-prefix="stock-cash-cycle" :topic="TOPIC_GUIDE.topic" :definition="[TOPIC_GUIDE.summary]" />
      <StockPageFooter :sources="dataSources" :links="footerLinks" />
    </template>

    <SharedStockNotFound v-else-if="!stockPending" />
  </div>
</template>

<style scoped>

.stock-cash-cycle-page__chart-card {
  border-radius: 12px;
}

/* 運算子獨立一欄，跟 /dividend-source 的損益表同一個做法：<th scope="row"> 是那一列的名字，
   「＋應收帳款收現天數」不是一個可搜尋的字串。 */
.stock-cash-cycle-page__op {
  width: 1%;
  padding-right: 0;
  text-align: center;
  color: var(--el-text-color-secondary);
}
</style>
