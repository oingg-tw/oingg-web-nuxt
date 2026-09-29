<script setup lang="ts">
import { use } from 'echarts/core'
import { SVGRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent, MarkLineComponent } from 'echarts/components'
import type { UsRateCyclePageData } from '#shared/types/hub'
import { clampDescription } from '~/utils/stock-digest'
import { getAccentColor, getChartInk, CHART_TOOLTIP, CHART_TOOLTIP_INK } from '~/utils/chart-palette'

// /macro/us-policy-rate — 聯準會升降息紀錄（2026-09-29）. 總經特區 的第八頁。
//
// 為什麼在這之前沒有：不是上游壞了。我 2026-09-29 查的時候，手上兩則筆記寫著「/macro/us-policy-rate
// 是 404」與「/macro/cbc-policy-rate 回 502」，實打之後兩則都不成立（分別是 200/261ms 與 200/235ms）。
// 真正的原因是這個頁面路由從來沒建過，資料一直躺在 bff 後面沒人接。筆記跟快取一樣會過期。
//
// 自己一頁而不是併進 /macro/policy-rate（使用者決定，2026-09-29）：兩份資料的欄位形狀是真的不同——
// 台灣是三個具名利率，美國是一個目標區間的上下限——而「台美利差」是一個判讀主張，不只是把兩條線
// 畫在一起。要做那件事得先有人決定要主張什麼。
//
// NO CAUSAL CLAIM，這一頁比央行那一頁更需要這條規則：圖上的指數是台灣的、利率是美國的，兩者放在
// 同一個時間軸上本身就很容易被讀成因果。所以每一句話都是日期或算術，圖例把「哪一條是誰」講明白，
// 然後停在那裡。
//
// An unregistered ECharts series type or component throws NOTHING — it silently draws nothing.
// MarkLineComponent is carried for the same reason policy-rate.vue carries it.
use([SVGRenderer, LineChart, GridComponent, TooltipComponent, LegendComponent, MarkLineComponent])

const { data, error } = await useFetch<UsRateCyclePageData>('/api/hub/macro-us-policy-rate', { key: 'hub-macro-us-policy-rate' })
if (error.value || !data.value) throw createError({ statusCode: 503, statusMessage: '聯準會利率資料暫時無法取得', fatal: true })

const events = computed(() => data.value?.events ?? [])
const eventsDesc = computed(() => [...events.value].reverse())
const taiex = computed(() => data.value?.taiex ?? [])

const latest = computed(() => eventsDesc.value[0] ?? null)

const rateText = (value: number): string => `${value.toFixed(2)}%`
// 2008-12-16 起 FOMC 設的是一個區間，在那之前是單一目標（實測：153 筆單一、33 筆區間，分界日就是
// 2008-12-16）。所以同一欄要能印兩種東西——把上下限相等的那些印成「4.75%–4.75%」會讓讀者以為
// 資料有問題，而那個區間在當年並不存在。
function targetText(event: { targetUpper: number; targetLower: number }): string {
  return event.targetUpper === event.targetLower
    ? rateText(event.targetUpper)
    : `${rateText(event.targetLower)}–${rateText(event.targetUpper)}`
}
// 一碼 = 0.25% = 25bp，台灣的新聞講聯準會也用這個單位，所以兩個都給：基點是精確的，碼是讀者
// 在新聞上看到的說法。
function changeText(changeBp: number | null): string {
  if (changeBp === null) return '—'
  const sign = changeBp > 0 ? '升息' : '降息'
  const notches = Math.abs(changeBp) / 25
  const notchText = notches === 0.5 ? '半碼' : notches === 1 ? '一碼' : `${notches} 碼`
  return `${sign}${notchText}（${changeBp > 0 ? '+' : '−'}${Math.abs(changeBp)} 基點）`
}

const hikes = computed(() => events.value.filter(event => (event.changeBp ?? 0) > 0).length)
const cuts = computed(() => events.value.filter(event => (event.changeBp ?? 0) < 0).length)

const latestAnswer = computed(() => {
  const event = latest.value
  if (!event) return null
  return `聯準會最近一次調整政策利率是 ${event.effectiveDate} 生效，聯邦資金利率目標 ${targetText(event)}，${changeText(event.changeBp)}。自 ${events.value[0]?.effectiveDate ?? ''} 起共 ${events.value.length} 次調整，其中升息 ${hikes.value} 次、降息 ${cuts.value} 次。`
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
  return `下圖兩條線分別是台灣的加權股價指數月收盤（共 ${list.length} 個月，${list[0]!.tradeDate} 至 ${list[list.length - 1]!.tradeDate}）與美國的聯邦資金利率目標上限，畫在同一個時間軸上。利率為階梯狀，因為它只在決議生效當天改變。${earlier ? `更早的 ${earlier} 次調整沒有畫進圖裡，指數序列從 ${list[0]!.tradeDate} 才開始，它們都在下面的表格裡。` : ''}`
})

// 兩件事讀者不講就會誤會，而且都是資料本身的性質不是評論：只收有變動的決議（上游是對每日持平值
// 做 diff，維持不變的會議根本不在資料裡，gov-ts 也沒有會議日期），以及本頁的起點是 2000 年。
const tableAnswer = computed(() => {
  if (!events.value.length) return null
  return `以下為由新到舊的每一次調整，共 ${events.value.length} 筆，${events.value[0]?.effectiveDate ?? ''} 至今，日期為生效日。這是升降息的紀錄，不是每一次會議的紀錄——維持不變的決議不會出現在這裡。最早的一筆是這份序列的起點，不是聯準會開始設定利率的起點。`
})

const { breadcrumbs } = useHubPageSeo({
  title: '美國聯準會升降息紀錄與台股大盤',
  description: () => clampDescription(latestAnswer.value ?? '美國聯準會歷次升降息的生效日與聯邦資金利率目標區間，對照台灣加權股價指數的月收盤。'),
  path: '/macro/us-policy-rate',
  breadcrumbs: [
    { label: '首頁', to: '/' },
    { label: '總經特區', to: '/macro' },
    { label: '聯準會升降息', to: '/macro/us-policy-rate' }
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
      if (event.effectiveDate <= date) current = event.targetUpper
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
          + (rate === null ? '' : `<div>聯邦資金利率上限 ${rateText(rate)}</div>`)
          + (decided ? `<div style="color:${CHART_TOOLTIP_INK.secondary}">本月 ${changeText(decided.changeBp)}</div>` : '')
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
        name: '利率上限 %',
        nameTextStyle: { color: chartInk.value.muted, fontSize: 16 },
        splitLine: { show: false },
        axisLabel: { color: chartInk.value.muted, fontSize: 16, formatter: (value: number) => `${value}%` }
      }
    ],
    series: [
      {
        name: '加權股價指數（月收盤）',
        type: 'line',
        yAxisIndex: 0,
        showSymbol: false,
        smooth: false,
        lineStyle: { width: 2, color: accent },
        itemStyle: { color: accent },
        data: points.map(point => point.close)
      },
      {
        name: '聯邦資金利率目標上限',
        type: 'line',
        yAxisIndex: 1,
        step: 'end',
        showSymbol: false,
        lineStyle: { width: 2, type: 'dashed', color: chartInk.value.primary },
        itemStyle: { color: chartInk.value.primary },
        connectNulls: false,
        data: byMonth
      }
    ]
  }
})
</script>

<template>
  <div class="macro-us-policy-rate-page">
    <h1 class="macro-us-policy-rate-page__title">美國聯準會升降息紀錄與台股大盤</h1>
    <StockBreadcrumb :items="breadcrumbs" />
    <MacroNav />

    <section class="stock-page-section" aria-labelledby="macro-us-policy-rate-latest-heading">
      <h2 id="macro-us-policy-rate-latest-heading" class="stock-page-section__title">聯準會最近一次升降息是什麼時候？</h2>
      <p v-if="latestAnswer" class="hub-answer">{{ latestAnswer }}</p>
    </section>

    <section class="stock-page-section" aria-labelledby="macro-us-policy-rate-chart-heading">
      <h2 id="macro-us-policy-rate-chart-heading" class="stock-page-section__title">升降息期間台股大盤走勢如何？</h2>
      <p v-if="spanAnswer" class="hub-answer">{{ spanAnswer }}</p>
      <el-card shadow="never" class="macro-us-policy-rate-page__card">
        <SharedChart v-if="taiex.length > 1" class="macro-us-policy-rate-page__chart" :option="chartOption" autoresize />
      </el-card>
    </section>

    <section class="stock-page-section" aria-labelledby="macro-us-policy-rate-table-heading">
      <h2 id="macro-us-policy-rate-table-heading" class="stock-page-section__title">歷次升降息有哪些？</h2>
      <p v-if="tableAnswer" class="hub-answer">{{ tableAnswer }}</p>
      <SharedTableScroll label="美國聯邦資金利率歷次調整">
        <table class="seo-table" data-ssr-table>
          <caption>美國聯邦資金利率歷次調整（由新到舊，日期為生效日）</caption>
          <thead>
            <tr>
              <th scope="col">生效日</th>
              <th scope="col">目標區間</th>
              <th scope="col">調整幅度</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="event in eventsDesc" :key="event.effectiveDate">
              <th scope="row">{{ event.effectiveDate }}</th>
              <td>{{ targetText(event) }}</td>
              <td>{{ changeText(event.changeBp) }}</td>
            </tr>
          </tbody>
        </table>
      </SharedTableScroll>
      <p class="hub-answer macro-us-policy-rate-page__sources">資料來源：美國聯邦準備理事會（經 FRED 的 DFEDTAR、DFEDTARU、DFEDTARL 序列）、臺灣證券交易所加權股價指數。</p>
    </section>
  </div>
</template>

<style scoped>
.macro-us-policy-rate-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.macro-us-policy-rate-page__title {
  margin: 0;
  font-size: 1.5rem;
}

.macro-us-policy-rate-page__chart {
  width: 100%;
  height: 420px;
}

.macro-us-policy-rate-page__sources {
  margin-top: 16px;
  color: var(--el-text-color-secondary);
}
</style>
