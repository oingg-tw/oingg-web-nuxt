<script setup lang="ts">
import { use } from 'echarts/core'
import { SVGRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent, MarkLineComponent } from 'echarts/components'
import type { EcbRateCyclePageData } from '#shared/types/hub'
import { clampDescription } from '~/utils/stock-digest'
import { getAccentColor, getChartInk, CHART_TOOLTIP, CHART_TOOLTIP_INK } from '~/utils/chart-palette'

// /macro/ecb-policy-rate — 歐洲央行升降息紀錄（2026-09-30）. 總經特區 的第十頁，跟央行與聯準會
// 那兩頁同一種形狀：離散的決議事件畫成階梯線，加一張完整歷史的表。
//
// **圖上畫存款機制利率（DFR），不是主要再融資利率（MRO）。** 2024 年起 ECB 自己的政策訊號就是
// DFR，畫 MRO 會讓最近幾次真的調整在線上看起來沒動。表格三支都列、三個幅度也都列，讀者拿我們的
// 數字去對新聞上的 MRO 才對得起來——所以頁面要講明白代表利率是哪一支。
//
// 三件只有量過才知道的事（實測 69 列，與 gov-ts 的正式庫數字逐項吻合）：
//   21 列的主要再融資是「最低投標利率」（2000-06-28 ~ 2008-10-14 的變動利率標售），不是固定標售
//      利率，所以那幾列的欄位標示要換字。
//    7 列的 MRO 幅度是 0——那幾次只調利率走廊的上下緣。用 `changeBp !== 0` 過濾會整個吃掉。
//    5 列的存款機制利率是負的（2014–2022），所以顯示不能假設非負。
//   2000-06-28 三支幅度都是 0，變的只有標售機制（旗標 false → true）：那是制度轉換點不是雜訊。
//
// 跟美國那頁相反的一點：1999-01-01 是歐元啟用日，也是這份資料的真實起點，所以這一頁的表格就是
// 完整歷史，不需要「本頁自 X 起」那句。
//
// NO CAUSAL CLAIM，同 policy-rate.vue：圖上的指數是台灣的、利率是歐元區的。
use([SVGRenderer, LineChart, GridComponent, TooltipComponent, LegendComponent, MarkLineComponent])

const { data, error } = await useFetch<EcbRateCyclePageData>('/api/hub/macro-ecb-policy-rate', { key: 'hub-macro-ecb-policy-rate' })
if (error.value || !data.value) throw createError({ statusCode: 503, statusMessage: '歐洲央行利率資料暫時無法取得', fatal: true })

const events = computed(() => data.value?.events ?? [])
const eventsDesc = computed(() => [...events.value].reverse())
const taiex = computed(() => data.value?.taiex ?? [])

const latest = computed(() => eventsDesc.value[0] ?? null)

const rateText = (value: number): string => `${value.toFixed(2)}%`
const optionalRate = (value: number | null): string => (value === null ? '—' : rateText(value))

// 那 21 列的主要再融資是「最低投標利率」。同一欄印兩種名字，是因為在 2000-06-28 ~ 2008-10-14 之間
// 「固定標售利率」這個東西根本不存在——照同一個名字寫會把一個當年沒有的概念套到那段歷史上。
const mroLabel = (event: { mainRefinancingIsMinimumBid: boolean }): string =>
  event.mainRefinancingIsMinimumBid ? '最低投標利率' : '主要再融資利率'
// 一碼 = 0.25% = 25bp，台灣的新聞講聯準會也用這個單位，所以兩個都給：基點是精確的，碼是讀者
// 在新聞上看到的說法。
function changeText(changeBp: number | null): string {
  if (changeBp === null) return '—'
  const sign = changeBp > 0 ? '升息' : '降息'
  const notches = Math.abs(changeBp) / 25
  const notchText = notches === 0.5 ? '半碼' : notches === 1 ? '一碼' : `${notches} 碼`
  return `${sign}${notchText}（${changeBp > 0 ? '+' : '−'}${Math.abs(changeBp)} 基點）`
}

// 用存款機制利率的幅度數升降息，不是主要再融資：圖上畫的是它，答句也該跟圖一致。
const hikes = computed(() => events.value.filter(event => (event.depositFacilityChangeBp ?? 0) > 0).length)
const cuts = computed(() => events.value.filter(event => (event.depositFacilityChangeBp ?? 0) < 0).length)
// DFR 持平、但主要再融資有動的那幾列（2026-10-01 實測 4 次，gov-ts 指出後我自己對 69 列重算過）。
// 這 4 次**不會**出現在上面的升息／降息次數裡，而其中 3 次是不折不扣的降息：
//
//   2008-10-15  DFR 3.25 持平   MRO 4.25→3.75   ← 回到固定利率標售那天
//   2009-05-13  DFR 0.25 持平   MRO 1.25→1.00   MLF 2.25→1.75
//   2013-05-08  DFR 0.00 持平   MRO 0.75→0.50   MLF 1.50→1.00
//   2013-11-13  DFR 0.00 持平   MRO 0.50→0.25   MLF 1.00→0.75
//
// 後三次當年的新聞頭條就是「ECB 降息」——DFR 已經在 0、降不下去了，ECB 只能動 MRO。所以這不是
// 資料的邊角案例，是「用單一支利率數升降息」這個做法的真正代價，必須在頁面上講出來，否則表格裡
// 會有四列沒有任何解釋的空白幅度。
const dfrFlatMroMoves = computed(() =>
  events.value.filter(event => event.depositFacilityChangeBp === 0 && (event.mainRefinancingChangeBp ?? 0) !== 0)
)
const mroOnlyCuts = computed(() => dfrFlatMroMoves.value.filter(event => (event.mainRefinancingChangeBp ?? 0) < 0).length)
// 三支幅度都是 0 的那幾列——只有 2000-06-28，變的是標售機制。1999-01-01（歐元啟用）的幅度是 null
// 不是 0，所以嚴格比較把它排除掉了，那是對的：啟用不是一次「調整」。
const regimeSwitches = computed(() =>
  events.value.filter(event =>
    event.depositFacilityChangeBp === 0 && event.mainRefinancingChangeBp === 0 && event.marginalLendingChangeBp === 0)
)

const latestAnswer = computed(() => {
  const event = latest.value
  if (!event) return null
  return `歐洲央行最近一次調整政策利率是 ${event.effectiveDate} 生效，存款機制利率 ${optionalRate(event.depositFacilityRate)}、主要再融資利率 ${optionalRate(event.mainRefinancingRate)}、邊際貸款利率 ${optionalRate(event.marginalLendingRate)}，存款機制利率${changeText(event.depositFacilityChangeBp)}。自 ${events.value[0]?.effectiveDate ?? ''} 歐元啟用起共 ${events.value.length} 次調整，其中存款機制利率升息 ${hikes.value} 次、降息 ${cuts.value} 次${dfrFlatMroMoves.value.length ? `，另有 ${dfrFlatMroMoves.value.length} 次存款機制利率沒動、只調主要再融資利率，${mroOnlyCuts.value === dfrFlatMroMoves.value.length ? '全部是調降' : `其中 ${mroOnlyCuts.value} 次是調降`}` : ''}。`
})

// 圖只從指數序列的起點畫起，而事件表是完整歷史，所以兩者的筆數不一樣——差多少筆要講出來，不然
// 讀者會以為圖漏畫了。指數序列的起點是這一支端點自己的起點（1999-01-30，實測），不是「加權指數的
// 歷史只到 1999」：gov-ts 另有一份 1987-05 起的月序列（央行月報的月平均），/macro/market-events
// 用的就是那一份。那份是月「平均」不是月底收盤，跟這一頁畫的不是同一種數字，所以不混用。
const earlierCount = computed(() => {
  const first = taiex.value[0]?.tradeDate
  return first ? events.value.filter(event => event.effectiveDate < first).length : 0
})

const spanAnswer = computed(() => {
  const list = taiex.value
  if (list.length < 2) return null
  const earlier = earlierCount.value
  return `下圖兩條線分別是台灣的加權股價指數月收盤（共 ${list.length} 個月，${list[0]!.tradeDate} 至 ${list[list.length - 1]!.tradeDate}）與歐元區的存款機制利率，畫在同一個時間軸上。利率為階梯狀，因為它只在決議生效當天改變。${earlier ? `更早的 ${earlier} 次調整沒有畫進圖裡，指數序列從 ${list[0]!.tradeDate} 才開始，它們都在下面的表格裡。` : ''}`
})

// 兩件事讀者不講就會誤會，而且都是資料本身的性質不是評論：只收有變動的決議（上游是對每日持平值
// 做 diff，維持不變的會議根本不在資料裡，gov-ts 也沒有會議日期），以及本頁的起點是 2000 年。
const tableAnswer = computed(() => {
  if (!events.value.length) return null
  const regime = regimeSwitches.value.length
  const dfrFlat = dfrFlatMroMoves.value.length
  return `以下為由新到舊的每一次調整，共 ${events.value.length} 筆，${events.value[0]?.effectiveDate ?? ''} 歐元啟用至今的完整紀錄，日期為生效日。三支利率不一定同時動：有 ${dfrFlat} 次存款機制利率的幅度是 0，變的是主要再融資或邊際貸款利率。${regime ? `另有 ${regime} 筆三支都沒動，變的是主要再融資的標售機制。` : ''}`
})

const { breadcrumbs } = useHubPageSeo({
  title: '歐洲央行升降息紀錄與台股大盤',
  description: () => clampDescription(latestAnswer.value ?? '歐洲央行歷次升降息的生效日與三支政策利率，對照台灣加權股價指數的月收盤。'),
  path: '/macro/ecb-policy-rate',
  breadcrumbs: [
    { label: '首頁', to: '/' },
    { label: '總經特區', to: '/macro' },
    { label: '歐洲央行升降息', to: '/macro/ecb-policy-rate' }
  ]
})

const { resolvedMode, color: accentColorName } = useAppTheme()
const chartInk = computed(() => getChartInk(resolvedMode.value))

interface AxisTooltipParam { dataIndex?: number }

// 雙軸的理由跟 policy-rate.vue 相同，那裡的長註解不重複：利率是階梯、是政策工具不是市場結果，
// 所以不會被誤看成第二條價格線；改成兩邊各自標準化反而會把「利率是幾趴」這個讀者真正要的數字
// 抹掉。畫在上限而不是中值：新聞與 FOMC 聲明講的都是區間，上限是其中唯一在 2008 年前後都存在
// 的那一個（2008-12-16 之前上下限相等，畫哪一個都一樣）。
const chartOption = computed(() => {
  const points = taiex.value
  const labels = points.map(point => point.tradeDate)
  const byMonth = labels.map(date => {
    let current: number | null = null
    for (const event of events.value) {
      if (event.effectiveDate <= date) current = event.depositFacilityRate
      else break
    }
    return current
  })
  const accent = getAccentColor(resolvedMode.value, accentColorName.value)
  const closes = points.map(point => point.close).filter(close => close > 0)
  const indexExtent = closes.length ? { min: Math.min(...closes), max: Math.max(...closes) } : null
  return {
    textStyle: { fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif' },
    grid: { left: 8, right: 8, top: 48, bottom: 28, containLabel: true },
    legend: { top: 0, textStyle: { color: chartInk.value.muted, fontSize: 16 } },
    tooltip: {
      trigger: 'axis',
      appendTo: 'body',
      backgroundColor: CHART_TOOLTIP.backgroundColor,
      borderColor: CHART_TOOLTIP.borderColor,
      textStyle: { color: CHART_TOOLTIP_INK.primary },
      formatter: (params: AxisTooltipParam | AxisTooltipParam[]) => {
        const index = (Array.isArray(params) ? params[0] : params)?.dataIndex ?? 0
        const point = points[index]
        if (!point) return ''
        const rate = byMonth[index] ?? null
        const decided = events.value.find(event => event.effectiveDate.slice(0, 7) === point.tradeDate.slice(0, 7))
        return `<div style="font-size:1rem"><div style="font-weight:600;margin-bottom:4px">${point.tradeDate}</div>`
          + `<div>加權指數 ${point.close.toLocaleString('zh-TW', { maximumFractionDigits: 0 })}</div>`
          + (rate === null ? '' : `<div>存款機制利率 ${rateText(rate)}</div>`)
          + (decided ? `<div style="color:${CHART_TOOLTIP_INK.secondary}">本月存款機制利率 ${changeText(decided.depositFacilityChangeBp)}</div>` : '')
          + '</div>'
      }
    },
    xAxis: {
      type: 'category',
      data: labels,
      axisLine: { lineStyle: { color: chartInk.value.baseline } },
      axisTick: { show: false },
      axisLabel: { color: chartInk.value.muted, fontSize: 16 }
    },
    yAxis: [
      {
        type: 'log',
        logBase: 10,
        name: '指數',
        nameTextStyle: { color: chartInk.value.muted, fontSize: 16 },
        ...(indexExtent ? { min: indexExtent.min, max: indexExtent.max } : {}),
        splitLine: { lineStyle: { color: chartInk.value.gridline } },
        axisLabel: { color: chartInk.value.muted, fontSize: 16, formatter: formatLogAxisTick }
      },
      {
        type: 'value',
        name: '利率 %',
        nameTextStyle: { color: chartInk.value.muted, fontSize: 16 },
        splitLine: { show: false },
        axisLabel: { color: chartInk.value.muted, fontSize: 16, formatter: (value: number) => `${value}%` }
      }
    ],
    series: [
      // 高齡友善規格（2026-09-30）：折線 ≤ 2 條、線寬 ≥ 2.5px、轉折點 8px 實心標記。
      {
        name: '加權股價指數（月收盤）',
        type: 'line',
        yAxisIndex: 0,
        showSymbol: true,
        symbolSize: 8,
        smooth: false,
        lineStyle: { width: 2.5, color: accent },
        itemStyle: { color: accent },
        data: points.map(point => point.close)
      },
      {
        name: '存款機制利率',
        type: 'line',
        yAxisIndex: 1,
        step: 'end',
        showSymbol: true,
        symbolSize: 8,
        lineStyle: { width: 2.5, type: 'dashed', color: chartInk.value.primary },
        itemStyle: { color: chartInk.value.primary },
        connectNulls: false,
        data: byMonth
      }
    ]
  }
})
</script>

<template>
  <div class="macro-ecb-policy-rate-page">
    <h1 class="macro-ecb-policy-rate-page__title">歐洲央行升降息紀錄與台股大盤</h1>
    <StockBreadcrumb :items="breadcrumbs" />
    <MacroNav />

    <section class="stock-page-section" aria-labelledby="macro-ecb-policy-rate-latest-heading">
      <h2 id="macro-ecb-policy-rate-latest-heading" class="stock-page-section__title">歐洲央行最近一次升降息是什麼時候？</h2>
      <p v-if="latestAnswer" class="hub-answer">{{ latestAnswer }}</p>
    </section>

    <section class="stock-page-section" aria-labelledby="macro-ecb-policy-rate-chart-heading">
      <h2 id="macro-ecb-policy-rate-chart-heading" class="stock-page-section__title">升降息期間台股大盤走勢如何？</h2>
      <p v-if="spanAnswer" class="hub-answer">{{ spanAnswer }}</p>
      <el-card shadow="never" class="macro-ecb-policy-rate-page__card">
        <SharedChart v-if="taiex.length > 1" class="macro-ecb-policy-rate-page__chart" :option="chartOption" autoresize />
      </el-card>
    </section>

    <section class="stock-page-section" aria-labelledby="macro-ecb-policy-rate-table-heading">
      <h2 id="macro-ecb-policy-rate-table-heading" class="stock-page-section__title">歷次升降息有哪些？</h2>
      <p v-if="tableAnswer" class="hub-answer">{{ tableAnswer }}</p>
      <SharedTableScroll label="歐洲央行政策利率歷次調整">
        <table class="seo-table" data-ssr-table>
          <caption>歐洲央行政策利率歷次調整（由新到舊，日期為生效日）</caption>
          <thead>
            <tr>
              <th scope="col">生效日</th>
              <th scope="col">存款機制利率</th>
              <th scope="col">主要再融資利率</th>
              <th scope="col">邊際貸款利率</th>
              <th scope="col">存款機制調整幅度</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="event in eventsDesc" :key="event.effectiveDate">
              <th scope="row">{{ event.effectiveDate }}</th>
              <td>{{ optionalRate(event.depositFacilityRate) }}</td>
              <td>{{ optionalRate(event.mainRefinancingRate) }}<template v-if="event.mainRefinancingIsMinimumBid">（{{ mroLabel(event) }}）</template></td>
              <td>{{ optionalRate(event.marginalLendingRate) }}</td>
              <td>{{ changeText(event.depositFacilityChangeBp) }}</td>
            </tr>
          </tbody>
        </table>
      </SharedTableScroll>
      <p class="hub-answer macro-ecb-policy-rate-page__sources">資料來源：歐洲中央銀行 Data Portal（MRR_FR、MRR_MBR、DFR、MLF 序列）、臺灣證券交易所加權股價指數。原始資料是每日的利率值；本頁的「歷次調整」是我們對每日值比對後整理出的變動事件，幅度與升降息次數由我們計算，歐洲央行本身不發布這份事件清單。</p>
    </section>
  </div>
</template>

<style scoped>
.macro-ecb-policy-rate-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.macro-ecb-policy-rate-page__title {
  margin: 0;
  font-size: 1.5rem;
}

.macro-ecb-policy-rate-page__chart {
  width: 100%;
  height: 420px;
}

.macro-ecb-policy-rate-page__sources {
  margin-top: 16px;
  color: var(--el-text-color-secondary);
}
</style>
