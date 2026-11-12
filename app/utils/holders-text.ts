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
