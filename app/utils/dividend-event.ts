// 除權息類型的讀法（2026-10-17 從觀察清單抽出，持股的配息日程共用）：上游的 exType 是「息／權／權息」
export const EX_TYPE_LABELS: Record<string, string> = { 息: '除息', 權: '除權', 權息: '除權息' }

// 自算的「一年份現金股利」怎麼取：liveDividendPerShare、liveCashDividendYield、liveShareholderYield 共用，寫法照型錄 liveCashDividendYield
// 的 description。季配、半年配加總近 12 個月已除息的；年配（歷來每次配息至少相隔 9 個月）取最近一次已除息的金額，新年度股利董事會決議或
// 除權息公告後、還沒除息時改用新的金額，決議不配為 0；還沒開董事會的那段期間照近 12 個月（analysis-ts 44e86da0 → 96d585a0 → 69e17342，
// 2026-10-25，決議來自 mops-ts 收的 MOPS 股利分派情形）。
// 產業頁、類股頁、持股頁引用這一句；殖利率排行直接顯示型錄的 description，不用這句。上游再改規則時只改這裡
export const ANNUAL_CASH_DIVIDEND_BASIS = '季配、半年配的公司加總近 12 個月已除息的現金股利，年配的公司取最近一次已除息的金額，新年度股利董事會決議或公告後、還沒除息時改用新的金額，決議不配為 0'

// 自算殖利率是 0 的說法：可能是決議不配、新年度只配股票，或近 12 個月沒有除息又還沒有新年度的決議（延後除息也會這樣），
// 所以不寫「不配息」，也不寫「近 12 個月沒有除息」（決議不配的公司可能幾個月前才除過息）
export const ZERO_YIELD_TEXT = '目前沒有可計入殖利率的現金股利'

// 配息月曆的日期都是台北日期 YYYY-MM-DD：星期與加減天數用 UTC 算，不受瀏覽器時區影響
const weekdayOf = (day: string) => new Date(`${day}T00:00:00Z`).getUTCDay()
// 股利期間怎麼讀（2026-11-24，董事會已通過的股利）：一整年是「2025 年度」，三個月是「2026 年第 2 季」，半年是「2026 年上半年／下半年」，
// 其他照起訖寫；沒有起訖就只寫年度
export function dividendPeriodLabel(fiscalYear: number, start: string | null, end: string | null): string {
  if (!start || !end) return `${fiscalYear} 年度`
  const [startYear, startMonth] = [Number(start.slice(0, 4)), Number(start.slice(5, 7))]
  const months = (Number(end.slice(0, 4)) - startYear) * 12 + Number(end.slice(5, 7)) - startMonth + 1
  if (months === 12 && startMonth === 1) return `${startYear} 年度`
  if (months === 3 && (startMonth - 1) % 3 === 0) return `${startYear} 年第 ${(startMonth + 2) / 3} 季`
  if (months === 6 && (startMonth === 1 || startMonth === 7)) return `${startYear} 年${startMonth === 1 ? '上' : '下'}半年`
  return `${start}～${end}`
}

// 董事會決議的股利（2026-11-24，配息月曆）：金額、股利期間、股東會、已知的除權息日。不寫「還沒除息」：決議裡的除權息日是數據中台對
// 分派公告接出來的，興櫃與少數上市櫃公司除過息也接不到（2025 年 1,785 筆有 109 筆看起來沒除息），沒有就是「－」
export interface DividendResolutionText {
  fiscalYear: number
  dividendPeriodStartDate: string | null
  dividendPeriodEndDate: string | null
  shareholderMeetingDate: string | null
  cashDividend: number | null
  stockDividend: number | null
  exDividendDate: string | null
  exRightsDate: string | null
}
export const resolutionAmounts = (item: DividendResolutionText): string[] =>
  [item.cashDividend ? `現金股利 ${item.cashDividend} 元` : '', item.stockDividend ? `股票股利 ${item.stockDividend} 元` : ''].filter(Boolean)

// 一天的彈窗（2026-11-24 使用者選的方案 B：除權息、董事會決議各一張表，組裡再分）用的格子。
// 每股金額最多 4 位小數（上游浮點數帶雜訊，2330 是 7.00000137；配股率傳 6，同持股的配息），0 跟沒有值都是「－」：
// 除權列的現金是 0（3706 神達的現增），寫 0 像是配了 0 元
export const perShareText = (value: number | null | undefined, digits = 4): string => (value ? String(Number(value.toFixed(digits))) : '－')
// 日期：跟那一天同一年寫「12/1」，跨年寫「2027/1/20」，沒有是「－」
export const dayInYear = (day: string | null | undefined, year: string): string => (!day ? '－' : day.startsWith(year) ? monthDay(day) : `${day.slice(0, 4)}/${monthDay(day)}`)
// 除權息的發放日：現金的發放日，只配股的寫配股發放日；兩個不同天，配股那一行標明
export function payLines(event: { paymentDate: string | null; stockDividendDistributionDate?: string | null }, year: string): string[] {
  const { paymentDate: cash, stockDividendDistributionDate: stock = null } = event
  return cash && stock && cash !== stock ? [dayInYear(cash, year), `配股 ${dayInYear(stock, year)}`] : [dayInYear(cash ?? stock, year)]
}
// 決議的除權息日：同一天或只有一個寫一個日期，兩個不同天各一行
export function resolutionExLines(item: Pick<DividendResolutionText, 'exDividendDate' | 'exRightsDate'>, year: string): string[] {
  const { exDividendDate: cash, exRightsDate: stock } = item
  return cash && stock && cash !== stock ? [`息 ${dayInYear(cash, year)}`, `權 ${dayInYear(stock, year)}`] : [dayInYear(cash ?? stock, year)]
}
const bySymbol = (a: { symbol: string }, b: { symbol: string }) => a.symbol.localeCompare(b.symbol)
// 除權息照類型分組，順序同月曆的篩選（除息、除權、除權息），組裡照代號
export function exTypeGroups<T extends { exType: string; symbol: string }>(events: T[]): { exType: string; rows: T[] }[] {
  return ['息', '權', '權息'].map(exType => ({ exType, rows: events.filter(event => event.exType === exType).sort(bySymbol) })).filter(group => group.rows.length)
}
// 董事會決議照股利期間分組：期間結束晚的在前，同一天結束的長的在前（年度、下半年、第 4 季），組裡照代號
export function resolutionGroups<T extends DividendResolutionText & { symbol: string }>(items: T[]): { label: string; rows: T[] }[] {
  const groups = new Map<string, { label: string; start: string; end: string; rows: T[] }>()
  for (const item of items) {
    const label = dividendPeriodLabel(item.fiscalYear, item.dividendPeriodStartDate, item.dividendPeriodEndDate)
    if (!groups.has(label)) groups.set(label, { label, start: item.dividendPeriodStartDate ?? `${item.fiscalYear}-01-01`, end: item.dividendPeriodEndDate ?? `${item.fiscalYear}-12-31`, rows: [] })
    groups.get(label)!.rows.push(item)
  }
  return [...groups.values()].sort((a, b) => b.end.localeCompare(a.end) || a.start.localeCompare(b.start)).map(group => ({ label: group.label, rows: group.rows.sort(bySymbol) }))
}

export const addDays = (day: string, n: number): string => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)
// 「11/8」與「11/8（日）」
export const monthDay = (day: string): string => `${Number(day.slice(5, 7))}/${Number(day.slice(8))}`
export const shortDayLabel = (day: string): string => `${monthDay(day)}（${'日一二三四五六'[weekdayOf(day)]}）`

// 這些日期（YYYY-MM-DD）有沒有週六、週日：沒有的話配息月曆不畫那兩欄（main.css 的 .app-calendar--weekdays，理由寫在那裡）
export const hasWeekendDate = (days: Iterable<string>): boolean => [...days].some(day => [0, 6].includes(weekdayOf(day)))

// 手機週檢視的那一週，週一到週五（2026-11-08）：週六、週日打開時是下一週。除權息日都在交易日（同上，量過 0 筆在週末），所以不畫六日
export function tradingWeekOf(day: string): string[] {
  const weekday = weekdayOf(day)
  const monday = addDays(day, weekday === 0 ? 1 : weekday === 6 ? 2 : 1 - weekday)
  return [0, 1, 2, 3, 4].map(n => addDays(monday, n))
}
