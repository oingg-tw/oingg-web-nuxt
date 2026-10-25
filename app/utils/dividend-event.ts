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

// 這些日期（YYYY-MM-DD）有沒有週六、週日：沒有的話配息月曆不畫那兩欄（main.css 的 .app-calendar--weekdays，理由寫在那裡）
export const hasWeekendDate = (days: Iterable<string>): boolean => [...days].some(day => [0, 6].includes(new Date(`${day}T00:00:00Z`).getUTCDay()))
