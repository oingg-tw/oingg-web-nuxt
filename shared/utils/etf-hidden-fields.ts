// 投信投顧公會（SITCA）獨有的 ETF 欄位先藏起來（2026-11-23，使用者：「確定需要授權的就先暫緩」，範圍選「只藏獨有的」）。公會的網站條款
// 要求使用前先取得同意；兩所 OpenAPI、FundClear 或 MOPS 也有給的（規模、受益人數、淨申購、報酬、年度總費用率與各項費用、基金類型…）
// 照「MOPS、FundClear 算已授權」的原則照常顯示（使用者 11-22、11-23）。清單是數據中台逐欄對到上游 view、基金後台確認原始發布者的結果
//（11-23 定稿：只剩這四欄；近 12 個月估算是用公會的逐月費用算的）。
// 藏的意思：/api/etf/:code 不送到瀏覽器、ETF 篩選的型錄與欄位當成不存在（查詢不帶、存檔的條件寫「已下架的條件」）、ETF 頁不畫。
// 取得同意或找到已授權的來源就從這裡拿掉，畫面跟著回來（近 2 年報酬數據中台可以改用 FundClear 淨值加配息自己算）
export const SITCA_ONLY_ETF_FIELDS: ReadonlySet<string> = new Set([
  'dcaAmount',
  'return2y',
  'trailing12MonthExpenseRatioPct',
  'trailing12MonthExpenseRatioMonths'
])

export function withoutSitcaOnly<T extends object>(record: T): T {
  return Object.fromEntries(Object.entries(record).filter(([key]) => !SITCA_ONLY_ETF_FIELDS.has(key))) as T
}
