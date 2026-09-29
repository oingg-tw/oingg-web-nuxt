import type { EquityRiskPremiumPageData } from '#shared/types/hub'

// GET /api/hub/macro-equity-risk-premium — the 股票風險溢酬 page's one data call (four upstream
// windows behind one cached function; see getEquityRiskPremium).
export default defineEventHandler(async (): Promise<EquityRiskPremiumPageData> => getEquityRiskPremium())
