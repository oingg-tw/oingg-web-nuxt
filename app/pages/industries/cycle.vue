<script setup lang="ts">
import { use } from 'echarts/core'
import { HeatmapChart } from 'echarts/charts'
import { VisualMapContinuousComponent } from 'echarts/components'
import type { SectorCycleRow, SectorCycleSummary } from '#shared/types/hub'
import type { SortableColumn } from '~/components/shared/SharedSortableTable.vue'
// 類股營收與景氣（2026-10-10，「請設計圖表，讓用戶可以看出來那些公司或是產業屬於景氣循環股」；2026-10-24 從「景氣敏感度」改名，那個詞
// 現在是股價版 /industries/sensitivity 的正式名稱）：兩個數字，近三個月累計營收年增率
// 的起伏幅度（標準差）與它跟景氣同時指標（去趨勢）的相關係數——但頁面**不替任何一個類股下結論、不貼標籤、不排序**（conductor
// 篩選功能.md §5.7、非景氣循環產業護城河分類學 L51–52）：只畫數字，表格依類股代號排。
//
// 圖 2026-10-21 從散佈圖改成熱度圖（使用者：「這張圖的設計我不滿意」，看過四種畫法後選熱度圖，理由「歷史變化是重要的」）：每一列一個
// 類股、每一格一個月，顏色是那個月的年增率；最上面一條景氣同時指標，虛線框是國發會認定的景氣收縮期。散佈圖要讀者先懂標準差與
// 相關係數、得配兩段說明，而熱度圖看得到什麼時候、哪些類股跟著景氣一起變色。兩個數字留在表格。單一類股跟景氣的折線對照在各類股頁。
// 也試過「擴張期與收縮期的平均年增率」：只有一段 15 個月的收縮期，又碰上 2022 年能源、航運與觀光解封，半導體在收縮期平均 +12.2%，
// 會讓人以為不受景氣影響，沒有採用。
//
// 未註冊的 ECharts 型別不會丟錯，只是靜靜不畫（本站踩過）：熱度圖與連續型 visualMap 在這裡註冊，其餘在 SharedChart。
use([HeatmapChart, VisualMapContinuousComponent])

const requestUrl = useRequestURL()
useSeoMeta({
  title: '台股類股營收與景氣：營收起伏與景氣同步程度',
  description: '證交所各類股每個月的營收年增率畫成熱度圖，跟景氣同時指標與國發會認定的景氣收縮期對照；附逐類股的起伏幅度、與景氣的相關係數、最低與最高年增率。'
})
useHead({ link: [{ rel: 'canonical', href: `${requestUrl.origin}/industries/cycle` }] })

const { data: summary, error: summaryError } = await useFetch<SectorCycleSummary | null>('/api/hub/sector-cycle-summary', {
  key: 'hub-sector-cycle-summary',
  default: () => null
})
// 讀不到回 503（2026-10-11，照其他 hub 頁的規則）：搜尋引擎要拿到暫時錯誤，不是一頁空白的 200
if (summaryError.value) throw createError({ statusCode: 503, statusMessage: '類股營收與景氣資料暫時無法取得', fatal: true })

// 答句分布的分界：相關係數 0.5 是常用的「中度以上相關」門檻，只拿來數家數，不替類股命名
const STRONG = 0.5

const rows = computed(() => [...(summary.value?.sectors ?? [])].sort((a, b) => a.code.localeCompare(b.code)))
// 欄位可以點表頭排序（2026-10-21，SharedSortableTable）
const COLUMNS: SortableColumn<SectorCycleRow>[] = [
  { key: 'sector', label: '類股', sortValue: row => row.code },
  { key: 'amplitude', label: '起伏幅度', num: true, sortValue: row => row.amplitude },
  { key: 'correlation', label: '相關係數', num: true, sortValue: row => row.correlation },
  // 「月數」（相關係數用到幾個月）2026-10-21 拿掉，使用者：「這是多於資訊」——每個類股都是同一段期間
  { key: 'lowest', label: '最低', num: true, sortValue: row => row.lowest?.value },
  { key: 'highest', label: '最高', num: true, sortValue: row => row.highest?.value }
]

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

// 2026-10-10 月營收回補到 2016-01（mops-ts＋analysis-ts 1bd2ea9d）。三個月累計從 2016-03 起，只差第 15 次循環起點（2016-02）一個月，
// 就算涵蓋；資料若又變短（例如某天上游只回五年），注意事項自動退回「大概只涵蓋一次景氣循環」那句。
const coversCycle15 = computed(() => !!summary.value?.firstMonth && summary.value.firstMonth <= '2016-03')

const leadAnswer = computed(() => {
  const counted = rows.value.filter(row => row.amplitude !== null && row.correlation !== null)
  if (!counted.length) return null
  const r = counted.map(row => row.correlation as number)
  const a = counted.map(row => row.amplitude as number)
  const strong = r.filter(value => value >= STRONG).length
  const negative = r.filter(value => value < 0).length
  return `${counted.length} 個類股裡，營收年增率跟景氣同時指標的相關係數在 ${STRONG} 以上的有 ${strong} 個、0 到 ${STRONG} 之間 ${counted.length - strong - negative} 個、0 以下 ${negative} 個；起伏幅度從 ${points(Math.min(...a))} 到 ${points(Math.max(...a))}。`
})

const isDesktop = useIsDesktop()
const { resolvedMode, market } = useAppTheme()
const { scale } = useTextScale()
const chartInk = computed(() => getChartInk(resolvedMode.value))
const priceColors = computed(() => getPriceColors(resolvedMode.value, market.value))

const months = computed(() => summary.value?.months ?? [])
const heatRows = computed(() => rows.value.filter(row => row.yoy.some(value => value !== null)))
// 顏色到 ±40% 就不再加深：九成六的月份落在 −23%～+44% 之間（2026-10-21 量 34 個類股 127 個月），再寬中間的月份全是淡色
const COLOR_LIMIT = 40

// 兩個格線區（上面一條景氣同時指標、下面每列一個類股）共用月份軸，左邊的名稱欄要寫死同一個寬度。伺服器端量不到字寬，用最長的
// 類股名稱字數算（都是全形字）；SharedChart 會把字級乘上文字大小設定，版面的高度與寬度這裡跟著乘
const heatLayout = computed(() => {
  const font = 16 * Number(scale.value) / 100
  const labelWidth = Math.ceil(Math.max(6, ...heatRows.value.map(row => row.name.length)) * font) + 12
  const rowHeight = Math.ceil(font + 6)
  const legendHeight = Math.ceil(font * 2)
  const indicatorTop = legendHeight + Math.ceil(font + 12)
  const indicatorHeight = 64
  const heatTop = indicatorTop + indicatorHeight + 12
  const heatHeight = heatRows.value.length * rowHeight
  return { labelWidth, indicatorTop, indicatorHeight, heatTop, heatHeight, height: heatTop + heatHeight + Math.ceil(font + 16) }
})

interface HeatmapParam { seriesType?: string; value?: [number, number, number] }

const heatOption = computed(() => {
  const layout = heatLayout.value
  const ink = chartInk.value
  const list = months.value
  const first = list[0] ?? ''
  const last = list.at(-1) ?? ''
  // 景氣收縮期，夾在月份軸裡。擴張期同一天加過又拿掉（使用者：「原來是這樣認定 那還是把 擴張期拿掉吧」：收縮期以外都是擴張期）
  const contractions = (summary.value?.contractions ?? []).map(period => ({
    from: period.from < first ? first : period.from,
    to: period.to === null || period.to > last ? last : period.to
  }))
  const inContraction = (month: string) => contractions.some(period => month >= period.from && month <= period.to)
  const contractionAreas = contractions.map(period => [{ xAxis: period.from }, { xAxis: period.to }])
  const yearOnly = (value: string) => (value.endsWith('-01') && (isDesktop.value || Number(value.slice(0, 4)) % 2 === 0) ? value.slice(0, 4) : '')
  return {
    tooltip: {
      trigger: 'item',
      formatter: (param: HeatmapParam) => {
        if (param.seriesType !== 'heatmap' || !param.value) return ''
        const [x, y, value] = param.value
        const month = list[x] ?? ''
        return `<div style="font-size:1rem"><div style="font-weight:600;margin-bottom:4px">${heatRows.value[y]?.name ?? ''}　${month}${inContraction(month) ? '（景氣收縮期）' : ''}</div><div>近三個月營收年增率 ${pct(value)}</div></div>`
      }
    },
    visualMap: {
      type: 'continuous',
      min: -COLOR_LIMIT,
      max: COLOR_LIMIT,
      seriesIndex: 1,
      orient: 'horizontal',
      left: 0,
      top: 0,
      itemWidth: 14,
      itemHeight: isDesktop.value ? 240 : 120,
      calculable: false,
      text: [`+${COLOR_LIMIT}%`, `營收年增率 −${COLOR_LIMIT}%`],
      textGap: 8,
      // 成長、衰退用漲跌色（跟著使用者的市場慣例設定），零附近是格線色
      inRange: { color: [priceColors.value.down, ink.gridline, priceColors.value.up] },
      textStyle: { fontSize: 16, color: ink.secondary }
    },
    grid: [
      { left: layout.labelWidth, right: 8, top: layout.indicatorTop, height: layout.indicatorHeight },
      { left: layout.labelWidth, right: 8, top: layout.heatTop, height: layout.heatHeight }
    ],
    xAxis: [
      { type: 'category', gridIndex: 0, data: list, axisLabel: { show: false }, axisTick: { show: false }, axisLine: { show: false } },
      { type: 'category', gridIndex: 1, data: list, axisLabel: { interval: 0, formatter: yearOnly }, axisTick: { show: false }, axisLine: { show: false } }
    ],
    yAxis: [
      {
        type: 'value',
        gridIndex: 0,
        scale: true,
        axisLabel: { show: false },
        splitLine: { show: false },
        // 名稱放在左邊的名稱欄裡，跟下面的類股名稱對齊
        name: '景氣同時指標',
        nameLocation: 'middle',
        nameRotate: 0,
        nameGap: 8,
        nameTextStyle: { align: 'right', fontSize: 16, color: ink.primary }
      },
      { type: 'category', gridIndex: 1, data: heatRows.value.map(row => row.name), inverse: true, axisLabel: { interval: 0, color: ink.primary }, axisTick: { show: false }, axisLine: { show: false } }
    ],
    series: [
      {
        name: '景氣同時指標',
        type: 'line',
        xAxisIndex: 0,
        yAxisIndex: 0,
        silent: true,
        showSymbol: false,
        data: summary.value?.coincident ?? [],
        lineStyle: { color: ink.secondary, width: 2 },
        markArea: {
          silent: true,
          itemStyle: { color: ink.gridline },
          label: { show: true, position: 'top', fontSize: 16, color: ink.secondary },
          data: contractionAreas.map(([from, to]) => [{ ...from, name: '景氣收縮期' }, to])
        }
      },
      {
        name: '近三個月營收年增率',
        type: 'heatmap',
        xAxisIndex: 1,
        yAxisIndex: 1,
        data: heatRows.value.flatMap((row, y) => row.yoy.flatMap((value, x) => (value === null ? [] : [[x, y, value]]))),
        emphasis: { itemStyle: { borderColor: ink.primary, borderWidth: 1 } },
        markArea: {
          silent: true,
          // markArea 預設 z 1，在格子（z 2）底下，框的左右兩邊會被格子蓋掉
          z: 3,
          itemStyle: { color: 'transparent', borderColor: ink.primary, borderWidth: 1.5, borderType: 'dashed' },
          data: contractionAreas
        }
      }
    ]
  }
})
</script>

<template>
  <div class="app-page app-page--compact industries-page">
    <h1 class="app-page__title industries-page__title">台股類股營收與景氣</h1>
    <IndustryNav />

    <section class="stock-page-section" aria-labelledby="industries-cycle-heading">
      <h2 id="industries-cycle-heading" class="stock-page-section__title">各類股的營收跟著景氣起落的程度有多大？</h2>
      <p v-if="leadAnswer" class="hub-answer">{{ leadAnswer }}</p>
      <el-card v-if="heatRows.length" shadow="never" class="industries-page__card">
        <SharedChart
          class="app-chart"
          :style="{ height: `${heatLayout.height}px` }"
          :option="heatOption"
          autoresize
          aria-label="熱度圖：各類股每個月的近三個月累計營收年增率，上方是景氣同時指標與景氣收縮期"
        />
      </el-card>
      <SharedSortableTable
        v-if="rows.length"
        :rows="rows"
        :columns="COLUMNS"
        :row-key="row => row.code"
        label="各證交所類股的營收起伏幅度與景氣同步程度"
        :caption="`各類股近三個月累計營收年增率（${summary?.firstMonth}～${summary?.lastMonth}，依類股代號排列）`"
      >
        <template #row="{ row }">
          <th scope="row"><NuxtLink :to="sectorPath(row.code) ?? '/industries'">{{ row.name }}</NuxtLink></th>
          <td class="seo-table__num">{{ points(row.amplitude) }}</td>
          <td class="seo-table__num">{{ corr(row.correlation) }}</td>
          <td class="seo-table__num">{{ row.lowest ? `${pct(row.lowest.value)}（${row.lowest.yearMonth}）` : '－' }}</td>
          <td class="seo-table__num">{{ row.highest ? `${pct(row.highest.value)}（${row.highest.yearMonth}）` : '－' }}</td>
        </template>
      </SharedSortableTable>
    </section>

    <section class="stock-page-section" aria-labelledby="industries-cycle-notes-heading">
      <h2 id="industries-cycle-notes-heading" class="stock-page-section__title">看這些數字要注意什麼？</h2>
      <ul class="industries-page__notes">
        <li>起伏幅度是年增率的標準差：數字越大，營收一下大增、一下大減的幅度越大。用三個月累計而不是單月，是為了避開農曆年落在一月或二月造成的單月暴衝。</li>
        <li>相關係數介於 −1 到 1：越接近 1，營收年增率越跟著景氣同時指標一起上下；接近 0 代表兩者沒有一起動。景氣同時指標用國家發展委員會公布的去趨勢值，只到 {{ summary?.indicatorLastMonth ?? '最新公布月份' }}。</li>
        <li v-if="coversCycle15">資料約 {{ yearsCovered }} 年，涵蓋國家發展委員會認定的第 15 次景氣循環（起點 2016 年 2 月、高峰 2022 年 1 月、終點 2023 年 4 月）和之後的擴張期；一個類股在下一次循環的表現可能不同。</li>
        <li v-else>資料大約只有 {{ yearsCovered ?? '數' }} 年，大概只涵蓋一次景氣循環；一個類股在下一次循環的表現可能不同。</li>
        <li>半導體等大型產業本身就是景氣指標的一大部分，它們的相關係數有一部分是自己跟自己比。</li>
        <li>2020 年疫情期間營收驟降，2021 年又跟這個低點比，這兩年的年增率起落特別大。觀光等受防疫管制影響的類股，營收在 2023 年解封後才大幅回升，這段起落跟景氣指標無關，會把相關係數往負的方向拉。</li>
        <!-- 2026-10-21 改寫成讀者的話（使用者：「這邊是給用戶看的 不需要 程式實作層面的說明」）。原本寫的是資料怎麼來的：2021 年 9 月以前的
             月營收是公開資訊觀測站依今天的公司名單重新整理的、年增率只算兩年都有申報的公司 -->
        <li>類股用的是今天的公司名單，已經下市的公司不在裡面，所以越早的年份算進去的公司越少，早年的數字只反映留到今天的公司。</li>
      </ul>
      <p class="hub-answer hub-sources industries-page__sources">資料來源：公開資訊觀測站各公司月營收、國家發展委員會景氣指標與景氣循環基準日期。母體為上市與上櫃普通股，不含興櫃。</p>
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
