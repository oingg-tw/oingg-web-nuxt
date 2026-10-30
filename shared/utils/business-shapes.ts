// 業務中台回應 → 站內形狀，只剩站內刻意用不同形狀的兩處（2026-10-30 Go／TS 退場、讀舊鍵的並存拿掉後）。其餘欄位站內直接用業務中台的名字。
// 被 scripts/check-business-shapes.mjs 直接 import，所以零 import

type ExType = '息' | '權' | '權息'
interface ExDateFields { exDividendDate?: string | null; exRightsDate?: string | null }

// 除權息：業務中台給除息日 exDividendDate、除權日 exRightsDate（息只有除息日、權只有除權日、權息兩個都有）；站內的行事曆、提醒、表格
// 用一個日期 exDate＋exType。權息的兩個日期是同一天，取除息日
export function withExType<T extends object>(raw: T): T {
  const row = raw as ExDateFields
  if (!row.exDividendDate && !row.exRightsDate) return raw
  const exType: ExType = row.exDividendDate && row.exRightsDate ? '權息' : row.exRightsDate ? '權' : '息'
  return { ...raw, exDate: row.exDividendDate ?? row.exRightsDate, exType }
}

type LooseRecord = Record<string, unknown>

// GET /metrics 型錄：篩選器一路用 key／name／path／period 這組名字（useFilterSchema 與篩選的元件），在讀進來時換一次。
// 分類 categoryKey／categoryDisplayName → key／name；指標 metricCode → key 與 path（兩個一直相同）；期別 timeframe → key、name、period
export function metricsCatalogFromBusiness<T extends { categories: unknown[] }>(catalog: T): T {
  return {
    ...catalog,
    categories: (catalog.categories as LooseRecord[]).map(({ categoryKey, categoryDisplayName, ...category }) => ({
      ...category,
      key: categoryKey,
      name: categoryDisplayName,
      metrics: (category.metrics as LooseRecord[]).map(({ metricCode, ...metric }) => ({
        ...metric,
        key: metricCode,
        path: metricCode,
        fields: (metric.fields as LooseRecord[]).map(({ timeframe, ...field }) => ({ ...field, key: timeframe, name: timeframe, period: timeframe }))
      }))
    }))
  }
}
