// GET /api/etf/distributions-ttm — 每一檔 ETF 在近 12 個完整日曆月內「已除息」的每單位配息合計。
// 持股頁的預估年度股利用它；普通股與特別股另有來源（見 app/composables/stock/useHoldings.ts）。
//
// ponytail: 權宜之計。ETF 沒有逐檔的配息端點——/stocks/{etf}/dividend-history 回空陣列、
// /screener/values 的 dividendPerShare.TTM 對 ETF 是 null——唯一的來源是全市場、一個月一次的
// ex-dividend-calendar，所以冷快取時要打 12 次上游。上限：每 6 小時 12 次呼叫、全站共用一份。
// analysis-ts 2026-10-05 說把 ETF 放進 /screener/values 是新功能（要先把 ETF 拉進他們的指標系統），
// 已轉給使用者決定；那一欄上線後刪掉這支。
//
// 口徑跟普通股的 dividendPerShare.TTM 一致：依**除息日**、只算已實現（analysis-ts 確認）。差在窗口的
// 終點——普通股是最新財報季末（會落後一季多），這裡是上個月底。頁面註腳兩種窗口都要講。
//
// 只碰全市場公開資料，任何使用者的持股都不會送到這裡。
interface CalendarEntry {
  symbol: string
  status: string
  exDate: string | null
  // ETF 專屬欄位；普通股與特別股是 null。已宣告未除息的那幾列也是 null。
  distributionPerUnit: number | null
}

export interface EtfDistributionsTtm {
  from: string
  to: string
  perUnit: Record<string, number>
}

function shiftMonth(month: string, delta: number): string {
  const [year, monthNumber] = month.split('-').map(Number)
  const date = new Date(Date.UTC(year!, monthNumber! - 1 + delta, 1))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

// 「這個月」以台北時間為準：伺服器跑在 UTC 時，每個月 1 日的前 8 小時會差一個月。
function lastCompleteTaipeiMonth(): string {
  const taipeiNow = new Date(Date.now() + 8 * HOUR * 1000)
  const thisMonth = `${taipeiNow.getUTCFullYear()}-${String(taipeiNow.getUTCMonth() + 1).padStart(2, '0')}`
  return shiftMonth(thisMonth, -1)
}

// 以窗口終點當快取鍵：跨月時鍵自動換掉，不會在新的一個月繼續供上個月的窗口。
const getEtfDistributionsTtm = defineCachedFunction(
  async (to: string): Promise<EtfDistributionsTtm> => {
    const months = Array.from({ length: 12 }, (_, index) => shiftMonth(to, index - 11))
    // 任何一個月失敗就整個失敗、不快取：少一個月的加總會默默低估配息，比沒有數字更糟。
    const responses = await Promise.all(
      months.map(month => bffFetch<{ entries: CalendarEntry[] }>('/stocks/ex-dividend-calendar', { query: { month } }))
    )
    const perUnit: Record<string, number> = {}
    const seen = new Set<string>()
    for (const response of responses) {
      for (const entry of response.entries ?? []) {
        if (entry.status !== 'realized' || entry.distributionPerUnit === null) continue
        // 同一次配息出現兩列就會被算兩次——以代號＋除息日去重，讓正確性不依賴上游不重複。
        const key = `${entry.symbol}|${entry.exDate}`
        if (seen.has(key)) continue
        seen.add(key)
        perUnit[entry.symbol] = (perUnit[entry.symbol] ?? 0) + entry.distributionPerUnit
      }
    }
    // 浮點加總會留下 4.082000000000001 這種尾巴；配息公布到小數第 4 位以內。
    for (const symbol of Object.keys(perUnit)) perUnit[symbol] = Math.round(perUnit[symbol]! * 1e4) / 1e4
    return { from: months[0]!, to, perUnit }
  },
  { name: 'etf-distributions-ttm', getKey: (to: string) => to, maxAge: 6 * HOUR, staleMaxAge: 24 * HOUR, swr: true }
)

export default defineEventHandler(async () => {
  try {
    return await getEtfDistributionsTtm(lastCompleteTaipeiMonth())
  } catch {
    throw createError({ statusCode: 503, statusMessage: 'ETF distributions unavailable' })
  }
})
