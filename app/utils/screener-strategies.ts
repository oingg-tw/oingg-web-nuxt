// 選股策略頁（/screener/strategies）與條件說明頁（/screener/common/{slug}）共用：範本的條件一條一個、選股策略頁的分段與出處說明。
// scripts/check-screener-strategies.mjs 直接 import 這個檔案，所以不寫 import；templateConditions 用自動匯入的型錄工具，檢查腳本不呼叫它

export const STRATEGIES_PATH = '/screener/strategies'

interface TemplateFilter {
  field: string
  min: number | null
  max: number | null
  exclude: boolean
}

export interface TemplateCondition {
  field: string
  label: string
  period: string
  range: string
  metricPage: string | null
}

function rangeText(filter: TemplateFilter, unit: string): string {
  const suffix = unit === '%' ? '%' : unit ? ` ${unit}` : ''
  const min = filter.min !== null ? `${filter.min}${suffix}` : null
  const max = filter.max !== null ? `${filter.max}${suffix}` : null
  let text = min && max ? `${min} 到 ${max}` : min ? `≥ ${min}` : max ? `≤ ${max}` : '有值即可'
  if (filter.exclude) text = `排除：${text}`
  // 負的界線用「−」（成長突破的「距 52 週高點 ≥ −15%」，2026-11-24）
  return minusSign(text)
}

// 指標名稱與期間照型錄寫；型錄裡找不到的欄位（下架或改名）退回欄位代號
export function templateConditions(filters: TemplateFilter[], categories: Parameters<typeof locateFieldInSchema>[0]): TemplateCondition[] {
  return filters.map((filter) => {
    const located = locateFieldInSchema(categories, filter.field)
    const metricCode = filter.field.split('.')[0] ?? filter.field
    return {
      field: filter.field,
      label: located ? metricDisplayName(located.metric) : metricCode,
      period: located ? (formatPeriodLabel(located.field.period) ?? located.field.period) : (filter.field.split('.')[1] ?? ''),
      range: rangeText(filter, located?.metric.unit ?? ''),
      metricPage: isIndexableMetricSlug(metricSlug(metricCode)) ? metricPath(metricCode) : null
    }
  })
}

// 出處說明：業務中台範本說明「——」後面那段（前面是條件，卡片上已經一條一條列了）；沒有「——」就整段
export function strategyIntro(description: string | null | undefined): string {
  const text = (description ?? '').trim()
  const cut = text.indexOf('——')
  return cut >= 0 ? text.slice(cut + 2).trim() : text
}

// 依類別分段：篩選頁預設那一組的類別排最前面，其餘照業務中台給的順序；段裡預設那組在前
export function strategyGroups<T extends { category: string | null; isDefault: boolean }>(templates: T[]): { category: string; items: T[] }[] {
  const groups = new Map<string, T[]>()
  for (const template of [...templates.filter(item => item.isDefault), ...templates.filter(item => !item.isDefault)]) {
    const category = template.category || '其他'
    groups.set(category, [...(groups.get(category) ?? []), template])
  }
  return [...groups].map(([category, items]) => ({ category, items }))
}
