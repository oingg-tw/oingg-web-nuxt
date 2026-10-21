import type { RankingRow } from '#shared/types/hub'

// GET /api/hub/rank-leaders — 每一份排行的第一名（2026-10-21，/rank 首頁：側欄已經列出所有排行，首頁改答「每一份排行現在的第一名」）。
// 每份排行讀 getRanking 自己的快取（同排行頁，每天更新）；有一份讀不到就那一份是 null，不拖累其他份
export default defineEventHandler(async () => {
  const settled = await Promise.allSettled(RANK_PAGES.map(page => getRanking(page.slug)))
  return RANK_PAGES.map((page, index) => {
    const result = settled[index]!
    const data = result.status === 'fulfilled' ? result.value : null
    // 單位：普通股的排行由上游給（%、倍），ETF 的寫在 RANK_PAGES
    return { slug: page.slug, leader: (data?.rows[0] ?? null) as RankingRow | null, asOf: data?.asOf ?? null, unit: page.unit ?? data?.unit ?? null }
  })
})
