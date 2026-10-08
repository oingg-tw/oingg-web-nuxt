import type { HoldingMarket } from '~/composables/holdings/holdings-model'

// 持股的市場資料（2026-10-08 從 useHoldings 拆出）：報價與每股股利（POST /screener/values）、ETF 近 12 個月配息、特別股發行條件
// 股利、大盤殖利率。useState，持股各頁共用一份。
interface ScreenerValue { value: string | null; knowledgeDate: string | null }
interface PreferredStockRow { symbol: string; dividendRate: number | null }
// GET /market/etf-distributions?symbol=（analysis-ts cb2aa41e、bff-ts 61a75a8）。非 ETF 回 200、found false。
// trailing12 在 found false 時是 null；有紀錄但近一年沒配是 0——兩者意思不同。
interface EtfDistributions {
  found: boolean
  trailing12MonthDistributionPerUnit: number | null
  trailing12MonthWindow: { start: string; end: string } | null
}

// ponytail: /screener/values 一次最多 200 檔；超過的不會有報價，頁面會照實算進「沒有報價」。
// 真的有人持有 200 檔以上再分批。
const SCREENER_VALUES_MAX = 200

export function useHoldingsMarket() {
  // ponytail: 報價在這個分頁裡快取到整頁重新整理為止（已經有報價的代號不再問）。一天才變一次，
  // 有人反映「價格沒更新」再加 TTL。
  const market = useState<Record<string, HoldingMarket>>('holdings-market', () => ({}))
  const quotesFailed = useState('holdings-quotes-failed', () => false)
  const etfWindow = useState<{ from: string; to: string } | null>('holdings-etf-window', () => null)
  // 每股股利的三個來源，彼此不重疊（批次的 liveDividendPerShare.EOD 對 ETF 與特別股是 null），所以合併時
  // 不需要知道一檔是什麼型別。
  // 大盤殖利率（GET /macro/equity-risk-premium 的 supplySide.dividendYield）：交易所公布的個股殖利率、依市值加權、
  // 只含上市公司。一天才變一次，分頁內抓一次。
  const marketYield = useState<{ value: number; date: string | null } | null>('holdings-market-yield', () => null)

  // 特別股清單是全市場公開資料、很少變：分頁內抓一次，三頁共用
  const preferredDividend = useState<Record<string, number> | null>('holdings-preferred-dividend', () => null)


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

  async function loadReferenceData() {
    if (preferredDividend.value) return
    const [preferred] = await Promise.allSettled([
      apiFetch<{ entries: PreferredStockRow[] }>('/stocks/preferred-stocks')
    ])
    if (preferred.status === 'fulfilled') {
      // 讀 bff 的**原始** dividendRate（每股元、發行條件所訂）。usePreferredStockList.ts 把 UI 的
      // dividendRate 對應成 nominalDividendRatePct（百分比）——拿那個來乘股數會錯 10 倍以上。
      preferredDividend.value = Object.fromEntries(
        preferred.value.entries.filter(row => row.dividendRate !== null).map(row => [row.symbol, row.dividendRate!])
      )
    } else {
      devWarn('holdings', 'GET /stocks/preferred-stocks unavailable', preferred.reason)
    }
  }

  // ETF 的每單位配息。台股 ETF 的代號都以 00 開頭，所以用代號就知道要問哪幾檔，跟報價同時發出；不必等報價
  // 回來看普通股股利是不是 null（那樣會連「沒配息的普通股」一起問，也多串一段等待）。
  // 非 ETF 會回 found false。
  async function fetchEtfDividends(symbols: string[]): Promise<Map<string, EtfDistributions>> {
    const results = await Promise.allSettled(symbols.map(symbol =>
      apiFetch<EtfDistributions>('/market/etf-distributions', { query: { symbol } })
        .then(response => [symbol, response] as const)))
    const found = new Map<string, EtfDistributions>()
    for (const result of results) {
      if (result.status === 'rejected') devWarn('holdings', 'GET /market/etf-distributions unavailable', result.reason)
      else if (result.value[1].found) found.set(result.value[0], result.value[1])
    }
    return found
  }

  async function loadQuotes(symbols: string[]) {
    const missing = symbols.filter(symbol => !market.value[symbol])
    if (missing.length === 0) return
    try {
      const [response, etf] = await Promise.all([
        // 只送價格特殊欄位（stock.latestClose）會 400（bff-ts 先把特殊欄位剝掉，剩下零個型錄欄位），所以一定要配一個
        // 型錄欄位——而 liveDividendPerShare.EOD 剛好就是普通股的每股股利。
        //
        // 用 liveDividendPerShare.EOD（analysis-ts 78fe0f9a）而不是 dividendPerShare.TTM：後者的窗口是「最新財報季末往前
        // 一年」，一年配一次、今年除息比去年晚一點的公司兩次除息都落在窗口外，變成 0（2026-10-05 實測 2364、3231，
        // 總覽因此默默少算）。新欄位是「最新交易日往前 12 個月內已除息」的現金股利、已換算配股後股數，所以
        // 「目前股數 × 值」就是預估股利。實測 3231 5.5、2364 1.82、2330 24（舊欄位 0、0、22）。
        // dividendYield.EOD：跟大盤殖利率同一個來源（交易所公布），才能放在一起比
        fetchScreenerValues<ScreenerValue>(missing.slice(0, SCREENER_VALUES_MAX), ['stock.latestClose', 'liveDividendPerShare.EOD', 'dividendYield.EOD']),
        fetchEtfDividends(missing.filter(symbol => symbol.startsWith('00')))
      ])
      const next = { ...market.value }
      for (const row of response.results) {
        // stock.latestClose：最近一筆真的有成交的收盤價，knowledgeDate 是那筆的日期（analysis-ts e6fea8c3，bff-ts
        // 2026-10-07 接上）。不用 stock.price——它只是「最新交易日那一天」的收盤，那天沒成交就是 null（8416 實威
        // 10-06 只成交 1 股零股），而持股只需要最近一筆價格（使用者：「我並不需要他每天都有成交價，有最新價格就可以了」）。
        // 日期比最新交易日舊的那幾檔，頁面的「計算方式」會照實寫出。
        const price = row.values['stock.latestClose']
        // 三個來源彼此不重疊：ETF 近 12 個月配息、特別股發行條件股利、普通股近 12 個月已除息現金股利
        const etfDividend = etf.get(row.symbol)?.trailing12MonthDistributionPerUnit ?? null
        const yieldValue = row.values['dividendYield.EOD']
        next[row.symbol] = {
          price: price?.value ?? null,
          priceDate: price?.knowledgeDate ?? null,
          dividendPerShare: etfDividend ?? preferredDividend.value?.[row.symbol] ?? row.values['liveDividendPerShare.EOD']?.value ?? null,
          dividendYield: yieldValue?.value === null || yieldValue?.value === undefined ? null : Number(yieldValue.value),
          yieldDate: yieldValue?.knowledgeDate ?? null
        }
      }
      const window = [...etf.values()].find(item => item.trailing12MonthWindow)?.trailing12MonthWindow
      if (window) etfWindow.value = { from: window.start, to: window.end }
      market.value = next
      quotesFailed.value = false
    } catch (error) {
      quotesFailed.value = true
      devWarn('holdings', 'POST /screener/values unavailable', error)
    }
  }

  return { market, quotesFailed, etfWindow, marketYield, loadQuotes, loadReferenceData, loadMarketYield }
}
