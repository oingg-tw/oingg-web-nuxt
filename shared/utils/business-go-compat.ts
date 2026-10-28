// 業務中台換成 Go 版（oingg-business-go）的並存期：Go 版照生態系詞彙表改了回應的鍵（oingg-business-go 的 docs/contract-delta.md），
// business-ts 還是舊鍵，快取裡也還留著舊的回應。這裡把 Go 版的形狀換回站內一直在用的形狀，兩邊都讀得懂。
// 只改名、讀取處又只有一兩個的（A1 companyName 之類）直接在讀取處寫 `新 ?? 舊`，搜尋「Go 換版並存」找得到全部。
// shortcut: 站內照舊用舊鍵名，business-ts 退場後拿掉這個檔與那些 `?? 舊`，改成直接讀新鍵

type ExType = '息' | '權' | '權息'
interface ExDateFields { exDate?: string | null; exType?: ExType; exDividendDate?: string | null; exRightsDate?: string | null }

// A14：exDate＋exType → exDividendDate／exRightsDate（息只有除息日、權只有除權日、權息兩個都有）。
// 權息兩個日期在舊格式是同一天，取除息日
export function withExType<T extends object>(raw: T): T {
  const row = raw as ExDateFields
  if (row.exType || (!row.exDividendDate && !row.exRightsDate)) return raw
  const exType: ExType = row.exDividendDate && row.exRightsDate ? '權息' : row.exRightsDate ? '權' : '息'
  return { ...raw, exDate: row.exDividendDate ?? row.exRightsDate, exType }
}

type LooseRecord = Record<string, unknown>

// A11：持股特色（GET /holdings/traits、分享頁的 traits）的大盤 market → benchmark
export function traitsFromGo<T extends object>(raw: T): T {
  const row = raw as LooseRecord
  return 'benchmark' in row ? { ...raw, market: row.benchmark } : raw
}

// A12：特別股清單的特別股簡稱 name → companyName、listedDate → listingDate（站內很多地方讀這兩個，所以在讀進來時換）
export function preferredStockFromGo<T extends object>(raw: T): T {
  const row = raw as LooseRecord
  return 'companyName' in row ? { ...raw, name: row.companyName, listedDate: row.listingDate ?? null } : raw
}

// A6：GET /metrics 型錄。分類 key／name → categoryKey／categoryDisplayName；指標 key → metricCode、path 拿掉（值一直等於 key）；
// 期別 key＋period 合成 timeframe、name 拿掉（三個值一直相同）
export function metricsCatalogFromGo<T extends { categories: unknown[] }>(catalog: T): T {
  return {
    ...catalog,
    categories: (catalog.categories as LooseRecord[]).map((category) => {
      const { categoryKey, categoryDisplayName, ...rest } = category
      return {
        ...rest,
        ...(categoryKey === undefined ? {} : { key: categoryKey, name: categoryDisplayName }),
        metrics: (category.metrics as LooseRecord[]).map((metric) => {
          const { metricCode, ...metricRest } = metric
          return {
            ...metricRest,
            ...(metricCode === undefined ? {} : { key: metricCode, path: metricCode }),
            fields: (metric.fields as LooseRecord[]).map(({ timeframe, ...field }) =>
              timeframe === undefined ? field : { ...field, key: timeframe, name: timeframe, period: timeframe })
          }
        })
      }
    })
  }
}
