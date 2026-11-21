import type { ShareholdingDistribution } from '#shared/types/screener-detail'

type HolderWeek = ShareholdingDistribution['weeks'][number]

// 持有人結構的答句與 meta description（ETF 面向、個股 /holders 共用，2026-11-12）。只陳述「持有多少的人占多少」，不寫散戶、大戶、
// 籌碼集中這種帶判斷的詞。答句寫比例最高的兩組，每一組都在下面的表裡（2026-11-06，使用者：「卡片之前的文字描述過多了，會失焦」）
export function holdersAnswer(week: HolderWeek | undefined): string | null {
  const [first, second] = [...(week?.groups ?? [])].sort((a, b) => b.custodyPct - a.custodyPct)
  if (!week || !first) return null
  return `${week.dataDate} 集保資料，比例最高的是 ${first.name} ${first.custodyPct.toFixed(2)}%${second ? `，其次是 ${second.name} ${second.custodyPct.toFixed(2)}%` : ''}。`
}

// 全部列出的長句給搜尋結果。name 是「短名（代號）」
export function holdersDescription(weeks: HolderWeek[], name: string): string | null {
  const week = weeks.at(-1)
  if (!week) return null
  const groups = week.groups.map(group => `${group.name} ${group.custodyPct.toFixed(2)}%`).join('、')
  return `${week.dataDate} 集保資料，${name}依持有張數分組的集保比例：${groups}。資料從 ${weeks[0]!.dataDate} 起，共 ${weeks.length} 週。`
}

// 股權分散表（數據中台 B 批第 8 項，2026-11-22；設計 https://claude.ai/artifact/BffXAybhLkibJSNAcRTDkz）：MOPS 一年一期、股東名簿基準日，
// 只有最新一期（詞彙表二之五之七）。跟上面的每週集保是不同的表：那張依持有張數分組，這張依股東類別，答句各寫各的日期，兩段不互相比
export interface ShareholderDistribution {
  symbol: string
  dataDate: string | null
  shareholderMeetingDate: string | null
  totalShareholders: number | null
  totalShares: number | null
  categories: { category: string; holderCount: number | null; shares: number | null; sharesPct: number | null }[]
  // 董監與大股東合計：跟 11 類重疊，不是第 12 類
  directorsAndMajorShareholders: { holderCount: number | null; shares: number | null; sharesPct: number | null } | null
}

// 11 類的名稱照詞彙表，表格照 MOPS 的順序全部列出
export const HOLDER_CATEGORY_LABELS: Record<string, string> = {
  government_agency: '政府機構',
  domestic_financial_institution: '本國金融機構',
  domestic_securities_trust_fund: '本國證券投資信託基金',
  domestic_corporate: '本國公司法人',
  domestic_other_juristic: '本國其他法人',
  foreign_financial_institution: '外國金融機構',
  foreign_juristic: '外國法人',
  foreign_securities_trust_fund: '外國證券投資信託基金',
  domestic_individual: '本國自然人',
  foreign_individual: '外國自然人',
  treasury_stock: '庫藏股'
}

// 圖上合成 7 組（11 段的比例條讀不出東西），順序固定、每組顏色跟著組走；不到 2% 的再併進「其他」（全站組成圖的規則，foldSmallLayers），
// 一段都是 0 的不畫。foldSmallLayers 用 Nuxt 的自動匯入：寫成相對路徑的 import，伺服器打包把它當外部模組、路徑又多算一層（2026-11-22 建置失敗）
const HOLDER_GROUPS: [string, string[]][] = [
  ['外國法人與基金', ['foreign_financial_institution', 'foreign_juristic', 'foreign_securities_trust_fund']],
  ['本國自然人', ['domestic_individual']],
  ['政府機構', ['government_agency']],
  ['本國金融機構與投信基金', ['domestic_financial_institution', 'domestic_securities_trust_fund']],
  ['本國公司與其他法人', ['domestic_corporate', 'domestic_other_juristic']],
  ['外國自然人', ['foreign_individual']],
  ['庫藏股', ['treasury_stock']]
]
export const HOLDER_OTHERS = '其他'
export const HOLDER_GROUP_NAMES = [...HOLDER_GROUPS.map(([name]) => name), HOLDER_OTHERS]

// base：併進其他之後名字變成「其他（含…）」，顏色照原本那一組
export interface HolderTypeGroup {
  name: string
  base: string
  pct: number
}

export function holderTypeGroups(distribution: ShareholderDistribution | null | undefined): HolderTypeGroup[] {
  if (!distribution?.categories.length) return []
  const pctOf = (codes: string[]) => codes.reduce((sum, code) => sum + (distribution.categories.find(item => item.category === code)?.sharesPct ?? 0), 0)
  const layers = [...HOLDER_GROUPS.map(([name, codes]) => ({ name, values: [pctOf(codes)] })), { name: HOLDER_OTHERS, values: [0] }]
  return foldSmallLayers(layers, Object.fromEntries(HOLDER_GROUPS.map(([name]) => [name, HOLDER_OTHERS])))
    .map(layer => ({ name: layer.name, base: layer.name.split('（')[0]!, pct: layer.values[0]! }))
}

// 答句寫比例最高的兩組（卡片前的文字只寫答案，其餘在圖例與表格）
export function holderTypeAnswer(distribution: ShareholderDistribution | null | undefined): string | null {
  const [first, second] = holderTypeGroups(distribution).sort((a, b) => b.pct - a.pct)
  if (!distribution?.dataDate || !first) return null
  return `${distribution.dataDate} 的股東名簿上，${first.name}持有 ${first.pct.toFixed(2)}%${second ? `，${second.name} ${second.pct.toFixed(2)}%` : ''}。`
}
