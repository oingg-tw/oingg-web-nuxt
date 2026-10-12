// 淨值組成（股本、資本公積…）2026-10-12 併進 shared/types/stock-balance-composition.ts（資產、負債、淨值同一支路由），這裡只剩每股淨值的逐年變動。

// 每股淨值的逐年變動拆解（GET /api/stock/:code/book-value-breakdown，轉自 業務中台 的
// /stocks/:symbol/book-value-breakdown，analysis-ts 2026-09-27 上線）。
//
// 跟上面的存量組成是不同的問題：這張回答「這一年淨值為什麼變多／變少」，上面那張回答「此刻的淨值
// 由什麼構成」。單位也不同——這裡是元／股，而且**已經換算到今天的股數基準**（分割、配股追溯換算掉），
// 所以逐年可以直接相比。
//
// 每一列恆等：openingBvps + 中間六項 = closingBvps，**精確到分，不需要容差**
// （2026-09-27 量 30 家 144 列，整數分殘差 144/144 = 0）。上游的做法是各項先四捨五入，再用
// 「期末 − 期初 − 各項」倒推 other，讓進位差額全部由 other 吸收。
//
// 副作用：**`other` 非零不代表這家公司有特殊的權益調整**，可能只是被塞進去的進位差。實測 144 列裡
// 80 列的 |other| > 0.03（那些是真的：庫藏股買回、員工酬勞、子公司持股變動），39 列在 0.01~0.03
// 之間分不出來。圖上不特別處理——那個量級在以元為單位的柱子裡是次像素，本來就看不見，表格照實列。
// 要寫文案的時候別把「其他」講成「特殊調整」。
export interface BookValueBreakdownEntry {
  fiscalYear: number
  openingBvps: number
  netIncome: number
  otherComprehensiveIncome: number
  // 現金股利，本來就是負值，不要取絕對值（2330 的 2025 年度是 −20.5）。
  cashDividends: number
  // 現金增資、可轉債轉換這種真的有錢進來的。跟 shareCountEffect 是兩件事。
  capitalIssued: number
  // 配股、分割、減資讓分母變了而權益總額沒變的那一塊。
  shareCountEffect: number
  other: number
  closingBvps: number
}

export interface StockBookValueBreakdownResponse {
  symbol: string
  entries: BookValueBreakdownEntry[]
}
