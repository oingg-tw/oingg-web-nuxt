import type { FinancialStatementResponse } from '#shared/types/financial-statement'
import type { BalanceCompositionPeriod, StockBalanceCompositionResponse } from '#shared/types/stock-balance-composition'
import type { MetricsHistoryEntry } from '#shared/types/metrics-history'
// GET /api/stock/:code/balance-composition — 資產、負債、淨值的組成金額，逐季（2026-10-12）。
//
// 取代 asset-composition 與 equity-composition 兩支：它們各自只抓「最新一期＋5 個年度 Q4」，圖上年與季混在一起（使用者：「我看到的似乎
// 年跟季混一起」），也沒有圖表右上角的期別與近N年（「這些圖表右上角的選項呢？不能選單季 四季 近五年這種嗎」）。現在回逐季，
// 圖表元件自己切年度（只留 Q4）或單季、再切近N年。資產負債表是存量快照，所以沒有「近四季」這種流量口徑。
//
// 深度：近N年的上限是 8 年（LOOKBACK_YEARS），抓 32 季。上游的資產負債表回得到 2021 Q1 附近，更早的回 found:false、直接略過。
// 2026-11-20 起一次讀 32 季（cachedStatementHistory）；原本一季一次，冷的時候 32 次。
const QUARTERS = 32
// 銀行與金控（2026-11-21）：流動／非流動拆不開時，再讀數據中台的資產 9 支、負債 10 支（metrics-history 一次最多 10 支），掛在每一期的 bank
const BANK_ASSET_CODES = [BANK_ASSETS_TOTAL_CODE, ...Object.keys(BANK_ASSET_PART_LABELS)]
const BANK_LIABILITY_CODES = [BANK_LIABILITIES_TOTAL_CODE, ...Object.keys(BANK_LIABILITY_PART_LABELS)]

const toPeriod = (statement: FinancialStatementResponse | null): BalanceCompositionPeriod | null => {
  if (!statement?.found || statement.fiscalYear === null || statement.fiscalQuarter === null) return null
  const rows = statement.statement
  const totalAssets = rows?.assets ?? 0
  if (!rows || !(totalAssets > 0)) return null
  return {
    fiscalYear: statement.fiscalYear,
    fiscalQuarter: statement.fiscalQuarter,
    totalAssets,
    assets: assetCompositionOf(rows),
    debt: debtCompositionOf(rows),
    equity: equityCompositionOf(rows),
    intangibleAssets: rows.intangible_assets_and_goodwill ?? null
  }
}

export default defineEventHandler(async (event): Promise<StockBalanceCompositionResponse> => {
  const code = requireListedSymbol(event)
  // 讀不到（settle 回 null）回錯誤讓頁面交給全站讀取失敗提示；空陣列或全是 found:false 才是「沒有申報」。上游已經由舊到新
  const history = await settle(cachedStatementHistory(code, 'balanceSheet', QUARTERS))
  if (history === null) throw createError({ statusCode: 502, statusMessage: 'balance sheet unavailable' })
  const periods = history.entries.map(toPeriod).filter((period): period is BalanceCompositionPeriod => period !== null)
  // 拆得開（一般公司）就不用讀；銀行、保險、證券、金控的最新一期 assets 是 null，其中只有銀行與金控讀得到這兩組（其他回空的）
  if (!periods.length || periods.at(-1)!.assets) return { symbol: code, periods }
  const [assets, liabilities] = await Promise.all([
    settle(cachedMetricsHistory(code, 'Q', BANK_ASSET_CODES, QUARTERS)),
    settle(cachedMetricsHistory(code, 'Q', BANK_LIABILITY_CODES, QUARTERS))
  ])
  const byPeriod = (entries: MetricsHistoryEntry[] | undefined) => new Map((entries ?? []).map(entry => [`${entry.fiscalYear}-${entry.fiscalQuarter}`, entry.values]))
  const assetValues = byPeriod(assets?.entries)
  const liabilityValues = byPeriod(liabilities?.entries)
  if (!assetValues.size && !liabilityValues.size) return { symbol: code, periods }
  return {
    symbol: code,
    periods: periods.map((period) => {
      const key = `${period.fiscalYear}-${period.fiscalQuarter}`
      const assetsOf = assetValues.get(key)
      const liabilitiesOf = liabilityValues.get(key)
      return {
        ...period,
        bank: {
          assets: assetsOf ? bankCompositionOf(assetsOf, BANK_ASSETS_TOTAL_CODE, BANK_ASSET_PART_LABELS) : null,
          liabilities: liabilitiesOf ? bankCompositionOf(liabilitiesOf, BANK_LIABILITIES_TOTAL_CODE, BANK_LIABILITY_PART_LABELS) : null
        }
      }
    })
  }
})
