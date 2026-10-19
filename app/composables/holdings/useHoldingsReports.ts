import type { HoldingDividendsResult, PerformanceOutcome, PerformanceResult, RealizedResult, RiskOutcome, RiskReport } from '~/composables/holdings/holdings-model'

// 持股的期間報表（2026-10-08 從 useHoldings 拆出）：期間報酬率、風險指標、已實現損益，依「端點＋期間」快取在分頁裡；帳本寫入後
// useHoldings 的 load() 會 clearPeriodCache()——帳本變了，舊的損益與報酬就不對了。
export function useHoldingsReports() {
  const request = useAuthedFetch()
  // 期間型的結果（交易績效、風險）依「端點＋期間」快取在分頁裡：回到同一個期間不再發請求（使用者 2026-10-05
  // 反映兩支都超過一秒，主因在 業務中台 那邊，這裡先把重複的請求省掉）。任何寫入之後 load() 會清掉它——
  // 帳本變了，舊的損益與報酬就不對了。
  const periodCache = useState<Record<string, unknown>>('holdings-period-cache', () => ({}))
  // 帳戶（2026-10-19）：每支報表都帶 scopeQuery（全部帳戶就不帶），快取 key 也加上帳戶，切帳戶不會拿到別的帳戶的結果
  const { scopeQuery, selected } = useHoldingsPortfolios()
  const scoped = (key: string) => `${selected.value?.id ?? 'all'}|${key}`

  async function cachedPeriod<T extends { ok?: boolean } | object | null>(key: string, fetcher: () => Promise<T>, keep: (value: T) => boolean): Promise<T> {
    const scopedKey = scoped(key)
    if (scopedKey in periodCache.value) return periodCache.value[scopedKey] as T
    const value = await fetcher()
    if (keep(value)) periodCache.value = { ...periodCache.value, [scopedKey]: value }
    return value
  }

  function clearPeriodCache() {
    periodCache.value = {}
  }

  // ---- 期間報酬率（GET /holdings/performance，業務中台 0a8dcd9） ----
  //
  // 時間加權報酬、不含息。每日報酬是「流入算開盤前、流出算收盤後」：分母包含當天投入的錢，所以大筆加碼
  // 的隔天不會算出 −2041% 這種爆掉的單日報酬（業務中台 對原規格的更正）。series 的日期就是加權指數的交易日，
  // 跟 /market/taiex-daily-price 逐日對得上。超過約 8 年（個股日線深度）回 400，訊息寫出最早可選的日期。
  async function fetchPerformance(from: string, to: string): Promise<PerformanceOutcome> {
    return cachedPeriod(`performance|${from}|${to}`, () => requestPerformance(from, to), outcome => outcome.ok)
  }

  async function requestPerformance(from: string, to: string): Promise<PerformanceOutcome> {
    try {
      return { ok: true, result: await request<PerformanceResult>('/holdings/performance', { query: { from, to, ...scopeQuery.value } }) }
    } catch (error) {
      devWarn('holdings', 'GET /holdings/performance unavailable', error)
      const earliest = earliestPriceDateOf(error)
      return earliest ? { ok: false, message: `個股的歷史價格最早到 ${earliest}，請把開始日期設在那天之後` } : { ok: false, message: '期間報酬率暫時無法載入', error }
    }
  }

  // ---- 風險指標（GET /holdings/risk，業務中台 23b7b09） ----
  //
  // 用「現在每一檔的市值比例」套用過去的股價回推（使用者在 業務中台 那邊選的做法）。刻意沒有報酬與夏普比率：
  // 持股是事後選的，回推的報酬會偏高。數值都是 6 位小數字串；資料不足時是 null。
  async function fetchRisk(from: string, to: string): Promise<RiskOutcome> {
    return cachedPeriod(`risk|${from}|${to}`, () => requestRisk(from, to), outcome => outcome.ok)
  }

  async function requestRisk(from: string, to: string): Promise<RiskOutcome> {
    try {
      return { ok: true, result: await request<RiskReport>('/holdings/risk', { query: { from, to, ...scopeQuery.value } }) }
    } catch (error) {
      devWarn('holdings', 'GET /holdings/risk unavailable', error)
      const earliest = earliestPriceDateOf(error)
      return earliest ? { ok: false, message: `個股的歷史價格最早到 ${earliest}，請把開始日期設在那天之後` } : { ok: false, message: '風險指標暫時無法載入', error }
    }
  }

  // ---- 已實現損益（GET /holdings/realized，業務中台 e516d1e） ----
  //
  // 區間只篩選**賣出日**；成本以整段帳本先進先出配對，所以區間開始前的買進照樣帶入成本。已出清的
  // 代號也會列出（GET /holdings 只有股數大於 0 的）。股利不計入。null ＝ 讀不到。
  async function fetchRealized(from: string | null, to: string | null): Promise<RealizedResult | null> {
    return cachedPeriod(`realized|${from}|${to}`, () => requestRealized(from, to), result => result !== null)
  }

  async function requestRealized(from: string | null, to: string | null): Promise<RealizedResult | null> {
    try {
      return await request<RealizedResult>('/holdings/realized', { query: { ...(from ? { from } : {}), ...(to ? { to } : {}), ...scopeQuery.value } })
    } catch (error) {
      devWarn('holdings', 'GET /holdings/realized unavailable', error)
      return null
    }
  }

  // ---- 配息日程（GET /holdings/dividends，業務中台 97bd1e2） ----
  // 用上游的預設期間（往前 12 個月、往後 3 個月）。帳本寫入後跟其他報表一起清快取：股數是從交易紀錄回推的。null ＝ 讀不到。
  async function fetchDividends(): Promise<HoldingDividendsResult | null> {
    return cachedPeriod('dividends', async () => {
      try {
        return await request<HoldingDividendsResult>('/holdings/dividends', { query: scopeQuery.value })
      } catch (error) {
        devWarn('holdings', 'GET /holdings/dividends unavailable', error)
        return null
      }
    }, result => result !== null)
  }

  return { fetchPerformance, fetchRisk, fetchRealized, fetchDividends, clearPeriodCache }
}

// 持股各頁共用的期間（2026-10-07 交易績效拆成「報酬與大盤／已實現損益／績效統計」三頁之後）：切頁時期間不重設。
// 報酬與大盤、績效統計、已實現損益（交易成本）讀同一支 /holdings/performance，cachedPeriod 以 from|to 快取，
// 所以同一段期間切頁不會重抓。預設近一年（使用者 2026-10-05 指定）。
export function useHoldingsRange() {
  return useState<[string, string]>('holdings-range', () => holdingsLastYear())
}
