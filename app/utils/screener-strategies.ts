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

// 符號、數字、單位之間是不斷行空白：一行條件折行時「≥」「−15%」「倍」不會落單（2026-11-26 方案 D 的成長突破折成「≥」換行「−15%」）
export function rangeText(filter: TemplateFilter, unit: string, options?: Parameters<typeof findScreenerOption>[0]): string {
  const suffix = unit === '%' ? '%' : unit ? ` ${unit}` : ''
  // 類別條件寫選項的名稱，「包含／排除」同篩選頁的條件膠囊；對不到選項的照原值
  if (filter.values?.length) return `${filter.exclude ? '排除' : '包含'} ${filter.values.map(value => findScreenerOption(options, value)?.label ?? String(value)).join('、')}`
  // 兩端都有寫「0～1.5 倍」，同條件膠囊的「～」；負的界線用「−」（成長突破的「距 52 週高點 ≥ −15%」，2026-11-24）
  const { min, max } = filter
  const text = minusSign(min !== null && max !== null ? `${min}～${max}${suffix}` : min !== null ? `≥ ${min}${suffix}` : max !== null ? `≤ ${max}${suffix}` : '有值即可')
  return filter.exclude ? `排除：${text}` : text
}

// 只有每日一個值的（即時本益比、殖利率）不寫期間，同篩選頁的條件膠囊（NON_INFORMATIVE_SOLE_PERIODS）
const UNSTATED_PERIODS = new Set(['EOD', 'snapshot'])

// 指標名稱與期間照型錄寫；型錄裡找不到的欄位（下架或改名）退回欄位代號
export function templateConditions(filters: TemplateFilter[], categories: Parameters<typeof locateFieldInSchema>[0]): TemplateCondition[] {
  return filters.map((filter) => {
    const located = locateFieldInSchema(categories, filter.field)
    const metricCode = filter.field.split('.')[0] ?? filter.field
    const period = located ? located.field.period : (filter.field.split('.')[1] ?? '')
    return {
      field: filter.field,
      label: located ? metricDisplayName(located.metric) : metricCode,
      period: UNSTATED_PERIODS.has(period) ? '' : (located ? formatPeriodLabel(period) ?? period : period),
      range: rangeText(filter, located?.metric.unit ?? '', located?.metric.options),
      metricPage: isIndexableMetricSlug(metricSlug(metricCode)) ? metricPath(metricCode) : null
    }
  })
}

// 名稱底下那一行的一個條件（2026-11-26 方案 D）：「ROE（近四季）≥ 17%」，沒有期間的「本益比 0 到 20 倍」
export const conditionText = (condition: Pick<TemplateCondition, 'label' | 'period' | 'range'>): string =>
  condition.period ? `${condition.label}（${condition.period}）${condition.range}` : `${condition.label} ${condition.range}`

// 每一類的一句白話（2026-11-26 方案 D；類別是業務中台的，照數據中台第十一輪的投資風格）。不寫買賣，也避開 compliance-words 的字；
// 對不到的類別（改名、新增）不寫，段落照樣有標題
export const STRATEGY_CATEGORY_LINES: Record<string, string> = {
  價值型: '本益比或股價淨值比低的公司。',
  成長型: '營收、獲利正在成長的公司。',
  股利型: '每年配發現金股利、殖利率高的公司。',
  品質型: '財務體質分數與獲利能力高的公司。',
  趨勢型: '股價接近一年高點的公司。',
  防禦型: '股價波動比大盤小的公司。'
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
