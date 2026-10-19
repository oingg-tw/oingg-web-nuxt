// 持股特色（2026-10-19，使用者：「PER 多少、BETA 多少、ROE 多少…有些是低 Beta、有些是景氣循環專精，分享的時候可以一起帶出去，
// 造訪的人就可以看出這一組持股的特色」）。數字都由 業務中台 算（GET /holdings/traits，業務中台 bd8a4e9；分享頁的公開資料是同一份）：
// 組合依市值占比加權（本益比、股價淨值比用調和平均），Beta 是近一年回推、跟風險頁同一支；大盤是全市場普通股依市值、同一套算法
// （analysis-ts 算，上線前 market 是 null）。規模（大中小型占比）與前三大占比是借基金業的 Morningstar 規模分法與月報的前幾大占比
// （業務中台 a5cae2b）。這裡只管兩件事：每一列怎麼寫、標籤怎麼貼——持股分析頁與分享頁共用（HoldingsTraits）。
//
// 標籤：使用者知道這是替持股分類、法規上屬灰色地帶，仍選了要貼（2026-10-19）。所以只用事實性的高／低與固定門檻，每一組持股同一套
// 規則，門檻寫在「計算方式」；不用便宜、穩健、優質這類評價字眼，也不說適合誰。涵蓋不到一半市值的不貼（ETF、特別股沒有財報）。
//
// 不 import 任何東西：scripts/check-holdings-traits.mjs 直接用 node 跑它。

export type TraitKey = 'peRatio' | 'pbRatio' | 'dividendYield' | 'roe' | 'revenueGrowth' | 'beta' | 'revenueYoyVolatility'
  | 'largeCapPct' | 'midCapPct' | 'smallCapPct' | 'top3HoldingsPct'
// 數字字串（beta 6 位、其餘 2 位小數）；dividendYield、roe、revenueGrowth、revenueYoyVolatility 與 *Pct 的單位是 %（"30.80" ＝ 30.8%）。
// coverage ＝ 參與計算的持股占的權重（0～1）。全是 ETF 時 top3HoldingsPct 是真的 "0"，不是沒有資料
export interface TraitValue { value: string | null; coverage: string | null }
export type Traits = Record<TraitKey, TraitValue>
export interface HoldingsTraitsResult { asOf: string | null; portfolio: Traits; market: Traits | null }

export const TRAIT_ROWS: { key: TraitKey; name: string; unit: 'ratio' | 'pct'; meaning: string }[] = [
  { key: 'peRatio', name: '本益比（整體）', unit: 'ratio', meaning: '各檔本益比依市值的調和平均，等於把整組持股當成一家公司；虧損公司不算入' },
  { key: 'pbRatio', name: '股價淨值比（整體）', unit: 'ratio', meaning: '各檔股價淨值比依市值的調和平均' },
  { key: 'dividendYield', name: '殖利率（加權）', unit: 'pct', meaning: '交易所公布的殖利率，依市值加權' },
  { key: 'roe', name: 'ROE（加權）', unit: 'pct', meaning: '近四季股東權益報酬率，依市值加權' },
  { key: 'revenueGrowth', name: '營收成長率（加權）', unit: 'pct', meaning: '近四季營收年增率，依市值加權' },
  { key: 'beta', name: 'Beta（近一年）', unit: 'ratio', meaning: '大盤漲跌 1% 時，這組持股平均跟著漲跌幾 %' },
  { key: 'revenueYoyVolatility', name: '營收年增率波動（加權）', unit: 'pct', meaning: '營收年增率起伏的大小，越大代表營收越跟著景氣起落' },
  { key: 'largeCapPct', name: '大型股占比', unit: 'pct', meaning: '全市場依市值由大到小累加，前 70% 的公司算大型股' },
  { key: 'midCapPct', name: '中型股占比', unit: 'pct', meaning: '累加市值落在 70%～90% 的公司' },
  { key: 'smallCapPct', name: '小型股占比', unit: 'pct', meaning: '累加市值最後 10% 的公司' },
  { key: 'top3HoldingsPct', name: '前三大持股占比（ETF 除外）', unit: 'pct', meaning: '市值最大的三檔占整組持股的比例；ETF 本身已分散，不算進前三' }
]

const MIN_COVERAGE = 0.5

// ponytail: 固定門檻（2026-10-19 計畫訂的預設），要調就改這一處；改了「計算方式」寫的規則跟著變
export const TAG_RULES: { key: TraitKey; label: string; rule: string; needsMarket: boolean; test: (own: number, market: number) => boolean }[] = [
  { key: 'beta', label: '低 Beta', rule: 'Beta ≤ 0.8', needsMarket: false, test: own => own <= 0.8 },
  { key: 'beta', label: '高 Beta', rule: 'Beta ≥ 1.2', needsMarket: false, test: own => own >= 1.2 },
  { key: 'dividendYield', label: '高殖利率', rule: '殖利率 ≥ 大盤的 1.5 倍', needsMarket: true, test: (own, market) => own >= market * 1.5 },
  { key: 'peRatio', label: '低本益比', rule: '本益比 ≤ 大盤的 0.7 倍', needsMarket: true, test: (own, market) => own <= market * 0.7 },
  { key: 'peRatio', label: '高本益比', rule: '本益比 ≥ 大盤的 1.3 倍', needsMarket: true, test: (own, market) => own >= market * 1.3 },
  { key: 'pbRatio', label: '低股價淨值比', rule: '股價淨值比 ≤ 大盤的 0.7 倍', needsMarket: true, test: (own, market) => own <= market * 0.7 },
  { key: 'roe', label: '高 ROE', rule: 'ROE ≥ 大盤＋5 個百分點', needsMarket: true, test: (own, market) => own >= market + 5 },
  { key: 'revenueGrowth', label: '高成長', rule: '營收成長率 ≥ 大盤＋10 個百分點', needsMarket: true, test: (own, market) => own >= market + 10 },
  { key: 'revenueYoyVolatility', label: '景氣循環型', rule: '營收年增率波動 ≥ 大盤的 1.5 倍', needsMarket: true, test: (own, market) => own >= market * 1.5 },
  // 大盤照定義是大型 70%、前三大約 45%，這兩項用固定門檻
  { key: 'largeCapPct', label: '中小型為主', rule: '大型股占比 ≤ 50%', needsMarket: false, test: own => own <= 50 },
  { key: 'top3HoldingsPct', label: '持股集中', rule: '前三大持股（ETF 除外）占比 ≥ 50%', needsMarket: false, test: own => own >= 50 }
]

function toNumber(value: string | null | undefined): number | null {
  if (value === null || value === undefined) return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

// 涵蓋不到一半市值、沒有值、需要大盤而大盤還沒有的，都不貼
export function traitTags(result: HoldingsTraitsResult): { label: string; rule: string }[] {
  return TAG_RULES.flatMap((rule) => {
    const own = toNumber(result.portfolio[rule.key]?.value)
    const coverage = toNumber(result.portfolio[rule.key]?.coverage)
    if (own === null || coverage === null || coverage < MIN_COVERAGE) return []
    const market = toNumber(result.market?.[rule.key]?.value)
    if (rule.needsMarket && market === null) return []
    return rule.test(own, market ?? 0) ? [{ label: rule.label, rule: rule.rule }] : []
  })
}

export function traitText(value: string | null | undefined, unit: 'ratio' | 'pct'): string {
  const number = toNumber(value)
  if (number === null) return '－'
  return unit === 'pct' ? `${number.toFixed(1)}%` : number.toFixed(2)
}
