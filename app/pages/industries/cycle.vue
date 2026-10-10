<script setup lang="ts">
import { use } from 'echarts/core'
import { ScatterChart } from 'echarts/charts'
import { LabelLayout } from 'echarts/features'
import type { SectorCycleRow, SectorCycleSummary } from '#shared/types/hub'
// 類股景氣敏感度（2026-10-10，「請設計圖表，讓用戶可以看出來那些公司或是產業屬於景氣循環股」）：每個點一個證交所類股，
// X＝近三個月累計營收年增率的起伏幅度（標準差）、Y＝它跟景氣同時指標（去趨勢）的相關係數。右上方＝營收大起大落、又跟著
// 整體景氣一起動，就是一般說的景氣循環的樣子——但頁面**不替任何一個類股下結論、不貼標籤、不排序**（conductor
// 篩選功能.md §5.7、非景氣循環產業護城河分類學 L51–52）：只畫數字，表格依類股代號排。
// 形狀照 /industries/growth：少於 MIN_SAMPLE 家不畫、點大小＝家數、桌機才標籤。
use([ScatterChart, LabelLayout])

const requestUrl = useRequestURL()
useSeoMeta({
  title: '台股類股景氣敏感度：營收起伏與景氣同步程度',
  description: '證交所各類股的月營收年增率起伏有多大、跟景氣同時指標同步的程度有多高，畫在同一張圖上；附逐類股的最低與最高年增率。'
})
useHead({ link: [{ rel: 'canonical', href: `${requestUrl.origin}/industries/cycle` }] })

const { data: summary } = await useFetch<SectorCycleSummary | null>('/api/hub/sector-cycle-summary', {
  key: 'hub-sector-cycle-summary',
  default: () => null
})

const MIN_SAMPLE = 5
// 答句分布的分界：相關係數 0.5 是常用的「中度以上相關」門檻，只拿來數家數，不替類股命名
const STRONG = 0.5

const rows = computed(() => [...(summary.value?.sectors ?? [])].sort((a, b) => a.code.localeCompare(b.code)))
const plotted = computed(() => rows.value.filter(row => row.companyCount >= MIN_SAMPLE && row.amplitude !== null && row.correlation !== null))
const excluded = computed(() => rows.value.filter(row => !plotted.value.includes(row)))

const pct = (value: number | null) => (value === null ? '－' : `${value > 0 ? '+' : ''}${value.toFixed(1)}%`)
const points = (value: number | null) => (value === null ? '－' : `${value.toFixed(1)} 個百分點`)
const corr = (value: number | null) => (value === null ? '－' : value.toFixed(2))
const yearsCovered = computed(() => {
  const first = summary.value?.firstMonth
  const last = summary.value?.lastMonth
  if (!first || !last) return null
  const [fy, fm] = first.split('-').map(Number) as [number, number]
  const [ly, lm] = last.split('-').map(Number) as [number, number]
  return Math.round(((ly - fy) * 12 + lm - fm + 1) / 12)
})

// 2026-10-10 月營收回補到 2016-01（mops-ts＋analysis-ts 1bd2ea9d）。三個月累計從 2016-03 起，只差第 15 次循環谷底一個月，
// 就算涵蓋；資料若又變短（例如某天上游只回五年），注意事項自動退回「大概只涵蓋一次景氣循環」那句。
const coversCycle15 = computed(() => !!summary.value?.firstMonth && summary.value.firstMonth <= '2016-03')

const leadAnswer = computed(() => {
  if (!plotted.value.length) return null
  const r = plotted.value.map(row => row.correlation as number)
  const a = plotted.value.map(row => row.amplitude as number)
  const strong = r.filter(value => value >= STRONG).length
  const negative = r.filter(value => value < 0).length
  return `圖上 ${plotted.value.length} 個類股裡，營收年增率跟景氣同時指標的相關係數在 ${STRONG} 以上的有 ${strong} 個、0 到 ${STRONG} 之間 ${plotted.value.length - strong - negative} 個、0 以下 ${negative} 個；起伏幅度從 ${points(Math.min(...a))} 到 ${points(Math.max(...a))}。`
})

const chartAnswer = computed(() => {
  if (!summary.value?.firstMonth) return null
  const base = `每一個點是一個類股：橫軸是近三個月累計營收年增率的起伏幅度，縱軸是它跟景氣同時指標的相關係數。資料從 ${summary.value.firstMonth} 到 ${summary.value.lastMonth}，大約 ${yearsCovered.value} 年。點的大小是最新一個月申報營收的公司數。`
  const names = excluded.value.map(row => `${row.name}（${row.companyCount} 家）`)
  return names.length ? `${base}少於 ${MIN_SAMPLE} 家或月份不足兩年的類股沒有畫，共 ${names.length} 個：${names.join('、')}。` : base
})

const isDesktop = useIsDesktop()
const { resolvedMode, color: accentColorName } = useAppTheme()
const chartInk = computed(() => getChartInk(resolvedMode.value))

interface ScatterParam { data?: { value: [number, number]; row: SectorCycleRow } }

const chartOption = computed(() => {
  const accent = getAccentColor(resolvedMode.value, accentColorName.value)
  const maxCount = Math.max(1, ...plotted.value.map(row => row.companyCount))
  const xMax = Math.ceil(Math.max(10, ...plotted.value.map(row => row.amplitude as number)) / 10) * 10
  const [baseSize, extraSize] = isDesktop.value ? [10, 22] : [8, 10]
  return {
    grid: { left: 8, right: 16, top: 32, bottom: 28, containLabel: true },
    tooltip: {
      trigger: 'item',
      formatter: (param: ScatterParam) => {
        const row = param.data?.row
        if (!row) return ''
        return `<div style="font-size:1rem"><div style="font-weight:600;margin-bottom:4px">${row.name}（${row.companyCount} 家）</div>`
          + `<div>起伏幅度 ${points(row.amplitude)}</div>`
          + `<div>與景氣同時指標的相關係數 ${corr(row.correlation)}（${row.months} 個月）</div>`
          + `<div>最低 ${pct(row.lowest?.value ?? null)}（${row.lowest?.yearMonth}）、最高 ${pct(row.highest?.value ?? null)}（${row.highest?.yearMonth}）</div></div>`
      }
    },
    xAxis: { type: 'value', name: '營收年增率起伏幅度（百分點）', min: 0, max: xMax, nameLocation: 'middle', nameGap: 28 },
    yAxis: { type: 'value', name: '與景氣同時指標的相關係數', min: -1, max: 1, interval: 0.5, nameTextStyle: { align: 'left' } },
    series: [
      {
        type: 'scatter',
        symbolSize: (_: unknown, param: ScatterParam) => baseSize + extraSize * Math.sqrt((param.data?.row.companyCount ?? 0) / maxCount),
        itemStyle: { color: accent, opacity: 0.75 },
        label: {
          show: isDesktop.value,
          position: 'right',
          fontSize: 16,
          color: chartInk.value.primary,
          formatter: (param: ScatterParam) => param.data?.row.name ?? ''
        },
        labelLayout: { moveOverlap: 'shiftY', hideOverlap: true },
        markLine: {
          silent: true,
          symbol: 'none',
          label: { show: false },
          lineStyle: { color: chartInk.value.baseline, type: 'dashed' },
          data: [{ yAxis: 0 }]
        },
        data: plotted.value.map(row => ({ value: [row.amplitude, row.correlation], row }))
      }
    ]
  }
})
</script>

<template>
  <div class="app-page app-page--compact industries-page">
    <h1 class="app-page__title industries-page__title">台股類股景氣敏感度</h1>
    <IndustryNav />

    <section class="stock-page-section" aria-labelledby="industries-cycle-heading">
      <h2 id="industries-cycle-heading" class="stock-page-section__title">各類股的營收跟著景氣起落的程度有多大？</h2>
      <p v-if="leadAnswer" class="hub-answer">{{ leadAnswer }}</p>
      <p v-if="chartAnswer" class="hub-answer">{{ chartAnswer }}</p>
      <el-card v-if="plotted.length" shadow="never" class="industries-page__card">
        <SharedChart class="app-chart industries-page__chart" :option="chartOption" autoresize aria-label="各類股營收年增率起伏幅度與景氣同時指標相關係數的散佈圖" />
      </el-card>
      <SharedTableScroll v-if="rows.length" label="各證交所類股的營收起伏幅度與景氣同步程度">
        <table class="seo-table" data-ssr-table>
          <caption>各類股近三個月累計營收年增率（{{ summary?.firstMonth }}～{{ summary?.lastMonth }}，依類股代號排列）</caption>
          <thead>
            <tr>
              <th scope="col">類股</th>
              <th scope="col">起伏幅度</th>
              <th scope="col">相關係數</th>
              <th scope="col">月數</th>
              <th scope="col">最低</th>
              <th scope="col">最高</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.code">
              <th scope="row"><NuxtLink :to="sectorPath(row.code) ?? '/stock'">{{ row.name }}</NuxtLink></th>
              <td class="seo-table__num">{{ points(row.amplitude) }}</td>
              <td class="seo-table__num">{{ corr(row.correlation) }}</td>
              <td class="seo-table__num">{{ row.months || '－' }}</td>
              <td class="seo-table__num">{{ row.lowest ? `${pct(row.lowest.value)}（${row.lowest.yearMonth}）` : '－' }}</td>
              <td class="seo-table__num">{{ row.highest ? `${pct(row.highest.value)}（${row.highest.yearMonth}）` : '－' }}</td>
            </tr>
          </tbody>
        </table>
      </SharedTableScroll>
    </section>

    <section class="stock-page-section" aria-labelledby="industries-cycle-notes-heading">
      <h2 id="industries-cycle-notes-heading" class="stock-page-section__title">看這些數字要注意什麼？</h2>
      <ul class="industries-page__notes">
        <li>起伏幅度是年增率的標準差：數字越大，營收一下大增、一下大減的幅度越大。用三個月累計而不是單月，是為了避開農曆年落在一月或二月造成的單月暴衝。</li>
        <li>相關係數介於 −1 到 1：越接近 1，營收年增率越跟著景氣同時指標一起上下；接近 0 代表兩者沒有一起動。景氣同時指標用國家發展委員會公布的去趨勢值，只到 {{ summary?.indicatorLastMonth ?? '最新公布月份' }}。</li>
        <li v-if="coversCycle15">資料約 {{ yearsCovered }} 年，涵蓋國家發展委員會認定的第 15 次景氣循環（2016 年 2 月谷底、2022 年 1 月高峰、2023 年 4 月谷底）和之後的擴張期；一個類股在下一次循環的表現可能不同。</li>
        <li v-else>資料大約只有 {{ yearsCovered ?? '數' }} 年，大概只涵蓋一次景氣循環；一個類股在下一次循環的表現可能不同。</li>
        <li>半導體等大型產業本身就是景氣指標的一大部分，它們的相關係數有一部分是自己跟自己比。</li>
        <li>2020 年疫情期間營收驟降，2021 年又跟這個低點比，這兩年的年增率起落特別大。觀光等受防疫管制影響的類股，營收在 2023 年解封後才大幅回升，這段起落跟景氣指標無關，會把相關係數往負的方向拉。</li>
        <li>類股的公司是今天的分類。2021 年 9 月以前的月營收來自公開資訊觀測站依今天的公司名單重新整理的資料，之後下市的公司不在裡面，所以越早的月份家數越少。每個月的年增率只算當月與去年同月都有申報營收的公司，受這點影響比較小，但早年只含存活到今天的公司。</li>
      </ul>
      <p class="hub-answer hub-sources industries-page__sources">資料來源：公開資訊觀測站各公司月營收、國家發展委員會景氣指標。母體為上市與上櫃普通股，不含興櫃。</p>
    </section>
  </div>
</template>

<style scoped>
.industries-page__title {
  font-weight: 600;
}

.industries-page__notes {
  margin: 0;
  padding-left: 1.2em;
  display: flex;
  flex-direction: column;
  gap: 8px;
  color: var(--el-text-color-regular);
  line-height: 1.7;
}
</style>
