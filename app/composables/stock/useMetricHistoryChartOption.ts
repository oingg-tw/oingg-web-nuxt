import type { MetricsHistoryTimeframe } from '#shared/types/metrics-history'

// 「points → ECharts 長條 option」的組裝（2026-09-21 從圖表元件抽出）。StockMetricHistoryChartInteractive 從 reactive 的抓取
// 自己組 `points` 再呼叫這裡；徽章頁 2026-09-29 起也用同一張互動圖，靜態版已刪。
export interface MetricHistoryPoint {
  fiscalYear: number
  fiscalQuarter: number | null
  // null＝這一期沒有值（中間的缺口，留空位不跳過）；nullReason 給提示框說原因
  value: number | null
  nullReason?: string | null
}

export function useMetricHistoryChartOption(
  points: Ref<MetricHistoryPoint[]>,
  topic: Ref<string>,
  unit: Ref<string>,
  timeframe: Ref<MetricsHistoryTimeframe>,
  // 營收這類年增率畫成「是去年的幾倍」的對數（GROWTH_LOG_METRICS，app/utils/growth-log-scale.ts）；營收 0（−100%）畫到最底、灰色
  growthLog = false,
  // 三率（MARGIN_CAP_METRICS，app/utils/margin-cap.ts）：柱子最多畫到 ±100%，超出的畫到邊上、邊上加箭頭，提示框照舊寫原數字
  marginCap = false
) {
  const periodLabel = (fiscalYear: number, fiscalQuarter: number | null): string =>
    timeframe.value === 'FY' ? `${fiscalYear}` : `${fiscalYear} Q${fiscalQuarter}`

  const valueTextOf = (value: number): string => `${formatSignificantDigits(value, 4)}${unit.value}`

  const { resolvedMode, market } = useAppTheme()
  const priceColors = computed(() => getPriceColors(resolvedMode.value, market.value))
  const mutedInk = computed(() => getChartInk(resolvedMode.value).muted)

  interface BarTooltipParam { dataIndex?: number }

  // 截不截、截哪一邊；呼叫端照 capped 在圖上方畫箭頭的說明（SharedChartLegend）
  const bounds = computed(() => (marginCap ? marginBounds(points.value.flatMap(entry => (entry.value === null ? [] : [entry.value]))) : null))
  const capped = computed(() => bounds.value !== null)
  const capOf = (value: number | null) => (value === null ? null : cappedPoint(value, bounds.value))

  const chartOption = computed(() => {
    const list = points.value
    return {
      // top 28：y 軸名稱（單位）畫在格線上方，16 時它有 10px 落在 SVG 外被切掉（2026-10-15 量到）
      grid: { left: 8, right: 16, top: 28, bottom: 28, containLabel: true },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: BarTooltipParam | BarTooltipParam[]) => {
          const entry = list[(Array.isArray(params) ? params[0] : params)?.dataIndex ?? 0]
          if (!entry) return ''
          return `<div style="font-size:1rem"><div style="font-weight:600;margin-bottom:4px">${periodLabel(entry.fiscalYear, entry.fiscalQuarter)}</div>${entry.value === null ? nullReasonShortText(entry.nullReason) : valueTextOf(entry.value)}</div>`
        }
      },
      xAxis: {
        type: 'category',
        data: list.map(entry => periodLabel(entry.fiscalYear, entry.fiscalQuarter)),
      },
      yAxis: {
        type: 'value',
        name: unit.value,
        ...(growthLog ? growthLogAxis(list.flatMap(entry => (entry.value === null ? [] : [entry.value]))) : {}),
        ...bounds.value
      },
      series: [
        {
          name: topic.value,
          type: 'bar',
          // 紅綠配色，而且**跟使用者自己的市場慣例連動**（2026-10-01 直接指示：「柱狀圖，改用紅綠
          // 配色作為主色調，這個顏色會跟主題的紅綠配色連動」）。顏色來自 getPriceColors，所以台股
          // 慣例是正紅負綠、歐美慣例自動翻轉、選了 ACCESSIBLE 的人拿到藍／橘——跟站上線圖、河流圖
          // 用的是同一支函式，不會出現「同一個漲跌概念在兩張圖上顏色相反」。
          //
          // 按**數值正負**上色，不是按跟前一期的增減。這是 2026-10-02 使用者確認過的決定
          //（「顏色是按數值正負上色」），不是推論出來的預設值——所以**不要改成按增減上色**。
          //
          // 理由：這張圖畫的是水準不是動能（每股盈餘 1.2 元就是賺錢，跟上一季比較低不代表虧損）。
          // 全為正的指標（負債比率、週轉天數…）因此整排同色，那是正確的——顏色在那種資料上本來
          // 就不帶資訊，不該硬造一個方向出來。
          //
          // **最後一柱不再用特別的顏色**（同日指示）。原本把它染成墨色當「現在在這裡」的提示，
          // 但 X 軸最右邊本來就是最新一期，而那個染色會跟正負上色打架：一根虧損的最新期會變成墨色，
          // 讀者看不出它是負的。
          // growthLog：營收 0（−100%）沒有倍數，畫到最底、灰色
          data: list.map(entry => ({
            value: capOf(entry.value)?.value ?? (growthLog && entry.value !== null ? growthLogValue(entry.value) : entry.value),
            itemStyle: { color: growthLog && entry.value !== null && entry.value <= -100 ? mutedInk.value : (entry.value ?? 0) < 0 ? priceColors.value.down : priceColors.value.up }
          }))
        },
        // 截到邊上的柱子，邊上畫一個箭頭：只有箭頭、沒有線的一條折線（不用多註冊 markPoint）。往裡收半個箭頭，不被繪圖區切掉。
        // 不給名字：SharedChart 用各 series 的名字組 aria-label，箭頭不是資料
        ...(bounds.value
          ? [{
              name: '',
              type: 'line',
              silent: true,
              z: 4,
              tooltip: { show: false },
              emphasis: { disabled: true },
              lineStyle: { opacity: 0 },
              itemStyle: { color: mutedInk.value },
              connectNulls: false,
              data: list.map((entry) => {
                const cap = capOf(entry.value)
                return cap ? { value: cap.value, symbol: 'arrow', symbolSize: 12, symbolRotate: cap.up ? 0 : 180, symbolOffset: [0, cap.up ? 6 : -6] } : null
              })
            }]
          : [])
      ]
    }
  })

  return { chartOption, capped }
}
