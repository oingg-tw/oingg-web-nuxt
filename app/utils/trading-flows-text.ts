import type { InstitutionalDay, MarginDay, MarginHistory, MarginMonth, MarginSuspension, MarginTradingPage } from '#shared/utils/trading-flows'

// 信用交易頁與三大法人頁的答句（2026-11-24）。張數取整數（法人的張帶零股的小數），比率到小數兩位；負數用「−」
export const lotsNumber = (value: number | null): string => (value === null ? '－' : groupThousands(Math.round(value)))
export const ratePct = (value: number | null): string => (value === null ? '－' : `${value.toFixed(2)}%`)
// 買超、賣超：「買超 371 張」「賣超 960 張」；0 是「沒有買賣超」
export function netBuyText(value: number | null): string {
  if (value === null) return '沒有資料'
  // 取絕對值再四捨五入：Math.round(-1234.5) 是 −1234，買超與賣超要對稱
  const lots = Math.round(Math.abs(value))
  return lots === 0 ? '買賣相抵' : `${value > 0 ? '買超' : '賣超'} ${groupThousands(lots)} 張`
}
// 表格裡帶正負號的張數：「+371」「−960」
export const signedLots = (value: number | null): string => {
  if (value === null) return '－'
  const lots = Math.round(Math.abs(value))
  return lots === 0 ? '0' : `${value > 0 ? '+' : '−'}${groupThousands(lots)}`
}

// 信用交易的狀態：不在名單上、暫停融資或融券
export function marginStatusText(history: Pick<MarginHistory, 'latest'>, name: string): string | null {
  const latest = history.latest
  if (!latest) return `${name}目前不能信用交易（不在融資融券的名單上）。`
  const paused = [latest.isMarginSuspended ? '融資' : '', latest.isShortSuspended ? '融券' : ''].filter(Boolean)
  return paused.length ? `${name}目前暫停${paused.join('與')}（${latest.tradeDate}）。` : null
}

// 停資停券預告的一句（2026-11-28）：「交易所預告 12/10～12/16 暫停融券（股東常會）。」只寫還沒結束的那幾段，起訖相同的併成一段
//（減資的融資、融券各一列；同一段也可能有兩個原因）。是交易所的預告，不是實際狀態（那是上面 marginStatusText 讀的旗標），所以開頭寫明
// 「交易所預告」；沒有預告就不寫，不說成「沒有暫停」：上櫃只預告融券、不寫原因，而且常漏。日期照停止買賣那一句寫 M/D，跨年或沒有迄日才帶年份
const SUSPENSION_TYPES = [['margin', '融資'], ['short', '融券']] as const

export function suspensionNoticeText(page: Pick<MarginTradingPage, 'suspensions' | 'suspensionsAsOf'>, today: string): string {
  // 瀏覽器也會跑（hydration）：不用 Map.groupBy、toSorted（iOS 15～17 沒有）
  const periods = new Map<string, MarginSuspension[]>()
  for (const item of [...liveSuspensions(page.suspensions ?? [], page.suspensionsAsOf ?? null, today)].sort((a, b) => a.startDate.localeCompare(b.startDate))) {
    const key = `${item.startDate}～${item.endDate ?? ''}`
    periods.set(key, [...(periods.get(key) ?? []), item])
  }
  const texts = [...periods.values()].flatMap((rows) => {
    // 不認得的種類不寫（說不出停的是什麼）
    const types = SUSPENSION_TYPES.filter(([type]) => rows.some(row => row.suspensionType === type)).map(([, text]) => text)
    if (!types.length) return []
    const { startDate: start, endDate: end } = rows[0]!
    const day = (iso: string) => `${!end || start.slice(0, 4) !== end.slice(0, 4) ? `${iso.slice(0, 4)}/` : ''}${monthDay(iso)}`
    const span = !end ? `${day(start)} 起` : start === end ? `${day(start)} ` : `${day(start)}～${day(end)} `
    const reasons = [...new Set(rows.flatMap(row => (row.reason?.trim() ? [row.reason.trim()] : [])))]
    return [`${span}暫停${types.join('與')}${reasons.length ? `（${reasons.join('、')}）` : ''}`]
  })
  return texts.length ? `交易所預告 ${texts.join('；')}。` : ''
}

// 「2026-11-23 融資餘額 30,970 張，融資使用率 0.48%。」
export function marginAnswer(last: MarginMonth | undefined, history: Pick<MarginHistory, 'latest'>, name: string): string {
  const status = marginStatusText(history, name)
  if (!last) return status ?? `目前沒有${name}的融資融券資料。`
  const usage = last.marginUtilizationRate === null ? '' : `，融資使用率 ${ratePct(last.marginUtilizationRate)}`
  return `${last.tradeDate} 融資餘額 ${lotsNumber(last.marginBalanceLots)} 張${usage}。${status ?? ''}`
}

export function shortAnswer(last: MarginMonth | undefined, name: string): string {
  if (!last) return `目前沒有${name}的融券資料。`
  const ratio = last.shortToMarginRatio === null ? '' : `，券資比 ${ratePct(last.shortToMarginRatio)}`
  return `${last.tradeDate} 融券餘額 ${lotsNumber(last.shortBalanceLots)} 張${ratio}。`
}

// 「2026-11-25 借券賣出的上限是 429 張。」（使用者 11-24 的「收，只放信用交易頁」）：那一天可以借券賣出的額度，不是借券的庫存，也不是已經
// 賣出的量。寫日期不寫「今天」，最新一天不一定是今天；不到 1 張不寫成 0 張，0 是不能借券賣出
export function sblLimitAnswer(last: MarginDay | undefined): string {
  const value = last?.sblShortAvailableLots ?? null
  if (!last || value === null) return ''
  return `${last.tradeDate} 借券賣出的上限${value > 0 && value < 1 ? '不到 1 張' : `是 ${lotsNumber(value)} 張`}。`
}

// 「2026-11-23 三大法人合計賣超 913 張：外資買超 371 張、投信賣超 324 張、自營商賣超 960 張。」
export function institutionalAnswer(last: InstitutionalDay | undefined, name: string): string {
  if (!last) return `目前沒有${name}的三大法人買賣超資料。`
  return `${last.tradeDate} 三大法人合計${netBuyText(last.totalNetBuyLots)}：外資${netBuyText(last.foreignNetBuyLots)}、投信${netBuyText(last.investmentTrustNetBuyLots)}、自營商${netBuyText(last.dealerNetBuyLots)}。`
}
