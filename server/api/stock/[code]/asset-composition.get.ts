import type { FinancialStatementResponse } from '#shared/types/financial-statement'
import type { AssetCompositionPeriod, StockAssetCompositionResponse } from '#shared/types/stock-asset-composition'
// GET /api/stock/:code/asset-composition — 流動與非流動資產的組成金額（2026-10-12，使用者：「是不是用存量表示而不用百分比較好」）。
// 期別照 equity-composition.get.ts：最新一期加上往前 5 個年度的 Q4 快照，同一個 cachedFinancialStatement 快取，所以兩頁共用、
// 跟淨值組成也共用（冷的時候六次，暖的時候零次）。分組與拆不開的條件在 shared/utils/asset-composition.ts。
const YEARS = 5

const toPeriod = (statement: FinancialStatementResponse | null): AssetCompositionPeriod | null => {
  if (!statement?.found || statement.fiscalYear === null || statement.fiscalQuarter === null) return null
  const composition = assetCompositionOf(statement.statement)
  if (!composition) return null
  const { fiscalYear, fiscalQuarter } = statement
  return { fiscalYear, fiscalQuarter, label: `${fiscalYear}${fiscalQuarter === 4 ? '' : ` Q${fiscalQuarter}`}`, ...composition }
}

export default defineEventHandler(async (event): Promise<StockAssetCompositionResponse> => {
  const code = requireListedSymbol(event)
  // 讀不到（settle 回 null）回錯誤讓頁面交給全站讀取失敗提示；found:false 或拆不開（金融業）才是「沒有可拆解的申報」
  const latestStatement = await settle(cachedFinancialStatement(code, 'balanceSheet', null, null))
  if (latestStatement === null) throw createError({ statusCode: 502, statusMessage: 'balance sheet unavailable' })
  const latest = toPeriod(latestStatement)
  if (!latest) return { symbol: code, periods: [] }

  const latestIsAnnual = latest.fiscalQuarter === 4
  const firstAnnualYear = latestIsAnnual ? latest.fiscalYear : latest.fiscalYear - 1
  const annualYears = Array.from({ length: latestIsAnnual ? YEARS - 1 : YEARS }, (_, index) => firstAnnualYear - index)
  const annuals = await Promise.all(annualYears.map(year => settle(cachedFinancialStatement(code, 'balanceSheet', year, 4))))

  const periods = [...annuals.map(toPeriod), latest]
    .filter((period): period is AssetCompositionPeriod => period !== null)
    .sort((a, b) => a.fiscalYear - b.fiscalYear || a.fiscalQuarter - b.fiscalQuarter)
  return { symbol: code, periods }
})
