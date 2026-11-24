import type { InstitutionalDay, MarginHistory, MarginMonth } from '#shared/utils/trading-flows'

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

// 「2026-11-23 三大法人合計賣超 913 張：外資買超 371 張、投信賣超 324 張、自營商賣超 960 張。」
export function institutionalAnswer(last: InstitutionalDay | undefined, name: string): string {
  if (!last) return `目前沒有${name}的三大法人買賣超資料。`
  return `${last.tradeDate} 三大法人合計${netBuyText(last.totalNetBuyLots)}：外資${netBuyText(last.foreignNetBuyLots)}、投信${netBuyText(last.investmentTrustNetBuyLots)}、自營商${netBuyText(last.dealerNetBuyLots)}。`
}
