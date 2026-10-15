// 「一圖一表」的規則（2026-10-15 從 check-stock-pages 搬出來，篩選區的 ETF、特別股個別頁也用同一條）。
// 圖＝SharedChartCard（SSR 就有的 el-card，不用等水合）；表＝不是審計的 data-ssr-table（計算依據標 data-ssr-table="audit"，不算）。

export function pageShape(html) {
  return {
    charts: (html.match(/<div class="el-card[^"]*\bshared-chart-card\b/g) ?? []).length,
    tables: (html.match(/<table[^>]*data-ssr-table(?!="audit")/g) ?? []).length
  }
}

// 至多一張圖、至多 maxTables 張表；有表就一定要有那張圖（先圖表再表格）。兩者都沒有不算失敗（資料不夠畫圖的頁面）
export function isOneChartOneTable({ charts, tables }, maxTables = 1) {
  return charts <= 1 && tables <= maxTables && (tables === 0 || charts === 1)
}
