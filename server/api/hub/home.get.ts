import type { HomePageData } from '#shared/types/hub'
import { dayEvents, homeMonths, homeWeeks } from '#shared/utils/home-weeks'

// GET /api/hub/home — 首頁（2026-11-02 改版 B-1「兩週週曆」）：這兩週每天的除權息與發放、今年每月的除權息檔數、三個篩選範本的
// 符合檔數、資料涵蓋。全是已經快取的讀取組起來的，這裡不另外快取；每一塊讀不到就是 null，首頁不畫那一塊，不讓整頁 500。
// 「今天」以台北時間為準，由這裡決定：瀏覽器自己算的話，伺服器與瀏覽器的日期不同就 hydration 不一致
const HOME_TEMPLATES = ['dividend-stability', 'value', 'financial-resilience']

async function calendarWeeks(today: string) {
  const weeks = homeWeeks(today)
  const dates = weeks.flatMap(week => week.dates)
  const rows = (await Promise.all(homeMonths(dates[0]!, dates.at(-1)!).map(month => getExDividendMonth(month)))).flat()
  return weeks.map(week => ({
    label: week.label,
    days: week.dates.map(date => ({ date, ex: dayEvents(rows, date, 'exDate'), pay: dayEvents(rows, date, 'paymentDate') }))
  }))
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
  const [weeks, cells, templates, counts] = await Promise.all([
    settle(calendarWeeks(today)),
    settle(getExDividendMonthCells(today.slice(0, 7))),
    settle(homeTemplates()),
    settle(coverage())
  ])
  return { today, weeks, cells, templates, coverage: counts }
})
