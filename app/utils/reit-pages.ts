// REITs 個別頁的面向（2026-10-30，使用者「REITs 沒有像是 個股瀏覽那樣的頁面嗎?」→「要」）。同一檔的幾頁共用一個側欄，順序是退休族看一檔
// REITs 會問的：現在的價格與分配 → 價格比淨值高還是低、歷年怎麼走 → 實際分配了多少 → 持有哪些不動產 → 它是什麼、誰管、收益怎麼分配。
// 掛牌中的 REITs 清單是 /screener/reits。後綴改這裡要一起改 server/api/__sitemap__/hubs.get.ts 的清單
//
// 文案底線（投信投顧法）：只陳述數字與條款，不寫安全、推薦、便宜、貴；REITs 不保本、收益分配不固定。上游的 null 是「未知」不是「沒有」。
export const REIT_FACETS = [
  { key: 'overview', label: '速覽', suffix: '' },
  { key: 'nav', label: '收盤價與淨值', suffix: '/nav' },
  { key: 'distributions', label: '收益分配', suffix: '/distributions' },
  { key: 'properties', label: '標的不動產', suffix: '/properties' },
  { key: 'profile', label: '基本資料', suffix: '/profile' }
] as const

export type ReitFacetKey = typeof REIT_FACETS[number]['key']

export const reitFacetItems = (code: string) => REIT_FACETS.map(facet => ({ label: facet.label, to: `${reitPath(code)}${facet.suffix}` }))

export const reitYuan = (value: number | null | undefined, digits = 2) => (value === null || value === undefined ? '－' : `${value.toFixed(digits)} 元`)
export const reitPct = (value: number | null | undefined) => (value === null || value === undefined ? '－' : `${value.toFixed(2)}%`)
export const reitSignedPct = (value: number | null | undefined) => (value === null || value === undefined ? '－' : `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value).toFixed(2)}%`)
