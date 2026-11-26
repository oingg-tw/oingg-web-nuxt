// 選股策略頁（/screener/strategies，STRATEGIES_PATH 在 shared/utils/hub-slugs.ts）：範本的條件一條一個、排列順序與出處說明。
// scripts/check-screener-strategies.mjs 直接 import 這個檔案，所以不寫 import；templateConditions 用自動匯入的型錄工具，檢查腳本不呼叫它，
// rangeText 用的 minusSign、findScreenerOption 由檢查腳本掛在 globalThis

interface TemplateFilter {
  field: string
  min: number | null
  max: number | null
  exclude: boolean
  values?: (string | number)[] | null
}

export interface TemplateCondition {
  field: string
  label: string
  period: string
  range: string
  metricPage: string | null
}

export function rangeText(filter: TemplateFilter, unit: string, options?: Parameters<typeof findScreenerOption>[0]): string {
  const suffix = unit === '%' ? '%' : unit ? ` ${unit}` : ''
  const min = filter.min !== null ? `${filter.min}${suffix}` : null
  const max = filter.max !== null ? `${filter.max}${suffix}` : null
  // 類別條件寫選項的名稱（大型權值股的規模「大型」，2026-11-26）；對不到選項的照原值
  const picked = filter.values?.length ? filter.values.map(value => findScreenerOption(options, value)?.label ?? String(value)).join('、') : null
  // 負的界線用「−」（成長突破的「距 52 週高點 ≥ −15%」，2026-11-24）
  const text = picked ?? minusSign(min && max ? `${min} 到 ${max}` : min ? `≥ ${min}` : max ? `≤ ${max}` : '有值即可')
  return filter.exclude ? `排除：${text}` : text
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
      range: rangeText(filter, located?.metric.unit ?? '', located?.metric.options),
      metricPage: isIndexableMetricSlug(metricSlug(metricCode)) ? metricPath(metricCode) : null
    }
  })
}

// 出處說明：業務中台範本說明「——」後面那段（前面是條件，條件表已經一條一條列了）；沒有「——」就整段
export function strategyIntro(description: string | null | undefined): string {
  const text = (description ?? '').trim()
  const cut = text.indexOf('——')
  return cut >= 0 ? text.slice(cut + 2).trim() : text
}

// 依類別排：篩選頁預設那一組的類別排最前面，其餘照業務中台給的順序；同類別裡預設那組在前
export function strategyGroups<T extends { category: string | null; isDefault: boolean }>(templates: T[]): { category: string; items: T[] }[] {
  const groups = new Map<string, T[]>()
  for (const template of [...templates.filter(item => item.isDefault), ...templates.filter(item => !item.isDefault)]) {
    const category = template.category || '其他'
    groups.set(category, [...(groups.get(category) ?? []), template])
  }
  return [...groups].map(([category, items]) => ({ category, items }))
}
