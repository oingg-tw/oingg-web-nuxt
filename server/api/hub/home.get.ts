import type { HomePageData } from '#shared/types/hub'
import { homeMonths, upcomingDays } from '#shared/utils/home-agenda'

// GET /api/hub/home — 首頁（2026-11-02 改版 B-3「接下來的除權息與發放」）：從今天起有除權息、有發放的前四天，今年每月的除權息
// 檔數，三個篩選範本的符合檔數，資料涵蓋。全是已經快取的讀取組起來的，這裡不另外快取；每一塊讀不到就是 null，首頁不畫那一塊，
// 不讓整頁 500。「今天」以台北時間為準，由這裡決定：瀏覽器自己算的話，伺服器與瀏覽器的日期不同就 hydration 不一致
const HOME_TEMPLATES = ['dividend-stability', 'value', 'financial-resilience']
const UPCOMING_DAYS = 4

async function upcoming(today: string) {
  const rows = (await Promise.all(homeMonths(today).map(month => getExDividendMonth(month)))).flat()
  return { ex: upcomingDays(rows, today, 'exDate', UPCOMING_DAYS), pay: upcomingDays(rows, today, 'paymentDate', UPCOMING_DAYS) }
}

// 範本的說明是業務中台的原文，首頁只取第一句（「——」或「：」之前）
async function homeTemplates() {
  const templates = await getScreenerTemplates()
  const picked = HOME_TEMPLATES.flatMap(slug => templates.filter(template => template.slug === slug))
  return Promise.all(picked.map(async template => ({
    slug: template.slug!,
    name: template.name,
    rule: (template.description ?? '').split(/——|：/)[0]!.trim(),
    count: await settle(getTemplateMatchCount(template.slug!))
  })))
}

async function coverage() {
  const [securities, catalog] = await Promise.all([getSecurityCounts(), getMetricsCatalog()])
  const metrics = (catalog.categories as { metrics: unknown[] }[]).reduce((sum, category) => sum + category.metrics.length, 0)
  return { ...securities, metrics }
}

export default defineEventHandler(async (): Promise<HomePageData> => {
  const today = new Date(Date.now() + 8 * HOUR * 1000).toISOString().slice(0, 10)
  const [agenda, cells, templates, counts] = await Promise.all([
    settle(upcoming(today)),
    settle(getExDividendMonthCells(today.slice(0, 7))),
    settle(homeTemplates()),
    settle(coverage())
  ])
  return { today, upcoming: agenda, cells, templates, coverage: counts }
})
