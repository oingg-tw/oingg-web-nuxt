import type { RankPreview } from '#shared/types/hub'

// GET /api/hub/rank-leaders — 每一份排行的前 5 名（/rank 首頁的分類卡片；2026-11-03 使用者選了方案 B，原本只回第一名）。
// 每份排行讀 getRanking 自己的快取（同排行頁，每天更新）；有一份讀不到就那一份沒有列，不拖累其他份
const PREVIEW_ROWS = 5

export default defineEventHandler(async (): Promise<RankPreview[]> => {
  const settled = await Promise.allSettled(RANK_PAGES.map(page => getRanking(page.slug)))
  return RANK_PAGES.map((page, index) => {
    const result = settled[index]!
    const data = result.status === 'fulfilled' ? result.value : null
    // 單位：普通股的排行由上游給（%、倍），ETF 的寫在 RANK_PAGES
    return {
      slug: page.slug,
      rows: data?.rows.slice(0, PREVIEW_ROWS) ?? [],
      count: data?.rows.length ?? 0,
      asOf: data?.asOf ?? null,
      valueYear: data?.valueYear ?? null,
      unit: page.unit ?? data?.unit ?? null
    }
  })
})
