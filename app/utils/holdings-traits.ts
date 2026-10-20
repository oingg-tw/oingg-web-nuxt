// 持股特色（2026-10-19，使用者：「PER 多少、BETA 多少、ROE 多少…有些是低 Beta、有些是景氣循環專精，分享的時候可以一起帶出去，
// 造訪的人就可以看出這一組持股的特色」）。數字都由 業務中台 算（GET /holdings/traits，業務中台 bd8a4e9；分享頁的公開資料是同一份）：
// 組合依市值占比加權（本益比、股價淨值比用調和平均），Beta 是近一年回推（2026-10-20 起只在這裡，風險頁不再列：使用者
// 「做好資訊分工 避免重複」）；大盤是全市場普通股依市值、同一套算法
// （analysis-ts 算，上線前 market 是 null）。前三大占比借基金月報的前幾大占比（業務中台 a5cae2b）；規模與風格九宮格借 Morningstar
// Style Box（使用者：「要做 而且要九宮格」，業務中台 b7ffbc5／analysis-ts 841ee654）。這裡只管三件事：每一列怎麼寫、九宮格的格子、
// 標籤怎麼貼——持股分析頁與分享頁共用（HoldingsTraits）。
//
// 標籤：使用者知道這是替持股分類、法規上屬灰色地帶，仍選了要貼（2026-10-19）。所以只用事實性的高／低與固定門檻，每一組持股同一套
// 規則，門檻寫在「計算方式」；不用便宜、穩健、優質這類評價字眼，也不說適合誰。涵蓋不到一半市值的不貼（ETF、特別股沒有財報）。
//
// 不 import 任何東西：scripts/check-holdings-traits.mjs 直接用 node 跑它。

// 九宮格：列是規模、欄是風格，key 是「列＋欄＋Pct」（largeValuePct…smallGrowthPct）。每格是落在這一格的持股占市值 %，9 格合計 100
// （四捨五入可能差 0.01）；只算分得出規模與風格的個股，9 格的 coverage 相同。「中小型為主」不看九宮格的列合計、讀 largeCapPct：
// 分不出風格的多是近兩年上市的中小型股，九宮格不算它們，列合計會偏向大型（業務中台 提醒，2026-10-19）
export const STYLE_BOX_ROWS = [{ key: 'large', label: '大型' }, { key: 'mid', label: '中型' }, { key: 'small', label: '小型' }] as const
export const STYLE_BOX_COLUMNS = [{ key: 'Value', label: '價值' }, { key: 'Core', label: '混合' }, { key: 'Growth', label: '成長' }] as const
type StyleBoxRow = typeof STYLE_BOX_ROWS[number]['key']
type StyleBoxColumn = typeof STYLE_BOX_COLUMNS[number]['key']
export type StyleBoxKey = `${StyleBoxRow}${StyleBoxColumn}Pct`
export const styleBoxKey = (row: StyleBoxRow, column: StyleBoxColumn): StyleBoxKey => `${row}${column}Pct`

export type TraitKey = 'peRatio' | 'pbRatio' | 'dividendYield' | 'roe' | 'revenueGrowth' | 'beta' | 'revenueYoyVolatility' | 'top3HoldingsPct' | 'largeCapPct' | StyleBoxKey
// 數字字串（beta 6 位、其餘 2 位小數）；dividendYield、roe、revenueGrowth、revenueYoyVolatility 與 *Pct 的單位是 %（"30.80" ＝ 30.8%）。
// coverage ＝ 參與計算的持股占的權重（0～1）。全是 ETF 時 top3HoldingsPct 是真的 "0"，不是沒有資料
export interface TraitValue { value: string | null; coverage: string | null }
export type Traits = Record<TraitKey, TraitValue>
export interface HoldingsTraitsResult { asOf: string | null; portfolio: Traits; market: Traits | null }

// 名稱不帶算法（「整體」「加權」寫在意思裡，手機上名稱才不換行）；「近一年」「ETF 除外」改變了意思，留在名稱上
export const TRAIT_ROWS: { key: TraitKey; name: string; unit: 'ratio' | 'pct'; meaning: string }[] = [
  { key: 'peRatio', name: '本益比', unit: 'ratio', meaning: '各檔本益比依市值的調和平均，等於把整組持股當成一家公司；虧損公司不算入' },
  { key: 'pbRatio', name: '股價淨值比', unit: 'ratio', meaning: '各檔股價淨值比依市值的調和平均' },
  { key: 'dividendYield', name: '殖利率', unit: 'pct', meaning: '交易所公布的殖利率，依市值加權平均' },
  { key: 'roe', name: 'ROE', unit: 'pct', meaning: '近四季股東權益報酬率，依市值加權平均' },
  { key: 'revenueGrowth', name: '營收成長率', unit: 'pct', meaning: '近四季營收年增率，依市值加權平均' },
  { key: 'beta', name: 'Beta（近一年）', unit: 'ratio', meaning: '大盤漲跌 1% 時，這組持股平均跟著漲跌幾 %；用現在的持股比例套近一年的股價回推，ETF 也算在內' },
  { key: 'revenueYoyVolatility', name: '營收年增率波動', unit: 'pct', meaning: '近三個月累計營收年增率在近五年的起伏大小，越大代表營收越跟著景氣起落；依市值加權平均。營建股不算（營收依完工交屋認列，年增率本來就大起大落），去年同期基數異常低的月份也不採用' },
  { key: 'top3HoldingsPct', name: '前三大持股占比（ETF 除外）', unit: 'pct', meaning: '市值最大的三檔占整組持股的比例，分母包含 ETF；ETF 本身已分散、這裡拆不到它的成分股，不算進前三（0050 裡的台積電看不到）；特別股算一檔' }
]

const MIN_COVERAGE = 0.5
const boxColumn = (column: StyleBoxColumn) => STYLE_BOX_ROWS.map(item => styleBoxKey(item.key, column))

// ponytail: 固定門檻（2026-10-19 計畫訂的預設），要調就改這一處；改了「計算方式」寫的規則跟著變。keys 不只一個時看合計（九宮格的一欄）
export const TAG_RULES: { keys: TraitKey[]; label: string; rule: string; needsMarket: boolean; test: (own: number, market: number) => boolean }[] = [
  { keys: ['beta'], label: '低 Beta', rule: 'Beta ≤ 0.8', needsMarket: false, test: own => own <= 0.8 },
  { keys: ['beta'], label: '高 Beta', rule: 'Beta ≥ 1.2', needsMarket: false, test: own => own >= 1.2 },
  { keys: ['dividendYield'], label: '高殖利率', rule: '殖利率 ≥ 大盤的 1.5 倍', needsMarket: true, test: (own, market) => own >= market * 1.5 },
  { keys: ['peRatio'], label: '低本益比', rule: '本益比 ≤ 大盤的 0.7 倍', needsMarket: true, test: (own, market) => own <= market * 0.7 },
  { keys: ['peRatio'], label: '高本益比', rule: '本益比 ≥ 大盤的 1.3 倍', needsMarket: true, test: (own, market) => own >= market * 1.3 },
  { keys: ['pbRatio'], label: '低股價淨值比', rule: '股價淨值比 ≤ 大盤的 0.7 倍', needsMarket: true, test: (own, market) => own <= market * 0.7 },
  { keys: ['roe'], label: '高 ROE', rule: 'ROE ≥ 大盤＋5 個百分點', needsMarket: true, test: (own, market) => own >= market + 5 },
  { keys: ['revenueGrowth'], label: '高成長', rule: '營收成長率 ≥ 大盤＋10 個百分點', needsMarket: true, test: (own, market) => own >= market + 10 },
  { keys: ['revenueYoyVolatility'], label: '景氣循環型', rule: '營收年增率波動 ≥ 大盤的 1.5 倍', needsMarket: true, test: (own, market) => own >= market * 1.5 },
  // 規模、風格與前三大用固定門檻：大盤的大型約七成、前三大約 45%，風格欄則是台積電所在的混合欄占六成
  { keys: ['largeCapPct'], label: '中小型為主', rule: '大型股占比 ≤ 50%', needsMarket: false, test: own => own <= 50 },
  { keys: boxColumn('Value'), label: '價值型為主', rule: '價值股（九宮格左欄）合計 ≥ 50%', needsMarket: false, test: own => own >= 50 },
  { keys: boxColumn('Growth'), label: '成長型為主', rule: '成長股（九宮格右欄）合計 ≥ 50%', needsMarket: false, test: own => own >= 50 },
  { keys: ['top3HoldingsPct'], label: '持股集中', rule: '前三大持股（ETF 除外）占比 ≥ 50%', needsMarket: false, test: own => own >= 50 }
]

function toNumber(value: string | null | undefined): number | null {
  if (value === null || value === undefined) return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

// 一個值，或九宮格一欄的合計（全部沒有值才是 null）。合計四捨五入到 2 位，跟上游的精度一樣：10＋26.74＋13.26 不會被浮點數算成
// 49.99999999999999 而踩不到門檻
function read(traits: Traits | null, keys: TraitKey[]): { value: number | null; coverage: number | null } {
  const values = keys.map(key => toNumber(traits?.[key]?.value))
  const coverage = toNumber(keys.map(key => traits?.[key]?.coverage).find(value => value != null))
  if (values.every(value => value === null)) return { value: null, coverage }
  const sum = values.reduce<number>((total, value) => total + (value ?? 0), 0)
  return { value: keys.length > 1 ? Math.round(sum * 100) / 100 : sum, coverage }
}

// 涵蓋不到一半市值、沒有值、需要大盤而大盤還沒有的，都不貼。只回標籤名：數字只在指標表與九宮格出現一次（使用者：「資訊還重複了」）
export function traitTags(result: HoldingsTraitsResult): string[] {
  return TAG_RULES.flatMap((rule) => {
    const own = read(result.portfolio, rule.keys)
    if (own.value === null || own.coverage === null || own.coverage < MIN_COVERAGE) return []
    const market = read(result.market, rule.keys).value
    if (rule.needsMarket && market === null) return []
    return rule.test(own.value, market ?? 0) ? [rule.label] : []
  })
}

export function traitText(value: string | null | undefined, unit: 'ratio' | 'pct'): string {
  const number = toNumber(value)
  if (number === null) return '－'
  return unit === 'pct' ? `${number.toFixed(1)}%` : number.toFixed(2)
}

// 九宮格的一格：寫四捨五入的整數（不到 0.5% 寫「<1%」），底色深淺也照這個整數決定，同樣寫 10% 的兩格不會一深一淺
export function boxCell(value: string | null | undefined): { text: string; level: 0 | 1 | 2 | 3 } {
  const number = toNumber(value)
  if (number === null) return { text: '－', level: 0 }
  const rounded = Math.round(number)
  return { text: number > 0 && number < 0.5 ? '<1%' : `${rounded}%`, level: rounded >= 25 ? 3 : rounded >= 10 ? 2 : number > 0 ? 1 : 0 }
}
