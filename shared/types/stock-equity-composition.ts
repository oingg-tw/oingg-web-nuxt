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
  rocYear: number
  season: number
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
