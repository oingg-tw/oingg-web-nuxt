import type { Stock } from '~/composables/useStocks'

const QUARTER_COUNT = 12
const RAW_QUARTER_COUNT = QUARTER_COUNT + 3 // extra history so trailing-4-quarter sums cover all 12 shown quarters
const MONTH_COUNT = 12
const RAW_MONTH_COUNT = MONTH_COUNT + 12 // extra year of history so each shown month has a same-month-last-year to compare against

export interface ValuationBand {
  multiple: number
  label: string
  values: number[]
}

export interface MonthlyRevenue {
  month: string
  revenue: number
  yoy: number
}

export interface StockDetail {
  quarters: string[]
  price: number[]
  perBands: ValuationBand[]
  pbrBands: ValuationBand[]
  quarterlyEps: { quarter: string; eps: number }[]
  monthlyRevenue: MonthlyRevenue[]
}

function quarterLabels(count: number, endingToday: Date) {
  // Quarter numbers are 1-indexed, but floor(month/3) already equals "current quarter - 1",
  // i.e. the last fully reported quarter (0 wraps to Q4 of the prior year below).
  let year = endingToday.getFullYear()
  let quarter = Math.floor(endingToday.getMonth() / 3)

  const labels: string[] = []
  for (let i = 0; i < count; i++) {
    if (quarter < 1) {
      quarter = 4
      year -= 1
    }
    labels.unshift(`${String(year).slice(2)}Q${quarter}`)
    quarter -= 1
  }
  return labels
}

function monthLabels(count: number, endingToday: Date) {
  // getMonth() is 0-indexed, which already equals "current 1-indexed month - 1", i.e. the
  // last fully reported month (0 wraps to December of the prior year below).
  let year = endingToday.getFullYear()
  let month = endingToday.getMonth()

  const labels: string[] = []
  for (let i = 0; i < count; i++) {
    if (month < 1) {
      month = 12
      year -= 1
    }
    labels.unshift(`${String(year).slice(2)}/${String(month).padStart(2, '0')}`)
    month -= 1
  }
  return labels
}

function buildBands(multiples: number[], base: number[]): ValuationBand[] {
  return multiples.map(multiple => ({
    multiple,
    label: `${multiple.toFixed(1)}x`,
    values: base.map(value => Math.round(value * multiple * 100) / 100)
  }))
}

export function generateStockDetail(stock: Stock): StockDetail {
  const random = mulberry32(hashCode(stock.code))
  const quarters = quarterLabels(QUARTER_COUNT, new Date())

  // Quarterly EPS: seeded random walk around the stock's approximate annualised EPS.
  const annualEpsApprox = stock.price / stock.per
  const quarterlyBase = annualEpsApprox / 4
  const rawEps: number[] = []
  for (let i = 0; i < RAW_QUARTER_COUNT; i++) {
    let value = quarterlyBase * (0.75 + random() * 0.5) * (1 + i * 0.006)
    if (random() < 0.08) value = -Math.abs(value) * 0.3
    rawEps.push(value)
  }

  const ttmEps: number[] = []
  for (let i = 3; i < RAW_QUARTER_COUNT; i++) {
    const sum = rawEps[i]! + rawEps[i - 1]! + rawEps[i - 2]! + rawEps[i - 3]!
    ttmEps.push(sum)
  }
  ttmEps[ttmEps.length - 1] = stock.price / stock.per

  // Valuation bands and the price walk both need a strictly positive EPS: a negative
  // quarter would otherwise flip the multiples' ordering (or send price negative).
  const safeTtmEps = ttmEps.map(value => (value > 0 ? value : quarterlyBase * 4))

  // Book value per share: smoother trend, anchored to the current price/PBR.
  const bvpsBase = stock.price / stock.pbr
  const bvps: number[] = []
  for (let i = 0; i < QUARTER_COUNT; i++) {
    const drift = 1 + (QUARTER_COUNT - 1 - i) * -0.004
    bvps.push(Math.round(bvpsBase * drift * (0.97 + random() * 0.06) * 100) / 100)
  }
  bvps[bvps.length - 1] = bvpsBase

  // Actual price walk, weaving through the valuation bands, anchored to the live price.
  const price: number[] = []
  for (let i = 0; i < QUARTER_COUNT; i++) {
    price.push(Math.round(safeTtmEps[i]! * stock.per * (0.8 + random() * 0.4) * 100) / 100)
  }
  price[price.length - 1] = stock.price

  const bandMultiples = [0.7, 0.85, 1, 1.15, 1.3]
  const perBands = buildBands(
    bandMultiples.map(m => Math.round(stock.per * m * 10) / 10),
    safeTtmEps
  )
  const pbrBands = buildBands(
    bandMultiples.map(m => Math.round(stock.pbr * m * 10) / 10),
    bvps
  )

  const quarterlyEps = quarters.slice(-8).map((quarter, index, arr) => ({
    quarter,
    eps: Math.round(rawEps[rawEps.length - (arr.length - index)]! * 100) / 100
  }))

  // Monthly revenue (億元), with mild seasonality, anchored loosely to market cap since
  // there's no real revenue figure in the mock Stock data to build from.
  const months = monthLabels(MONTH_COUNT, new Date())
  const revenueBase = stock.marketCapB * 0.03
  const rawRevenue: number[] = []
  for (let i = 0; i < RAW_MONTH_COUNT; i++) {
    const seasonal = 1 + 0.08 * Math.sin(((i % 12) / 12) * Math.PI * 2)
    const value = revenueBase * seasonal * (0.85 + random() * 0.3) * (1 + i * 0.003)
    rawRevenue.push(Math.max(value, revenueBase * 0.4))
  }
  const monthlyRevenue: MonthlyRevenue[] = months.map((month, index) => {
    const rawIndex = rawRevenue.length - (months.length - index)
    const revenue = rawRevenue[rawIndex]!
    const priorYearRevenue = rawRevenue[rawIndex - 12]!
    return {
      month,
      revenue: Math.round(revenue * 10) / 10,
      yoy: Math.round(((revenue - priorYearRevenue) / priorYearRevenue) * 1000) / 10
    }
  })

  return { quarters, price, perBands, pbrBands, quarterlyEps, monthlyRevenue }
}
