// 期別（timeframe）的中文標籤，全站唯一一份。2026-10-11 依生態系詞彙表收斂：原本有五份副本（篩選器、指標頁、
// 個股摘要、杜邦、quick-view），各自缺 M／YTD，EOD 一份叫「最新」一份叫「每日」。四個主要期別的中文照詞彙表：
// 單季／累計／近四季／年度。新期別出現時加在這裡，篩選器的 formatPeriodLabel 會在開發模式警告漏對應的期別。
// Beta 的回看窗口同時寫出長度與取樣間隔，因為同一個長度可能配不同的取樣間隔。
export const TIMEFRAME_LABELS = {
  Q: '單季',
  YTD: '累計',
  TTM: '近四季',
  FY: '年度',
  M: '月',
  EOD: '每日',
  Q_ANN: '單季年化',
  '1Y_1D': '1年（日）',
  '2Y_1W': '2年（週）',
  '3Y_1W': '3年（週）',
  '5Y_1M': '5年（月）'
} as const satisfies Record<string, string>
