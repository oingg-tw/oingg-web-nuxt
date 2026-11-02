import type { HoldingMarket, HoldingMarketFields } from '~/composables/holdings/holdings-model'

// 持股的市場資料（2026-10-08 從 useHoldings 拆出）：useState，持股各頁共用一份。
//   - 持股列：業務中台 在 GET /holdings 與分享頁的每一列附上收盤、前一日收盤、每股股利、殖利率（136e5d6，2026-11-02），marketOf 換成頁面
//     用的樣子。原本這裡自己打 POST /screener/values、每檔 ETF 一支配息、整份特別股清單，再合併三種股利；合併規則現在在數據中台
//   - 已實現損益的代號（出清的不在 GET /holdings）：loadQuotes 只補收盤價
//   - 大盤殖利率
interface ScreenerValue { value: string | null; knowledgeDate: string | null }

// ponytail: /screener/values 一次最多 200 檔；超過的不會有報價，頁面會照實算進「沒有報價」。
// 真的有人出清過 200 檔以上再分批。
const SCREENER_VALUES_MAX = 200

// 持股列（GET /holdings、分享頁）附的市場資料 → 頁面用的樣子。close 是最近一筆有成交的收盤（算市值），dayClose 是最新交易日當天的收盤
//（今日漲跌，那天沒成交是 null）
export const marketOf = (row: HoldingMarketFields): HoldingMarket => ({
  price: row.close ?? null,
  priceDate: row.tradeDate ?? null,
  dayPrice: row.dayClose ?? null,
  dayPriceDate: row.dayCloseTradeDate ?? null,
  previousClose: row.previousClose ?? null,
  dividendPerShare: row.dividendPerShare ?? null,
  dividendYield: row.dividendYield == null ? null : Number(row.dividendYield),
  yieldDate: row.dividendYieldTradeDate ?? null
})

export function useHoldingsMarket() {
  // ponytail: 報價在這個分頁裡快取到整頁重新整理或帳本重讀為止。一天才變一次，有人反映「價格沒更新」再加 TTL。
  const market = useState<Record<string, HoldingMarket>>('holdings-market', () => ({}))
  const quotesFailed = useState('holdings-quotes-failed', () => false)
  const etfWindow = useState<{ from: string; to: string } | null>('holdings-etf-window', () => null)
  // 大盤殖利率（GET /macro/equity-risk-premium 的 supplySide.dividendYield）：交易所公布的個股殖利率、依市值加權、
  // 只含上市公司。一天才變一次，分頁內抓一次。
  const marketYield = useState<{ value: number; date: string | null } | null>('holdings-market-yield', () => null)

  // 公開資料：不帶身分、分頁內只抓一次。跟 GET /holdings 同時發出（它跟持股無關，不用等）。
  async function loadMarketYield() {
    if (marketYield.value) return
    try {
      const response = await apiFetch<{ supplySide?: { dividendYield?: number | null; dividendYieldTradeDate?: string | null } }>('/macro/equity-risk-premium')
      const value = response.supplySide?.dividendYield
      if (typeof value === 'number') marketYield.value = { value, date: response.supplySide?.dividendYieldTradeDate ?? null }
    } catch (error) {
      devWarn('holdings', 'GET /macro/equity-risk-premium unavailable', error)
    }
  }

  // GET /holdings 的列寫進共用的 market；ETF 配息的區間取有附的第一檔。業務中台 的三個來源各自失敗、只把那幾欄留 null，所以收盤價
  // 全部是 null 就當成收盤價讀不到，交給讀取失敗提示重讀
  function applyHoldingMarket(rows: (HoldingMarketFields & { symbol: string })[]) {
    market.value = { ...market.value, ...Object.fromEntries(rows.map(row => [row.symbol, marketOf(row)])) }
    const window = rows.find(row => row.trailing12MonthWindow)?.trailing12MonthWindow
    if (window) etfWindow.value = { from: window.start, to: window.end }
    quotesFailed.value = rows.length > 0 && rows.every(row => row.close == null)
  }

  // 已實現損益頁：出清的代號不在 GET /holdings，收盤價自己補（已經有的不再問）
  async function loadQuotes(symbols: string[]) {
    const missing = symbols.filter(symbol => !market.value[symbol])
    // 沒有要抓的就沒有失敗（失敗的那幾檔被移除時，旗標原本會一直留著）
    if (missing.length === 0) {
      quotesFailed.value = false
      return
    }
    try {
      // 只送價格特殊欄位（stock.latestClose）會 400（業務中台 先把特殊欄位剝掉，剩下零個型錄欄位），所以配一個型錄欄位。
      // stock.latestClose 是最近一筆真的有成交的收盤（同持股列的 close）
      const response = await fetchScreenerValues<ScreenerValue>(missing.slice(0, SCREENER_VALUES_MAX), ['stock.latestClose', 'liveDividendPerShare.EOD'])
      const next = { ...market.value }
      for (const row of response.results) {
        const price = row.values['stock.latestClose']
        next[row.symbol] = { ...marketOf({}), price: price?.value ?? null, priceDate: price?.knowledgeDate ?? null }
      }
      market.value = next
      quotesFailed.value = false
    } catch (error) {
      quotesFailed.value = true
      devWarn('holdings', 'POST /screener/values unavailable', error)
    }
  }

  return { market, quotesFailed, etfWindow, marketYield, applyHoldingMarket, loadQuotes, loadMarketYield }
}
