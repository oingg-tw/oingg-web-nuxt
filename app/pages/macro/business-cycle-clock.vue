<script setup lang="ts">
import type { BusinessCycleClockData, BusinessCycleReferenceCycle } from '#shared/types/hub'
import type { ClockZone } from '#shared/utils/business-cycle-clock'
// 景氣時鐘（2026-10-11，「設計圖表幫助用戶判讀自己在景氣時鐘或是景氣循環的哪個階段」）。OECD Business Cycle Clock：
// 橫軸是指標的去趨勢值（100＝長期趨勢）、縱軸是比上個月的變動，過去 24 個月連成一條軌跡，四區是那張圖的定義。
// 使用者選定領先指標為主、可切換同時指標。
//
// 合規（conductor 景氣對策信號文件 L74／L76、篩選功能.md §5.2／§5.3）：這是背景資訊，不是擇時工具。
//   - 不寫站方口吻的「目前處於擴張期」：答句寫「某年某月的數字落在『高於趨勢、仍在上升』那一區（OECD 稱為擴張）」
//   - 不把區域對應到資產或類股，不寫進出場
//   - 四區不用紅綠，只標名字；軌跡用主題強調色
// 歷次循環（2026-10-18，「能否收不只最近這次循環，也讓用戶可以看看前幾次的循環」，使用者選「一次看一個循環」）：時段選單選國發會認定的
// 第 N 次循環，時鐘畫那一次從起點到終點的軌跡；選擇記在網址 ?cycle=N（可以分享，循環表的連結也靠它）。第二段是循環表本身。

const { data, error } = await useFetch<BusinessCycleClockData>('/api/hub/macro-business-cycle-clock', { key: 'hub-macro-business-cycle-clock' })
if (error.value || !data.value?.points.length) throw createError({ statusCode: 503, statusMessage: '景氣指標資料暫時無法取得', fatal: true })

type IndicatorKey = 'leading' | 'coincident'
const INDICATORS: Record<IndicatorKey, string> = { leading: '領先指標', coincident: '同時指標' }
const indicator = ref<IndicatorKey>('leading')
const indicatorName = computed(() => INDICATORS[indicator.value])

const monthText = (period: string) => {
  const [year, month] = period.split('-')
  return `${year} 年 ${Number(month)} 月`
}
const signed = (value: number) => `${value >= 0 ? '+' : '−'}${Math.abs(value).toFixed(2)}`

// ---- 時段 ----
const RECENT_MONTHS = 24
const cycles = computed(() => data.value?.cycles ?? [])
// 指標從 1982-01 起，起點要有前一個月才算得出月變動：只有起點在第二個月以後的循環能畫
const firstPeriod = computed(() => data.value?.points[0]?.period ?? '')
const drawable = (cycle: BusinessCycleReferenceCycle) => cycle.troughStart > firstPeriod.value
const cycleOptions = computed(() => [...cycles.value].filter(drawable).reverse())
const route = useRoute()
const router = useRouter()
const RECENT = 'recent'
const selectedKey = computed({
  get: () => {
    const value = Number(route.query.cycle)
    return cycleOptions.value.some(cycle => cycle.cycleNo === value) ? String(value) : RECENT
  },
  set: (value: string) => router.replace({ query: { ...route.query, cycle: value === RECENT ? undefined : value } })
})
const selectedCycle = computed(() => cycles.value.find(cycle => String(cycle.cycleNo) === selectedKey.value) ?? null)
const cycleRange = (cycle: BusinessCycleReferenceCycle) => (cycle.troughEnd
  ? `${monthText(cycle.troughStart)}–${monthText(cycle.troughEnd)}`
  : `${monthText(cycle.troughStart)}起，進行中`)

interface ClockRow { period: string; level: number; change: number; zone: ClockZone }
// 每一個月的月變動要前一個月：最近 24 個月要 25 個點；一次循環是起點的前一個月到終點（clockMonths）
const rows = computed<ClockRow[]>(() => {
  const all = data.value?.points ?? []
  const cycle = selectedCycle.value
  const points = cycle ? clockMonths(all, cycle.troughStart, cycle.troughEnd) : all.slice(-(RECENT_MONTHS + 1))
  return points.slice(1).flatMap((point, index) => {
    const level = point[indicator.value]
    const previous = points[index]?.[indicator.value]
    if (level === null || previous === null || previous === undefined) return []
    const change = level - previous
    return [{ period: point.period, level, change, zone: clockZone(level, change) }]
  })
})
const latest = computed(() => rows.value.at(-1) ?? null)

// 軌跡經過的區域：每次換區記下起始月份
const passages = computed(() => rows.value.reduce<{ zone: ClockZone; from: string }[]>((list, row) => {
  if (list.at(-1)?.zone !== row.zone) list.push({ zone: row.zone, from: row.period })
  return list
}, []))

const answer = computed(() => {
  const row = latest.value
  if (!row) return null
  const cycle = selectedCycle.value
  // 一次循環動輒 40～100 個月，逐段列換區太長：只數每一區待了幾個月
  if (cycle) {
    const dates = [`${monthText(cycle.troughStart)}起`, cycle.peak && `${monthText(cycle.peak)}高峰`, cycle.troughEnd ? `${monthText(cycle.troughEnd)}結束` : '尚未結束'].filter(Boolean).join('、')
    const counts = (Object.keys(CLOCK_ZONES) as ClockZone[]).map(zone => `${CLOCK_ZONES[zone].name} ${rows.value.filter(item => item.zone === zone).length} 個月`).join('、')
    return `第 ${cycle.cycleNo} 次景氣循環（國家發展委員會認定：${dates}）期間，${indicatorName.value}去趨勢值落在${counts}。`
  }
  const zone = CLOCK_ZONES[row.zone]
  const path = passages.value.map(item => `${CLOCK_ZONES[item.zone].name}（${monthText(item.from)}起）`).join('、')
  return `國家發展委員會最新公布的 ${monthText(row.period)}，${indicatorName.value}去趨勢值為 ${row.level.toFixed(2)}，比上個月${row.change >= 0 ? '增加' : '減少'} ${Math.abs(row.change).toFixed(2)} 點；在景氣時鐘上落在「${zone.definition}」那一區（OECD 稱為${zone.name}）。過去 ${rows.value.length} 個月依序經過：${path}。`
})

const isDesktop = useIsDesktop()
const { resolvedMode, color: accentColorName } = useAppTheme()
const chartInk = computed(() => getChartInk(resolvedMode.value))

interface ClockParam { data?: { value: [number, number]; row: ClockRow } }

const chartOption = computed(() => {
  const accent = getAccentColor(resolvedMode.value, accentColorName.value)
  const ink = chartInk.value
  // 兩軸各自以 100／0 為中心對稱，十字線才會在正中央。留三成空白，軌跡才不會跑進四角的區域名；
  // 橫軸刻度間隔取整（半寬切四格），2026-10-11 第一版讓 ECharts 自己選，同時指標的左端出現「92 93」兩個擠在一起的刻度
  // 兩軸的半寬都取成刻度間隔的整數倍；手機橫軸只切兩格（約 343px 寬放不下九個刻度）
  const xSpan = Math.max(1, ...rows.value.map(row => Math.abs(row.level - 100))) * 1.3
  const xInterval = Math.max(1, Math.ceil(xSpan / (isDesktop.value ? 4 : 2)))
  const xHalf = Math.ceil(xSpan / xInterval) * xInterval
  const ySpan = Math.max(0.2, ...rows.value.map(row => Math.abs(row.change))) * 1.3
  const yInterval = ySpan <= 0.6 ? 0.2 : ySpan <= 1.2 ? 0.5 : 1
  const yHalf = Math.round(Math.ceil(ySpan / yInterval) * yInterval * 10) / 10
  const xMin = 100 - xHalf
  const xMax = 100 + xHalf
  const last = rows.value.length - 1
  const peak = selectedCycle.value?.peak ?? null
  // 起點與最新一點標月份（選了循環時加標高峰，三點各自寫是哪一點），標籤放在朝圖中心那一側，避開四角的區域名
  const cycle = selectedCycle.value
  const role = (row: ClockRow) => {
    if (!cycle) return ''
    if (row.period === cycle.troughStart) return '（起點）'
    if (row.period === peak) return '（高峰）'
    return row.period === cycle.troughEnd ? '（終點）' : '（最新）'
  }
  const pointLabel = (row: ClockRow) => ({ show: true, position: row.change >= 0 ? 'bottom' : 'top', fontSize: 16, color: ink.primary, formatter: `${monthText(row.period)}${role(row)}` })
  // 四區只標名字（手機）或名字加定義（桌機），不填色：區域是圖的定義，不是好壞
  const zoneLabel = (zone: ClockZone, position: string) => ({
    position,
    color: ink.secondary,
    fontSize: 16,
    formatter: isDesktop.value ? `${CLOCK_ZONES[zone].name}\n${CLOCK_ZONES[zone].definition}` : CLOCK_ZONES[zone].name
  })
  const area = (zone: ClockZone, from: [number, number], to: [number, number], position: string) =>
    [{ coord: from, label: zoneLabel(zone, position) }, { coord: to }]
  return {
    grid: { left: 8, right: 16, top: 40, bottom: 28, containLabel: true },
    tooltip: {
      trigger: 'item',
      formatter: (param: ClockParam) => {
        const row = param.data?.row
        if (!row) return ''
        return `<div style="font-size:1rem"><div style="font-weight:600;margin-bottom:4px">${monthText(row.period)}</div>`
          + `<div>去趨勢值 ${row.level.toFixed(2)}</div><div>比上個月 ${signed(row.change)} 點</div>`
          + `<div>${CLOCK_ZONES[row.zone].definition}（${CLOCK_ZONES[row.zone].name}）</div></div>`
      }
    },
    xAxis: { type: 'value', name: `${indicatorName.value}去趨勢值（100＝長期趨勢）`, nameLocation: 'middle', nameGap: 28, min: xMin, max: xMax, interval: xInterval },
    yAxis: { type: 'value', name: '比上個月增減（點）', nameTextStyle: { align: 'left' }, min: -yHalf, max: yHalf, interval: yInterval },
    series: [
      {
        type: 'line',
        // 軌跡：舊到新連線，點 8px、線 2.5px（高齡友善規格）；最新一點放大，起點與最新一點標月份（看得出哪一端是起點）
        data: rows.value.map((row, index) => ({
          value: [row.level, row.change],
          row,
          symbolSize: index === last || row.period === peak ? 16 : 8,
          label: index === last || index === 0 || row.period === peak ? pointLabel(row) : { show: false }
        })),
        symbol: 'circle',
        lineStyle: { width: 2.5, color: accent },
        itemStyle: { color: accent },
        markLine: {
          silent: true,
          symbol: 'none',
          label: { show: false },
          lineStyle: { color: ink.baseline, type: 'dashed' },
          data: [{ xAxis: 100 }, { yAxis: 0 }]
        },
        markArea: {
          silent: true,
          itemStyle: { color: 'transparent' },
          data: [
            area('recovery', [xMin, yHalf], [100, 0], 'insideTopLeft'),
            area('expansion', [100, yHalf], [xMax, 0], 'insideTopRight'),
            area('contraction', [xMin, 0], [100, -yHalf], 'insideBottomLeft'),
            area('slowdown', [100, 0], [xMax, -yHalf], 'insideBottomRight')
          ]
        }
      }
    ]
  }
})

const tableRows = computed(() => [...rows.value].reverse())
const periodText = computed(() => (selectedCycle.value ? `第 ${selectedCycle.value.cycleNo} 次循環（${cycleRange(selectedCycle.value)}）` : `最近 ${rows.value.length} 個月`))

// ---- 循環表 ----
// 依國發會新聞稿補上的欄位（gov-ts 的 supplementedFields）在數字旁註明
const supplemented = (cycle: BusinessCycleReferenceCycle, field: string) => (cycle.supplementedFields.includes(field) ? '（依國發會公告）' : '')
const monthOrPending = (value: string | null) => (value ? monthText(value) : '進行中（尚未認定）')
const countOrPending = (value: number | null) => (value === null ? '進行中（尚未認定）' : `${value} 個月`)
const cycleAnswer = computed(() => {
  const list = cycles.value
  if (!list.length) return null
  const ended = list.filter(cycle => cycle.expansionMonths !== null && cycle.contractionMonths !== null)
  const average = (values: number[]) => Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
  const ongoing = list.find(cycle => cycle.troughEnd === null)
  return `國家發展委員會自 ${monthText(list[0]!.troughStart)}起共認定 ${list.length} 次景氣循環；已結束的 ${ended.length} 次，擴張期平均 ${average(ended.map(cycle => cycle.expansionMonths!))} 個月、收縮期平均 ${average(ended.map(cycle => cycle.contractionMonths!))} 個月。`
    + (ongoing ? `第 ${ongoing.cycleNo} 次自 ${monthText(ongoing.troughStart)}起，${ongoing.peak ? `${monthText(ongoing.peak)}高峰，終點` : '高峰與終點'}尚未認定。` : '')
})

const DESCRIPTION = '國家發展委員會景氣領先指標與同時指標畫在 OECD 景氣時鐘上：最近 24 個月與國發會認定的歷次景氣循環軌跡，以及每次循環的起點、高峰、終點與月數。'
const { breadcrumbs } = useHubPageSeo({
  title: '景氣時鐘：台灣景氣領先指標與同時指標的軌跡',
  description: DESCRIPTION,
  path: '/macro/business-cycle-clock',
  breadcrumbs: [
    { label: '首頁', to: '/' },
    { label: '總經特區', to: '/macro' },
    { label: '景氣時鐘', to: '/macro/business-cycle-clock' }
  ]
})
</script>

<template>
  <div class="app-page app-page--compact macro-clock-page">
    <h1 class="app-page__title macro-clock-page__title">景氣時鐘</h1>
    <StockBreadcrumb :items="breadcrumbs" />
    <MacroNav />

    <StockQuestionSection id="macro-clock-chart" question="景氣指標落在景氣時鐘的哪一區？" :answer="answer">
      <div class="macro-clock-page__controls">
        <el-radio-group v-model="indicator" aria-label="景氣指標">
          <el-radio-button v-for="(name, key) in INDICATORS" :key="key" :value="key">{{ name }}</el-radio-button>
        </el-radio-group>
        <!-- 選單只在瀏覽器裡掛（同 SharedChartCard）：el-select 的下拉在伺服器端也會 teleport，跟頁首選單的 popper 撞出 hydration 不一致 -->
        <ClientOnly v-if="cycleOptions.length">
          <el-select v-model="selectedKey" aria-label="時段" class="macro-clock-page__period">
            <el-option :value="RECENT" :label="`最近 ${RECENT_MONTHS} 個月`" />
            <el-option v-for="cycle in cycleOptions" :key="cycle.cycleNo" :value="String(cycle.cycleNo)" :label="`第 ${cycle.cycleNo} 次循環（${cycleRange(cycle)}）`" />
          </el-select>
        </ClientOnly>
      </div>
      <el-card shadow="never" class="macro-clock-page__card">
        <SharedChart class="app-chart macro-clock-page__chart" :option="chartOption" autoresize :aria-label="`${indicatorName}去趨勢值與月變動的景氣時鐘軌跡圖，${periodText}`" />
      </el-card>
      <SharedTableScroll :label="`${indicatorName}${periodText}的去趨勢值與月變動`">
        <table class="seo-table" data-ssr-table>
          <caption>{{ indicatorName }}去趨勢值與月變動，{{ periodText }}（國家發展委員會，新的在上）</caption>
          <thead>
            <tr>
              <th scope="col">月份</th>
              <th scope="col">去趨勢值</th>
              <th scope="col">比上個月</th>
              <th scope="col">所在區域</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in tableRows" :key="row.period">
              <th scope="row">{{ monthText(row.period) }}</th>
              <td class="seo-table__num">{{ row.level.toFixed(2) }}</td>
              <td class="seo-table__num">{{ signed(row.change) }}</td>
              <td>{{ CLOCK_ZONES[row.zone].definition }}（{{ CLOCK_ZONES[row.zone].name }}）</td>
            </tr>
          </tbody>
        </table>
      </SharedTableScroll>
    </StockQuestionSection>

    <StockQuestionSection v-if="cycles.length" id="macro-clock-cycles" question="國家發展委員會認定過哪幾次景氣循環？" :answer="cycleAnswer">
      <SharedTableScroll label="國家發展委員會認定的景氣循環">
        <table class="seo-table" data-ssr-table>
          <caption class="visually-hidden">國家發展委員會景氣循環基準日期：每次循環的起點、高峰、終點與擴張、收縮、全循環月數（新的在上）</caption>
          <thead>
            <tr>
              <th scope="col">循環</th>
              <th scope="col">起點</th>
              <th scope="col">高峰</th>
              <th scope="col">終點</th>
              <th scope="col" class="seo-table__num">擴張</th>
              <th scope="col" class="seo-table__num">收縮</th>
              <th scope="col" class="seo-table__num">全循環</th>
              <th scope="col">景氣時鐘</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="cycle in [...cycles].reverse()" :key="cycle.cycleNo">
              <th scope="row">第 {{ cycle.cycleNo }} 次</th>
              <td>{{ monthText(cycle.troughStart) }}{{ supplemented(cycle, 'troughStart') }}</td>
              <td>{{ monthOrPending(cycle.peak) }}{{ supplemented(cycle, 'peak') }}</td>
              <td>{{ monthOrPending(cycle.troughEnd) }}{{ supplemented(cycle, 'troughEnd') }}</td>
              <td class="seo-table__num">{{ countOrPending(cycle.expansionMonths) }}{{ supplemented(cycle, 'expansionMonths') }}</td>
              <td class="seo-table__num">{{ countOrPending(cycle.contractionMonths) }}{{ supplemented(cycle, 'contractionMonths') }}</td>
              <td class="seo-table__num">{{ countOrPending(cycle.totalMonths) }}{{ supplemented(cycle, 'totalMonths') }}</td>
              <td>
                <NuxtLink v-if="drawable(cycle)" :to="{ query: { cycle: cycle.cycleNo }, hash: '#macro-clock-chart' }" :aria-label="`在景氣時鐘上看第 ${cycle.cycleNo} 次循環`">在景氣時鐘上看</NuxtLink>
                <template v-else>—</template>
              </td>
            </tr>
          </tbody>
        </table>
      </SharedTableScroll>
      <p class="hub-answer">景氣指標的資料從 1982 年起，更早的循環只有日期，沒有可以畫在景氣時鐘上的數字。</p>
    </StockQuestionSection>

    <section class="stock-page-section" aria-labelledby="macro-clock-notes-heading">
      <h2 id="macro-clock-notes-heading" class="stock-page-section__title">看這張圖要注意什麼？</h2>
      <ul class="macro-clock-page__notes">
        <li>去趨勢值是把指標減去長期趨勢後的位置，100 代表剛好在趨勢上。四個區域的名稱是 OECD 景氣時鐘的慣用名稱，描述的是指標的位置與方向。</li>
        <li>領先指標通常比實際景氣早幾個月轉折，同時指標描述的是當月的景氣。兩者落在不同區域時，代表兩個指標的方向還不一致。</li>
        <li>國家發展委員會每月 27 日左右公布上個月的數字，所以圖上最新的一點是那個月的景氣，不是今天。</li>
        <li>去趨勢值會隨新資料重新估算而修正；指標的構成項目在 2024 年 3 月調整過。</li>
        <li>領先指標的構成項目含股價指數，股價指數未還原除權息，每年除權息季會讓它機械性地下降一些。</li>
        <li>景氣時鐘是描述景氣的一種方式，不是買賣時點的訊號；依景氣燈號進出的實證結果，報酬不如長期持有。</li>
      </ul>
      <p class="hub-answer hub-sources">資料來源：國家發展委員會景氣指標。本頁僅提供公開客觀數據與一般性資訊，不涉及任何個別有價證券之投資推介或買賣建議。</p>
    </section>
  </div>
</template>

<style scoped>
.macro-clock-page__title {
  font-weight: 600;
}

.macro-clock-page__controls {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 12px;
}

.macro-clock-page__period {
  width: min(100%, 24rem);
}

.macro-clock-page__chart {
  height: 26rem;
}

.macro-clock-page__notes {
  margin: 0;
  padding-left: 1.2em;
  display: flex;
  flex-direction: column;
  gap: 8px;
  color: var(--el-text-color-regular);
  line-height: 1.7;
}
</style>
