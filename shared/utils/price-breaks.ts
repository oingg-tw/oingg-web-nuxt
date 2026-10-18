// 股價歷史裡「不是漲跌、是股數變了」的跳動（2026-10-12，使用者：「5314 的股價歷史好像不太對」）。上游的日線是沒有還原的原始成交價，
// 遇到減資、面額變更、除權會斷崖——5314：2022-12 減資 ×4.16、2025-03 面額 10 元改 0.5 元 ×0.055、2026-08-14 除權 ×0.26。
// 使用者選了請上游提供還原股價（已向 analysis-ts 提出）；在那之前先把斷點找出來告訴讀者，不自己猜還原比例。
//
// 判斷：台股上市櫃每日漲跌幅上限 10%，相鄰兩個有成交的交易日收盤差超過 12% 就不是一般漲跌（留 2% 給四捨五入與
// 參考價調整）。上市（櫃）頭 5 個交易日沒有漲跌幅限制，所以序列的前 5 筆不判。興櫃沒有漲跌幅限制，呼叫端只給上市櫃用。
// 大額現金股利的除息日也會被抓到（2026-10-12 抽 30 檔：2603 長榮 2022-06／2023-06 的除息跌幅超過 12%——漲跌幅限制是對除息後的
// 參考價算的）。那也是「不是漲跌」的跳動，所以頁面的說法是「減資、面額變更或除權息」。30 檔裡 15 檔有至少一個月被標出。
// ponytail: 只抓得到「跳動」，說不出是哪一種、比例多少；上游給還原股價後這支就可以刪掉。
const LIMIT = 1.12
const UNLIMITED_FIRST_DAYS = 5

// 相鄰兩個有成交的交易日，收盤的變化超過漲跌幅限制能解釋的範圍（填息計算用，2026-10-18）
export const isPriceBreak = (previous: number, current: number) => current / previous > LIMIT || current / previous < 1 / LIMIT

// entries 由舊到新、只含有成交的日子；回傳發生跳動的月份（'YYYY-MM'），由舊到新、不重複
export function priceBreakMonths(entries: { tradeDate: string; close: number }[]): string[] {
  const months: string[] = []
  for (let i = Math.max(1, UNLIMITED_FIRST_DAYS); i < entries.length; i += 1) {
    const ratio = entries[i]!.close / entries[i - 1]!.close
    if (ratio > LIMIT || ratio < 1 / LIMIT) {
      const month = entries[i]!.tradeDate.slice(0, 7)
      if (months.at(-1) !== month) months.push(month)
    }
  }
  return months
}
