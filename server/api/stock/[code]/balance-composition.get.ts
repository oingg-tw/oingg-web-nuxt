import type { FinancialStatementResponse } from '#shared/types/financial-statement'
import type { BalanceCompositionPeriod, StockBalanceCompositionResponse } from '#shared/types/stock-balance-composition'
// GET /api/stock/:code/balance-composition — 資產、負債、淨值的組成金額，逐季（2026-10-12）。
//
// 取代 asset-composition 與 equity-composition 兩支：它們各自只抓「最新一期＋5 個年度 Q4」，圖上年與季混在一起（使用者：「我看到的似乎
// 年跟季混一起」），也沒有圖表右上角的期別與近N年（「這些圖表右上角的選項呢？不能選單季 四季 近五年這種嗎」）。現在回逐季，
// 圖表元件自己切年度（只留 Q4）或單季、再切近N年。資產負債表是存量快照，所以沒有「近四季」這種流量口徑。
//
// 深度：近N年的上限是 8 年（LOOKBACK_YEARS），抓 32 季。上游的資產負債表回得到 2021 Q1 附近，更早的回 found:false、直接略過。
// 全部走 cachedFinancialStatement，跟財報頁、淨值頁共用同一份快取；冷的時候 32 次（業務中台那層有限並行），暖的時候零次。
const QUARTERS = 32

const toPeriod = (statement: FinancialStatementResponse | null): BalanceCompositionPeriod | null => {
  if (!statement?.found || statement.fiscalYear === null || statement.fiscalQuarter === null) return null
  const rows = statement.statement
  const totalAssets = Number(rows?.assets ?? 0)
  if (!rows || !(totalAssets > 0)) return null
  return {
    fiscalYear: statement.fiscalYear,
    fiscalQuarter: statement.fiscalQuarter,
    totalAssets,
    assets: assetCompositionOf(rows),
    debt: debtCompositionOf(rows),
    equity: equityCompositionOf(rows),
    intangibleAssets: rows.intangible_assets_and_goodwill == null ? null : Number(rows.intangible_assets_and_goodwill)
  }
}

export default defineEventHandler(async (event): Promise<StockBalanceCompositionResponse> => {
  const code = requireListedSymbol(event)
  // 讀不到（settle 回 null）回錯誤讓頁面交給全站讀取失敗提示；found:false 才是「沒有申報」
  const latestStatement = await settle(cachedFinancialStatement(code, 'balanceSheet', null, null))
  if (latestStatement === null) throw createError({ statusCode: 502, statusMessage: 'balance sheet unavailable' })
  const latest = toPeriod(latestStatement)
  if (!latest) return { symbol: code, periods: [] }

  const statements = await cachedEarlierStatements(code, 'balanceSheet', latest.fiscalYear, latest.fiscalQuarter, QUARTERS - 1)
  const periods = [latest, ...statements.map(toPeriod)]
    .filter((period): period is BalanceCompositionPeriod => period !== null)
    .sort((a, b) => a.fiscalYear - b.fiscalYear || a.fiscalQuarter - b.fiscalQuarter)
  return { symbol: code, periods }
})
