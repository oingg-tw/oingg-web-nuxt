// server/api/stock/[code]/dividend-yield-history.get.ts — 殖利率歷史（2026-10-15，業務中台 4dcd116 GET /stocks/:symbol/dividend-yield-history）。
// 使用者：「重新設計 dividend 該指標都先跟自己比，就像其他多數指標一樣」——原本只有今天的 EOD 快照，配股配息頁只能跟全市場比。
// 口徑跟篩選器、排行的殖利率相同（2026-10-25 起自算的 liveCashDividendYield，原本是交易所每日公布值），每月最後一個交易日取一點；
// 算不出來是 null（附 nullReason），開頭整段 null 由伺服器層拿掉。
export interface DividendYieldPoint {
  // 'YYYY-MM-DD'，該月最後一個交易日（最新一點是最近的交易日，月份還沒結束）
  tradeDate: string
  value: number | null
  nullReason: string | null
}

// 每一次現金配息（2026-10-15，使用者：「殖利率 要把現金股利做成柱狀圖放進去」）：除息日與每股現金股利（元，當時的金額、不回溯換算）。
// 來自 dividend-history 的 events，季配息的公司一年四筆
export interface CashDividendPoint {
  exDividendDate: string
  cashDividend: number
}

export interface StockDividendYieldHistoryResponse {
  symbol: string
  // 由舊到新，從第一個有值的月開始。null＝讀取失敗；空陣列＝這一檔沒有任何一個月算得出殖利率
  entries: DividendYieldPoint[] | null
  // 由舊到新；讀不到或沒配過息都是空陣列（圖上只是少了柱子，殖利率線照畫）
  cashDividends: CashDividendPoint[]
}
