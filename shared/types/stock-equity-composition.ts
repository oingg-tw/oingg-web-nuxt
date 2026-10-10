// 歸屬母公司權益的六項組成，逐年一根柱子（GET /api/stock/:code/equity-composition）。
//
// 恆等式（2026-09-27 抽 5 檔 × 22 期實測，110 期裡 108 期精確成立到元、零筆對不上，2884 銀行也成立）：
//   股本 + 資本公積 + 保留盈餘 + 其他權益 − 庫藏股 = 歸屬母公司權益
//
// 上游欄位名跟直覺不一樣，抄的時候別改：資本公積的總額是 `capital_reserve`（不是 capital_surplus，
// 那一串是它的明細），股本是 `issued_capital`。第四項 `other_equity_interest` 一開始被我當成特別股
// 股本，是 analysis-ts 指出來的——2330 的 `preference_share` 是 null，那 497 億是換算差額與 FVOCI
// 評價，而且它可以是負的（匯率），堆疊圖要能處理負值。
export interface EquityCompositionPeriod {
  // 西元（2026-10-10 起上游回西元，原本這裡存民國年）
  fiscalYear: number
  fiscalQuarter: number
  label: string
  // 全部單位新台幣千元，跟上游一致——換算成億元是顯示層的事。treasuryShares 存正值，恆等式減它。
  issuedCapital: number
  capitalReserve: number
  retainedEarnings: number
  otherEquity: number
  treasuryShares: number
  equity: number
  // 五項加減起來跟 equity 差多少（千元）。留著而不是只留一個 boolean：金融業對不上的時候（analysis-ts
  // 抽到 6005 證券商）差額大小本身就是線索，而 0/1 只會讓人重新去量一次。
  residual: number
}

export interface StockEquityCompositionResponse {
  symbol: string
  periods: EquityCompositionPeriod[]
}

// 每股淨值的逐年變動拆解（GET /api/stock/:code/book-value-breakdown，轉自 bff-ts 的
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
