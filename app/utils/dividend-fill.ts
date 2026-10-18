import type { DividendFillEvent } from '#shared/types/dividend-history'

// 填息表與答句的文字（2026-10-18 從個股填息頁抽出，ETF 填息頁共用）。只陳述事實：不套「30 天／60 天填息率」這種門檻
//（業界慣用的切點等於站方下判斷）
export function fillDayText(fill: DividendFillEvent): string {
  if (fill.unavailableReason === 'stock-dividend') return '同次配發股票股利，不適用'
  if (fill.unavailableReason === 'before-price-history') return '無逐日股價可比對'
  if (fill.unavailableReason === 'price-break') return '期間股價有分割、減資或除權造成的跳動，無法比對'
  if (fill.filledDate === null) return '尚未回到除息前收盤價'
  return fill.tradingDays === 0 ? '除息當日' : `${fill.tradingDays} 個交易日`
}

// 「可比對的 N 次中，M 次回到除息前的價位…」；一次都不能比對時回 null，由呼叫端說原因
export function fillSummary(fills: DividendFillEvent[], noun = '現金配息'): string | null {
  const rows = fills.filter(fill => fill.unavailableReason === null)
  if (!rows.length) return null
  const filled = rows.filter(fill => fill.filledDate !== null)
  const days = filled.map(fill => fill.tradingDays!).filter(day => day > 0)
  const parts = [`可比對的 ${rows.length} 次${noun}中，${filled.length} 次的收盤價回到除息前一個交易日的價位`]
  if (days.length) parts.push(`除去當日回到的次數，最少 ${Math.min(...days)} 個交易日、最多 ${Math.max(...days)} 個交易日`)
  if (filled.length < rows.length) parts.push(`其餘 ${rows.length - filled.length} 次到目前為止尚未回到`)
  return `${parts.join('，')}。`
}

// 算不出來的原因與次數，例如「2 次年代較早、沒有逐日股價可比對」
export function fillUnavailableParts(fills: DividendFillEvent[]): string[] {
  const count = (reason: DividendFillEvent['unavailableReason']) => fills.filter(fill => fill.unavailableReason === reason).length
  return [
    count('stock-dividend') && `${count('stock-dividend')} 次同時配發股票股利`,
    count('before-price-history') && `${count('before-price-history')} 次年代較早、沒有逐日股價可比對`,
    count('price-break') && `${count('price-break')} 次在填回之前遇到分割、減資或除權造成的股價跳動`
  ].filter((part): part is string => !!part)
}
