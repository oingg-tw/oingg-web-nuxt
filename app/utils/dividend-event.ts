// 除權息類型的讀法（2026-10-17 從觀察清單抽出，持股的配息日程共用）：上游的 exType 是「息／權／權息」
export const EX_TYPE_LABELS: Record<string, string> = { 息: '除息', 權: '除權', 權息: '除權息' }

// 自算的「一年份現金股利」怎麼取（analysis-ts 44e86da0，2026-10-25）：liveDividendPerShare、liveCashDividendYield、liveShareholderYield 共用。
// 季配、半年配加總近 12 個月已除息的；年配（歷來每次配息至少相隔 9 個月）只取最近一次，新年度已公告、還沒除息時先用上一次的金額。
// 殖利率排行、產業頁、持股頁的說明都引用這一句，上游再改規則時只改這裡
// 自算殖利率是 0 的說法：只代表近 12 個月沒有除息，不寫「不配息」——已決議、還在等除息的也是 0（3040 114 年度已決議現金 0.40 元，
// 配股等主管機關核准才定除息日；mops-ts 2026-10-25 查證）
export const NO_EX_DIVIDEND_TEXT = '近 12 個月沒有除息'
export const ANNUAL_CASH_DIVIDEND_BASIS ='季配、半年配的公司加總近 12 個月已除息的現金股利，年配的公司取最近一次已除息的金額（新年度已公告、還沒除息時，先用上一次的金額）'

// 這些日期（YYYY-MM-DD）有沒有週六、週日：沒有的話配息月曆不畫那兩欄（main.css 的 .app-calendar--weekdays，理由寫在那裡）
export const hasWeekendDate = (days: Iterable<string>): boolean => [...days].some(day => [0, 6].includes(new Date(`${day}T00:00:00Z`).getUTCDay()))
