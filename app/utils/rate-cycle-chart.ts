import type { TaiexPoint } from '#shared/types/hub'

// 三個利率頁（央行／聯準會／歐洲央行）共用的圖與答句（2026-10-08 抽出，三頁原本各一份 90 行、只差欄位名與文案）。
// 圖：加權指數月收盤（對數軸——2026-09-21「大盤股價要用LOG 不然早期的數據會被擠成一條線」，min/max 釘在實際畫的範圍，
// 不然對數軸會外推到下一個 10 的次方、圖大半是空的）＋一支代表利率的階梯線（step: 'end'——政策利率在兩次決議之間就是持平），
// 雙軸是刻意的：利率是階梯、是政策工具不是市場結果，不會被誤看成第二條價格線；兩邊各自標準化反而抹掉「利率是幾趴」。
// 高齡友善規格（2026-09-30）：折線 ≤ 2 條、線寬 ≥ 2.5px、轉折點 8px 實心標記。不做任何因果宣稱：每句都是日期或算術。
export interface RateCycleChartText<E> {
  rateOf: (event: E) => number | null
  changeOf: (event: E) => number | null
  // tooltip 裡利率那一行、圖例、右軸名
  rateLabel: string
  seriesName: string
  axisName: string
  rateText: (value: number) => string
  // tooltip「本月 …」那一行的前綴（ECB 要寫明是存款機制利率）
  decidedLabel?: string
}

export function rateCycleChartOption<E extends { effectiveDate: string }>(
  events: E[],
  points: TaiexPoint[],
  mode: Parameters<typeof getAccentColor>[0],
  accentName: Parameters<typeof getAccentColor>[1],
  text: RateCycleChartText<E>
) {
  const labels = points.map(point => point.tradeDate)
  // 利率一路帶到下一次決議：階梯序列。指數序列起點之前沒有事件的月份給 null，線從有資料的地方開始
  const byMonth = labels.map(date => {
    let current: number | null = null
    for (const event of events) {
      if (event.effectiveDate <= date) current = text.rateOf(event)
      else break
    }
    return current
  })
  const accent = getAccentColor(mode, accentName)
  const ink = getChartInk(mode)
  const closes = points.map(point => point.close).filter(close => close > 0)
  const indexExtent = closes.length ? { min: Math.min(...closes), max: Math.max(...closes) } : {}
  return {
    grid: { left: 8, right: 8, top: 48, bottom: 28, containLabel: true },
    legend: { top: 0 },
    tooltip: {
      trigger: 'axis',
      formatter: (params: { dataIndex?: number } | { dataIndex?: number }[]) => {
        const index = (Array.isArray(params) ? params[0] : params)?.dataIndex ?? 0
        const point = points[index]
        if (!point) return ''
        const rate = byMonth[index] ?? null
        const decided = events.find(event => event.effectiveDate.slice(0, 7) === point.tradeDate.slice(0, 7))
        return `<div style="font-size:1rem"><div style="font-weight:600;margin-bottom:4px">${point.tradeDate}</div>`
          + `<div>加權指數 ${point.close.toLocaleString('zh-TW', { maximumFractionDigits: 0 })}</div>`
          + (rate === null ? '' : `<div>${text.rateLabel} ${text.rateText(rate)}</div>`)
          + (decided ? `<div style="color:${CHART_TOOLTIP_INK.secondary}">${text.decidedLabel ?? '本月'} ${rateChangeText(text.changeOf(decided))}</div>` : '')
          + '</div>'
      }
    },
    xAxis: { type: 'category', data: labels },
    yAxis: [
      { type: 'log', logBase: 10, name: '指數', ...indexExtent, axisLabel: { formatter: formatLogAxisTick } },
      { type: 'value', name: text.axisName, splitLine: { show: false }, axisLabel: { formatter: (value: number) => `${value}%` } }
    ],
    series: [
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
        name: text.seriesName,
        type: 'line',
        yAxisIndex: 1,
        step: 'end',
        showSymbol: true,
        symbolSize: 8,
        lineStyle: { width: 2.5, type: 'dashed', color: ink.primary },
        itemStyle: { color: ink.primary },
        connectNulls: false,
        data: byMonth
      }
    ]
  }
}

// 圖只從指數序列的起點畫起、表是完整歷史，差幾筆要講出來，不然讀者會以為圖漏畫了。指數序列的起點是這支端點自己的起點
//（2026-10-08 量到 1990-01-31，建頁時是 1999-01-30）：gov-ts 另有一份 1987 起的月序列，但那是月「平均」不是月底收盤，不混用。
export function rateCycleSpanAnswer(points: TaiexPoint[], events: { effectiveDate: string }[], rateLine: string): string | null {
  if (points.length < 2) return null
  const first = points[0]!.tradeDate
  const earlier = events.filter(event => event.effectiveDate < first).length
  return `下圖兩條線分別是台灣的加權股價指數月收盤（共 ${points.length} 個月，${first} 至 ${points[points.length - 1]!.tradeDate}）與${rateLine}，畫在同一個時間軸上。利率為階梯狀，因為它只在決議生效當天改變。${earlier ? `更早的 ${earlier} 次調整沒有畫進圖裡，指數序列從 ${first} 才開始，它們都在下面的表格裡。` : ''}`
}
