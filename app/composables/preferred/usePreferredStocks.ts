import type { PreferredStock } from '~/components/preferred/PreferredStockCard.vue'

// Extracted from preferred-stocks.vue so /preferred-stocks/[code].vue can look up the same
// fixture entries by code — still no backend endpoint (see PreferredStockCard.vue's own type
// comment), so this stays hand-picked real TW-listed issues, not live quotes. A plain exported
// array (not just a composable), same pattern as useBlogPosts.ts's own BLOG_POSTS, so either a
// Vue component or a non-Vue context (if ever needed) can read it directly.
export const PREFERRED_STOCKS: PreferredStock[] = [
  {
    code: '2002A',
    name: '中鋼特',
    price: 63.9,
    change: 0.15,
    changePercent: 0.24,
    dividendRate: 5.5,
    ytw: 4.31,
    dividendType: 'non-cumulative',
    participation: 'non-participating',
    liquidationPreference: 1,
    liquidationPriority: '次順位債券之後、普通股之前',
    putable: false,
    callDate: null,
    callPrice: null,
    interestCoverage: 8.5,
    debtRatio: 45.0,
    currentRatio: 130.0,
    netDebtToEbitda: 2.1
  },
  {
    code: '1101B',
    name: '台泥乙特',
    price: 62.1,
    change: -0.3,
    changePercent: -0.48,
    dividendRate: 4.6,
    ytw: 3.12,
    dividendType: 'cumulative',
    participation: 'non-participating',
    liquidationPreference: 1,
    liquidationPriority: '次順位債券之後、普通股之前',
    putable: false,
    callDate: '2027-06-20',
    callPrice: 60,
    interestCoverage: 5.2,
    debtRatio: 52.0,
    currentRatio: 105.0,
    netDebtToEbitda: 3.4
  },
  {
    code: '2891B',
    name: '中信金乙特',
    price: 54.8,
    change: 0,
    changePercent: 0,
    dividendRate: 3.55,
    ytw: 2.78,
    dividendType: 'non-cumulative',
    participation: 'non-participating',
    liquidationPreference: 1,
    liquidationPriority: '次順位債券之後、普通股之前',
    putable: false,
    callDate: '2028-12-15',
    callPrice: 50,
    interestCoverage: 15.0,
    debtRatio: 88.0,
    currentRatio: 110.0,
    netDebtToEbitda: -1.5
  }
]

export function usePreferredStocks() {
  return { stocks: PREFERRED_STOCKS }
}

export function getPreferredStockByCode(code: string): PreferredStock | undefined {
  return PREFERRED_STOCKS.find(stock => stock.code === code)
}
