<script setup lang="ts">
import type { MetricsHistoryTimeframe } from '#shared/types/metrics-history'
import type { LookbackWindow } from '~/utils/lookback-window'


// 本益比河流圖 / 淨值比河流圖, drawn the way the term conventionally means in Taiwan: the y-axis is
// 股價, each band boundary is 近四季 EPS × a PE multiple (or 每股淨值 × a PB multiple), and the line
// on top is the actual price. Because EPS/BVPS change every quarter the bands rise and fall with
// earnings — that flowing shape IS the "river"; where the price sits inside it says how the
// current valuation compares with this stock's own history.
//
// RESTORED 2026-09-21（「我希望 PER PBR 都改用河流圖 而非長條圖」, then「以前做好的卡片 裡面河流圖
// 怎麼畫的就可以拿出來用」）from the version deleted on 2026-09-20 in the 公司健檢 orphan sweep
// (commit 0067c2d). Every piece of CHART logic below — the per-symbol multiples, the stacked band
// series, the log axis, the tooltip — is that file's, unchanged, because it was already tuned
// through several rounds of live feedback（河道請幫我分五條／依各股歷史區間自動切／河流圖顏色太深
// 了／per pbr 縱軸請幫我用log）and re-deriving any of it would have quietly lost those decisions.
//
// It carries the record of the one wrong turn, too: this REPLACED an earlier attempt that plotted
// the RATIO itself inside a cumulative-percentile envelope. That was arithmetically correct and
// conceptually wrong — a running min only goes down and a running max only goes up, so both outer
// edges flatten into horizontal lines（「現在紅綠色就一條橫線」）. In ratio-space the bands are flat
// by definition; the river only exists in price-space. Do not go back.
//
// TWO things the original had are deliberately NOT restored:
//   * Its own <el-card>/StockCardTitle/expand-toggle chrome and its summary-layer percentile
//     gauge. Those belonged to 公司健檢's card-track spec; a metric page is a document（question →
//     answer → one chart）, so this is just the chart and the page owns the card around it.
//   * 原本逐支抓資料的單一指標 history composable。資料現在來自 analysis-ts 的 valuation-river 端點（2026-10-08，見資料段的註解）。
const props = defineProps<{
  symbol: string
  kind: 'pe' | 'pb' | 'ps'
}>()

// baseLabels：河道能用哪些期別、各自的基準叫什麼（第一個是預設）。只有一種的不出期別切換，同其他圖卡。提示框優先用端點回的
// baseLabel，這裡是資料到之前的備用（2026-10-23，使用者：「要標清楚 到底是單季還是近四季」）
const KINDS = {
  pe: { ratioCode: 'peRatio', ratioBasis: 'TTM', baseCode: 'eps', ratioLabel: '本益比', baseLabels: { TTM: '近四季 EPS' } },
  // ratioLabel 本淨比→淨值比 2026-09-16（「全站 本淨比 改為淨值比」）.
  // 淨值比 2026-10-23 預設改成近四季平均（analysis-ts 65c12aea，使用者：「3130 的四季淨值明顯有季節性 所以想用四季加總平均的方式平滑化
  // 來畫河流圖」），同日加回單季可選（使用者：「改成右上角 跟別的卡片一樣可以選 單季 近四季 這樣更清楚」；端點 timeframe=Q|TTM）
  pb: { ratioCode: 'pbRatio', ratioBasis: 'Q', baseCode: 'bvps', ratioLabel: '淨值比', baseLabels: { TTM: '近四季平均每股淨值', Q: '最近一季每股淨值' } },
  // 股價營收比河流圖 2026-09-21（「PSR 是不是也用河流圖比較適合?」）. The same shape as the other two
  // once the identity is checked rather than assumed: psr's own formula is 市值 ÷ 營收, which is
  // 股價 ÷ 每股營收, so 每股營收（revenuePerShare, Q+TTM in the catalog）is a real per-share base to
  // multiply the bands from. Verified numerically before wiring — 2330 2026Q2: psr 13.99 ×
  // 每股營收 171.23 = 2395.5 against a filed 股價 of 2395, and the same within rounding on 1101
  // and 2454. Without a per-share base there is no river to draw, which is why this component
  // takes a `kind` rather than any old metricCode.
  ps: { ratioCode: 'psr', ratioBasis: 'TTM', baseCode: 'revenuePerShare', ratioLabel: '股價營收比', baseLabels: { TTM: '近四季每股營收' } }
} as const

type RiverTimeframe = 'TTM' | 'Q'
const spec = computed(() => KINDS[props.kind])
const riverTimeframes = computed(() => Object.keys(spec.value.baseLabels) as RiverTimeframe[])
// 這張圖自己的期別，不跟其他卡片共用（同近N年）
const riverTimeframe = ref<RiverTimeframe>('TTM')

// 這張圖自己的近N年（2026-10-15「每個圖表的右上角狀態請分開不要共用」）。在這裡建而不是交給 useChartPeriod 預設：抓幾年要在資料
// 回來之前決定（見下面的 fetchYears），useChartPeriod 要等資料才能呼叫
const activeWindow = ref<LookbackWindow>('近5年')

// ---- 資料：analysis-ts 的河流圖專用端點（2026-10-08，經 業務中台 轉出）----
// 之前用 metrics-history 的季資料自己拼（每季一個股價點、底數用換算過的每股值），踩過兩次：先是底數換算到今天的
// 股數、股價與比率卻是當時原值，河道整條偏掉（2755「河流圖怪怪的」）；改成 價÷倍數 之後一致了，但遇到分割或大
// 比例配股，股價線與河道會一起斷崖（5904 面額 10→1 顯示成 −90%）。analysis-ts 的使用者因此決定做專用端點：
//   - prices：每日收盤，換算到今天的股數基準（分割、配股、減資換股；現金股利不調整）
//   - bases：底數的階梯，從財報**公布日**（knowledgeDate）起生效，不是季底——沒有偷看未來
//   - bandMultiples：6 條線＝5 條河道，取這檔在視窗內每日比率的 P5～P95 再均分（使用者「分五條、依各股歷史區間
//     自動切」，兩端改用 P5／P95，避免單日極端值把河道撐開；2330／2412 這類穩定的跟 min～max 幾乎一樣）
// 河道＝底數 × 倍數，在這裡乘。約一成的交易日股價會在最外兩條線之外，那就是在河外，不另外處理。
interface ValuationRiverResponse {
  lookback: { requestedYears: number; from: string; to: string }
  bandMultiples: number[] | null
  prices: { tradeDate: string; close: number }[]
  bases: { effectiveFrom: string; base: number | null }[]
  // 河道基準的名稱（例如「近四季平均每股淨值」），analysis-ts 1cf7b237 起有
  baseLabel?: string | null
}

// 這檔總共有幾期，只拿來決定期間選單哪些選項不夠長（「不滿十年不給看」）。端點只回傳要求的那段期間，看不出全部
// 歷史有多長，所以另外問一次 metrics-history（limit 1，只要 total）。
const symbolRef = computed(() => props.symbol)
const ratioBasis = computed<MetricsHistoryTimeframe>(() => spec.value.ratioBasis)
const ratioCodes = computed<string[]>(() => [spec.value.ratioCode])
const { data: latestRatio, total: mainTotal } = useMetricsHistory(symbolRef, ratioCodes, ratioBasis, ref(1))
// 這個比率對這家公司不適用（金融股的 psr：損益表沒有一般意義的營業收入，analysis-ts d8b71bdd 2026-10-08 改標
// not_applicable_industry）。河流圖端點的 bases 只回 null、不附原因，所以用同一檔最新一期比率的 nullReason 判斷。
const notApplicable = computed(() => {
  const point = latestRatio.value?.at(-1)?.values[spec.value.ratioCode]
  return point?.value === null && point.nullReason === 'not_applicable_industry'
})

// 近10年 stays disabled unless the series genuinely reaches 40 periods — the standing rule for
// every lookback selector in this app（「不滿十年不給看」）, checked on the real `total` rather than
// on how many rows happened to come back.
// 這支端點只回傳要求的那段，所以要抓幾年得在資料回來之前決定：近N年就抓收斂後的那幾年；打開自訂區間（2026-10-14，使用者：
// 「股價淨值比 右上沒有統一 為什麼?」）時改抓這檔填得滿的最長一段，再在本地切。河道倍數是端點依**抓回來那一段**算的 P5～P95，
// 自訂時就是那最長一段的歷史區間，不是滑桿選的那幾個月。選單與滑桿的狀態在下面的 useChartPeriod；這裡只算抓取範圍，所以用同一組
// lookback-window.ts 的函式，而不是自己的規則。
const customMode = ref(false)
const fetchYears = computed(() => {
  if (customMode.value) return [...LOOKBACK_YEARS].reverse().find(y => !insufficientLookbackYears(mainTotal.value).includes(y)) ?? 1
  return LOOKBACK_WINDOW_YEARS[fitLookbackWindow(activeWindow.value, mainTotal.value) ?? activeWindow.value]
})
// 股價線畫原始成交價（2026-10-13，使用者：「我要看到 8/13 那一天股價 60+，這才跟證券商的數字對得上」——5314 的
// valuation-river 價格是 14.75，原始成交價 61.3）。端點的價格換算到今天的股數，所以另外抓同一段的日線，每天乘上
// 原始價 ÷ 換算價：股價變回原始價，底數也換回當時的股數，倍數不變（同一個比例上下相乘）。代價是分割、配股、減資那天
// 股價與河道會一起斷崖——跟券商一樣。
const { data: river, status: riverStatus, error: riverError, refresh: refreshRiver } = useAsyncData(
  () => `valuation-river:${props.symbol}:${props.kind}:${fetchYears.value}:${riverTimeframe.value}`,
  async () => {
    const data = await apiFetch<ValuationRiverResponse>(`/stocks/${props.symbol}/valuation-river`, { query: { ratio: props.kind, lookbackYears: fetchYears.value, timeframe: riverTimeframe.value } })
    const daily = await apiFetch<{ entries: { tradeDate: string; close: number | null }[] }>(`/stocks/${props.symbol}/daily-price-history`, { baseURL: BUSINESS_CACHED_BASE, query: { from: data.lookback.from } })
    // 無成交日的 close 是 null 或 0，不拿來換算
    const rawByDate = new Map(daily.entries.flatMap(entry => ((entry.close ?? 0) > 0 ? [[entry.tradeDate, entry.close!] as const] : [])))
    return { ...data, rawByDate }
  },
  { server: false, lazy: true }
)
// 讀取失敗交給全站提示（2026-10-11）：原本失敗時圖區一片空白、沒有任何說明。4xx 由 reportLoadFailure 略過
watchLoadFailure(() => `valuation-river:${props.symbol}:${props.kind}:${fetchYears.value}:${riverTimeframe.value}`, () => riverError.value, refreshRiver, { scope: 'section' })


const baseLabel = computed(() => river.value?.baseLabel ?? (spec.value.baseLabels as Partial<Record<RiverTimeframe, string>>)[riverTimeframe.value] ?? spec.value.baseLabels.TTM)

interface RiverPoint {
  label: string
  price: number | null
  ratio: number | null
  base: number | null
}

// 每個交易日一個點：底數取 effectiveFrom ≤ 當天的最後一筆（bases 依日期遞增，兩邊一起往前走）。
// 底數 null 或 ≤ 0（例如近四季 EPS 虧損）那段沒有河道，倍數也不顯示。
const loadedPoints = computed<RiverPoint[]>(() => {
  const data = river.value
  if (!data) return []
  const bases = data.bases
  // 日線缺的那天沿用前一天的比例；開頭就缺的用第一個有的
  let factor = data.prices.map(day => data.rawByDate.get(day.tradeDate)! / day.close).find(Number.isFinite) ?? 1
  let k = -1
  return data.prices.map((day) => {
    while (k + 1 < bases.length && bases[k + 1]!.effectiveFrom <= day.tradeDate) k++
    const raw = data.rawByDate.get(day.tradeDate)
    if (raw !== undefined) factor = raw / day.close
    const restated = k >= 0 ? bases[k]!.base : null
    const base = restated !== null && restated > 0 ? restated * factor : null
    const price = raw ?? day.close * factor
    return { label: day.tradeDate, price, ratio: base === null ? null : price / base, base }
  })
})

const months = computed(() => [...new Set(loadedPoints.value.map(point => point.label.slice(0, 7)))])
// 刻度用月份（每日一點、8 年約兩千個交易日，一格一天的滑桿用方向鍵調不動）。total 換成月數：端點只回傳一段，這檔的深度看
// metrics-history 的季數
const { period, shown: shownMonths, fittedWindow, active: customActive } = useChartPeriod({
  all: months,
  keyOf: month => month,
  perYear: 12,
  total: () => (mainTotal.value === null ? null : mainTotal.value * 3),
  window: activeWindow
})
// 連一年都沒有時取代圖表的那一句
const shortfall = computed(() => (fittedWindow.value === null ? lessThanAYearText(mainTotal.value) : null))
// 打開自訂就改抓最長的一段；選回近N年（選單會先收起自訂）就回到那個年數
watch(customActive, (active) => {
  customMode.value = active
})
const points = computed(() => {
  if (!customActive.value) return loadedPoints.value
  const keep = new Set(shownMonths.value)
  return loadedPoints.value.filter(point => keep.has(point.label.slice(0, 7)))
})

const hasAnyData = computed(() => points.value.some(point => point.price !== null))


// 5 visible bands（「河道請幫我分五條」）means 6 boundary levels — a band is the gap between two
// adjacent ones. The multiples are NOT a fixed site-wide ladder（「依各股歷史區間自動切」）: each stock's
// own P5～P95 split evenly, computed by analysis-ts（see the data comment above）.
const BAND_COUNT = 5
const levels = computed<number[] | null>(() => {
  const multiples = river.value?.bandMultiples
  return multiples && multiples.length === BAND_COUNT + 1 ? multiples : null
})

// A non-positive base (a loss-making quarter's EPS) becomes null rather than a plotted point: a
// negative band boundary is meaningless for a valuation band and can't sit on a log axis anyway.
const boundaries = computed<(number | null)[][]>(() => {
  const multiples = levels.value
  if (!multiples) return []
  return multiples.map(multiple => points.value.map(point => (point.base !== null && point.base > 0 ? point.base * multiple : null)))
})

// Y extent pinned to the highest/lowest value actually PLOTTED（「上緣改為最高繪製」）— price line
// or any band boundary. Left unpinned, a log axis rounds out to the next power of ten and leaves
// most of the chart empty.
const axisExtent = computed<{ min: number; max: number } | null>(() => {
  const prices = points.value.map(point => point.price).filter((value): value is number => value !== null && value > 0)
  const bandValues = boundaries.value.flat().filter((value): value is number => value !== null && value > 0)
  const all = [...prices, ...bandValues]
  if (!all.length) return null
  return { min: Math.min(...all), max: Math.max(...all) }
})

const { resolvedMode, color: accentColorName, market } = useAppTheme()
// Price line follows the user's own accent colour（「那條顏色要跟著網站主題色變動」）.
const lineColor = computed(() => getAccentColor(resolvedMode.value, accentColorName.value))
const chartInk = computed(() => getChartInk(resolvedMode.value))
// The site-wide up/down convention, kept for this chart specifically（「紅綠配色還是要帶的」）— an
// explicit exception to the neutral-colour rule the rest of this app's charts follow. The bands
// are also never the only cue: the tooltip names the band a point sits in, in 倍 terms.
const bandPalette = computed(() => {
  const priceColors = getPriceColors(resolvedMode.value, market.value)
  return riverColors(priceColors.up, priceColors.down, BAND_COUNT)
})

const formatMultiple = (value: number): string => `${value.toFixed(1)}倍`

// 提示框的「河道位置」：名稱＋倍數範圍（2026-10-21 加名稱，同篩選器的河道位置欄位）。河外的兩塊也寫出來——原本低於最下面那條線
// 什麼都不寫、高於最上面那條線算成最上面那條河道
function bandTextFor(value: number): string | null {
  const multiples = levels.value
  if (!multiples) return null
  const zone = riverZoneIndex(value, multiples)
  const name = RIVER_ZONE_NAMES[zone]
  if (zone === 0) return `${name}（低於 ${formatMultiple(multiples[0]!)}）`
  if (zone === multiples.length) return `${name}（高於 ${formatMultiple(multiples.at(-1)!)}）`
  return `${name}（${formatMultiple(multiples[zone - 1]!)}～${formatMultiple(multiples[zone]!)}）`
}

// ECharts stacks the band series, so every series above the bottom one carries only its own gap
// above the previous boundary. A null boundary stays null in every band at that point (a real
// gap), never coerced to 0.
function bandSeries() {
  const rows = boundaries.value
  if (!rows.length) return []
  return rows.map((own, k) => ({
    name: `level${k}`,
    type: 'line' as const,
    data:
      k === 0
        ? own
        : own.map((value, i) => {
          const previous = rows[k - 1]![i] ?? null
          return value === null || previous === null ? null : value - previous
        }),
    stack: 'river',
    showSymbol: false,
    silent: true,
    // 不平滑：底數在財報公布日跳一階，河道照實跳
    lineStyle: { width: 0 },
    itemStyle: { color: bandPalette.value.lines[k] },
    // opacity 0.28, lowered from 0.45（「河流圖顏色太深了 要淺一點」）.
    ...(k > 0 ? { areaStyle: { color: bandPalette.value.fills[k - 1], opacity: 0.28 } } : {}),
    z: 1
  }))
}

interface AxisTooltipParam { dataIndex?: number }

const chartOption = computed(() => ({
  grid: { left: 8, right: 16, top: 36, bottom: 28, containLabel: true },
  tooltip: {
    trigger: 'axis',
    axisPointer: { type: 'line', lineStyle: { color: chartInk.value.baseline } },
    formatter: (params: AxisTooltipParam | AxisTooltipParam[]) => {
      const list = Array.isArray(params) ? params : [params]
      const point = points.value[list[0]?.dataIndex ?? 0]
      if (!point) return ''
      const rowStyle = 'display:flex;justify-content:space-between;gap:16px;padding:2px 0;'
      const row = (label: string, value: string, muted = false) =>
        `<div style="${rowStyle}${muted ? `color:${CHART_TOOLTIP_INK.secondary};` : ''}"><span>${label}</span><strong>${value}</strong></div>`
      const band = point.ratio !== null ? bandTextFor(point.ratio) : null
      // 尚無資料, not the original's 資料不足 — that phrasing is in this app's own compliance
      // register (shared/utils/compliance-words.ts) and was restored-and-corrected here rather
      // than carried over verbatim with the rest of the chart.
      return `<div style="font-size: 1rem;min-width:170px;">
        <div style="font-weight:600;margin-bottom:4px;">${point.label}</div>
        ${point.price !== null ? row('收盤價', `${groupThousands(point.price.toFixed(2))} 元`) : row('收盤價', '尚無資料', true)}
        ${point.base !== null ? row(baseLabel.value, `${groupThousands(point.base.toFixed(2))} 元`) : ''}
        ${point.ratio !== null ? row(spec.value.ratioLabel, formatMultiple(point.ratio)) : row(spec.value.ratioLabel, '尚無資料', true)}
        ${band ? row('河道位置', band, true) : ''}
      </div>`
    }
  },
  xAxis: {
    type: 'category',
    data: points.value.map(point => point.label),
    // 每日一點，標籤只寫年月
    axisLabel: { formatter: (value: string) => value.slice(0, 7) }
  },
  // Log scale（「per pbr 縱軸請幫我用log」）— price here can span a wide multiple (2330's own 近5年
  // window runs ~500元 to ~2,400元), where a linear axis compresses the early, cheaper years into a
  // flat sliver at the bottom. Log gives equal PERCENTAGE moves equal visual distance, which is
  // also the more honest read: a 10% move means the same thing at 500元 or at 2,000元.
  yAxis: {
    type: 'log',
    name: '元',
    logBase: 10,
    ...(axisExtent.value ? { min: axisExtent.value.min, max: axisExtent.value.max } : {}),
    axisLabel: { formatter: formatLogAxisTick }
  },
  series: [
    ...bandSeries(),
    {
      name: '收盤價',
      type: 'line',
      // 每日收盤，沒有「轉折點」可標（高齡友善規格的 ≥ 8px 標記是給季資料那種疏的點，2026-09-30）；
      // 也不平滑——每日資料本身就夠細，平滑只會畫出不存在的價格
      showSymbol: false,
      lineStyle: { width: 2.5, color: lineColor.value },
      itemStyle: { color: lineColor.value },
      data: points.value.map(point => point.price),
      z: 10
    }
  ]
}))
</script>

<template>
  <SharedChartCard :period="period">
    <template v-if="$slots.header" #header>
      <slot name="header" />
    </template>
    <!-- 期別在近N年的左邊，同 StockMetricHistoryChartInteractive；只有一種期別（本益比、股價營收比）就不出 -->
    <template v-if="riverTimeframes.length > 1" #controls>
      <el-radio-group v-model="riverTimeframe" aria-label="期別">
        <el-radio-button v-for="tf in riverTimeframes" :key="tf" :value="tf">{{ TIMEFRAME_LABELS[tf] }}</el-radio-button>
      </el-radio-group>
    </template>
    <!-- The shortfall wins over the generic empty line: it names both numbers, so the reader can
         tell「這家公司只有這麼短」from「你們沒有資料」. 載入中與讀取失敗都先保留圖的位置，不出文字。
         (No comment between the v-if branches: in dev the client compiles a commented branch into a fragment and SSR doesn't —
         a hydration mismatch on every river page, found 2026-10-15.) -->
    <p v-if="notApplicable" class="valuation-river__empty">{{ spec.ratioLabel }}{{ NULL_REASON_SHORT_LABELS.not_applicable_industry }}，所以沒有河流圖。</p>
    <p v-else-if="shortfall" class="valuation-river__empty">{{ shortfall }}</p>
    <SharedChart v-else-if="hasAnyData" class="valuation-river__chart" :option="chartOption" autoresize />
    <div v-else-if="riverStatus !== 'success'" class="valuation-river__chart" :class="{ 'app-skeleton': riverStatus !== 'error' }" aria-hidden="true" />
    <p v-else class="valuation-river__empty">目前沒有這檔股票的{{ spec.ratioLabel }}歷史資料。</p>
  </SharedChartCard>
</template>

<style scoped>
.valuation-river__chart {
  width: 100%;
  height: 20rem;
  margin-top: 12px;
}

.valuation-river__empty {
  margin: 0;
}</style>
