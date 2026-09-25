// 配息從哪來的分割：每股營收切成五塊，以及每一塊的白話說明與去處。
//
// Extracted from StockDividendSegmentLine.vue 2026-09-25 because the page and the component were
// each deciding「畫不畫得出來」on their own, and they disagreed. The component's `usable` requires
// EVERY part to be positive — including 留在公司 ＝ 稅後淨利 − 每股股利 — while the page's
// limitAnswer only tested EPS, 營業利益率 and 業外. So any company paying more than it earned that
// year rendered NO chart while the page printed「這一檔的每一塊都是正數，所以畫得出來」.
//
// Not an edge case: four of ten symbols sampled were over 100% payout — 2603 長榮 128.87%,
// 1402 遠東新 170.80%, 2201 裕隆 330.23%, 9910 豐泰 103.72%. Paying out of retained earnings in a
// thin year is ordinary here. One function, both callers, one answer.
//
// Auto-imported (app/utils convention, same as lookback-window.ts) — no explicit import needed.

export interface DividendSourcePart {
  label: string
  amount: number
  // What is left AFTER this part is taken out — the level a deduction column floats at, so the
  // staircase down to 每股股利 is the picture itself. The result column always sits at 0.
  after: number
}

export interface DividendSourceLink {
  label: string
  slug: string
}

export interface DividendSourceStep {
  // 白話在前，術語在後 — the plain sentence heads the step, the filed name labels the result.
  title: string
  term: string
  to: number
  explain: string
  // 「讓用戶知道每一個環節的細項拆解去哪裡找」（2026-09-25）— this page is the teaching AND index
  // page, so every step names where that link of the chain is answered on its own. Slugs only; the
  // caller owns the symbol. Every one verified live before being written here.
  links: DividendSourceLink[]
}

export interface DividendSourcePartition {
  revenue: number
  parts: DividendSourcePart[]
  steps: DividendSourceStep[]
  // A part-whole picture cannot draw a negative part, and the market produces them in four
  // different ways: 業外 a net gain（1303 南亞）, an operating loss（1301 台塑）, a negative EPS
  // （6916 華凌）, and a payout above 100%（2603 長榮）. All four end up here.
  usable: boolean
}

export interface DividendSourceInput {
  revenuePerShare: number | null
  grossMargin: number | null
  operatingMargin: number | null
  netProfitMargin: number | null
  eps: number | null
  dividendPerShare: number | null
  // Filed figures for the 毛利→營業利益 block. Optional: analysis-ts is still backfilling, and a
  // symbol it has not reached keeps the plain label and the plain explanation.
  operatingExpense?: number | null
  otherOperatingIncome?: number | null
  researchExpense?: number | null
}

// This block is 毛利 − 營業利益, which the partition requires — but that is NOT the filed 營業費用
// whenever 其他營業收益費損淨額 exists, because 營業利益 ＝ 毛利 − 營業費用 ＋ 其他營業收益費損淨額.
// 2330 2026Q2: filed 營業費用 14.23, 其他營業收益 0.31, block 13.92. It shipped for a few hours as
//「營業費用 13.92」, a label naming the wrong line item; the ~5% coverage of the 其他 line is why
// 2317/1101/1216 all reconciled to the cent and hid it.
function opexLabelOf(input: DividendSourceInput): string {
  return (input.otherOperatingIncome ?? 0) !== 0 ? '營業費用淨額' : '營業費用'
}

// 「研發呢」— R&D is not a step of its own; it lives inside this block and for some companies it
// dominates it（2330: 10.39 of 13.92）. Naming the figure answers the question without adding a
// sixth division and the cognitive load that comes with it. Withheld when it exceeds the block it
// sits inside, which a large enough 其他營業收益 can cause — a part may not read as bigger than its
// whole.
function opexExplainOf(input: DividendSourceInput, block: number): string {
  const base = '業務、廣告、管理部門、研發都在這一塊。切完剩下的，才是公司靠本業賺到的錢。'
  const rd = input.researchExpense
  if (rd === null || rd === undefined || rd > block) return base
  const filed = input.operatingExpense
  return (input.otherOperatingIncome ?? 0) !== 0 && filed !== null && filed !== undefined
    ? `${base}其中研發 ${rd.toFixed(2)} 元；這一塊是營業費用 ${filed.toFixed(2)} 元扣掉其他營業收支之後的淨額。`
    : `${base}其中研發 ${rd.toFixed(2)} 元。`
}

export function dividendSourcePartition(input: DividendSourceInput): DividendSourcePartition | null {
  const revenue = input.revenuePerShare
  const eps = input.eps
  const dividend = input.dividendPerShare
  if (revenue === null || eps === null || dividend === null) return null
  if (input.grossMargin === null || input.operatingMargin === null || input.netProfitMargin === null) return null

  const grossProfit = (revenue * input.grossMargin) / 100
  const operatingIncome = (revenue * input.operatingMargin) / 100
  const netIncome = (revenue * input.netProfitMargin) / 100
  const opexLabel = opexLabelOf(input)

  // The deductions telescope, so these five always sum to 每股營收 whatever the margins are:
  //   (營收−毛利)＋(毛利−營業利益)＋(營業利益−EPS)＋(EPS−股利)＋股利 ＝ 營收
  const parts: DividendSourcePart[] = [
    { label: '營業成本', amount: revenue - grossProfit, after: grossProfit },
    { label: opexLabel, amount: grossProfit - operatingIncome, after: operatingIncome },
    { label: '本業以外與稅', amount: operatingIncome - netIncome, after: netIncome },
    { label: '留在公司', amount: netIncome - dividend, after: dividend },
    // Never rendered as a cut（the last step's remainder IS this amount）, but `usable` reads it.
    { label: '發給你', amount: dividend, after: 0 }
  ]

  const steps: DividendSourceStep[] = [
    {
      title: '公司一整年賣了多少',
      term: '每股營收',
      to: revenue,
      explain: '這是起點：公司一整年收到的貨款，除以流通在外的股數。接下來每一步，都從這裡分出一塊。',
      links: [{ label: '月營收', slug: 'monthly-revenue' }]
    },
    {
      title: '先切掉做出產品本身的成本',
      term: '毛利',
      to: grossProfit,
      explain: '原料、代工、生產線的花費。這一刀切得多不多，決定這門生意本身有沒有賺頭。',
      links: [{ label: '毛利率', slug: 'gross-margin' }]
    },
    {
      title: '再切掉賣東西和管理公司的開銷',
      term: '營業利益',
      to: operatingIncome,
      explain: opexExplainOf(input, grossProfit - operatingIncome),
      links: [
        { label: '營業利益率', slug: 'operating-margin' },
        { label: '研發費用率', slug: 'rd-intensity' }
      ]
    },
    {
      title: '再切掉本業以外的收支和要繳的稅',
      term: 'EPS（每股稅後淨利）',
      to: netIncome,
      explain: '利息、匯兌、賣資產、轉投資，加上所得稅。這一刀之後剩下的，就是新聞上講的 EPS。',
      links: [
        { label: '稅後淨利率', slug: 'net-profit-margin' },
        { label: 'EPS', slug: 'eps' }
      ]
    },
    {
      title: '最後一刀：公司決定發多少給你',
      term: '每股股利',
      to: dividend,
      // 「投資支出在哪一步驟？」— it is in NO step, and saying so is the point. Capex never touches
      // the income statement this walks; buying a machine is not an expense in the year it is
      // bought. What DOES appear is its shadow, 折舊攤銷, spread across later years inside 營業成本
      // and 營業費用. The money that funds it is this step's 留在公司.
      explain: '賺到的錢不會全部發出來——一部分依公司法必須提存，一部分留著買設備、蓋廠房，也就是資本支出。最後剩下的那一塊，才是配到你手上的現金。',
      links: [
        { label: '盈餘發放率', slug: 'dividend-payout-ratio' },
        { label: '現金殖利率', slug: 'dividend' }
      ]
    }
  ]

  return { revenue, parts, steps, usable: revenue > 0 && parts.every(part => part.amount > 0) }
}
