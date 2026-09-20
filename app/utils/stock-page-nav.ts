// The 個股頁面 nav tree. Extracted out of StockPageNavList.vue 2026-09-20 so the recursive node
// component (StockPageNavNode.vue) and the list itself can share the type without importing each
// other in a cycle.
//
// A node is either a LEAF (has `to`, no children) or a GROUP (has children, no `to`). A group is
// deliberately not also a link: el-sub-menu's title is its expand/collapse control, so making it
// navigate too would put two actions on one target. Where the parent has a real page of its own,
// that page becomes the group's FIRST child under its own descriptive label — see 財務報表 below,
// where「瀏覽任意季度」actually describes that page better than repeating the group name would.
export interface StockNavNode {
  label: string
  to?: (code: string) => string
  children?: StockNavNode[]
}

export const STOCK_NAV_ITEMS: StockNavNode[] = [
  { label: '亮點與風險', to: code => `/stock/${code}` },
  { label: '配股配息', to: code => `/stock/${code}/dividend` },
  // 獲利能力 2026-09-20（「配股配息下面增加獲利能力。但是獲利能力裡面會有月營收 EPS 等等」）—
  // the first real use of this nav's own group depth. A group is not itself a link (see the rule
  // at the top of this file), so 獲利能力 has no page of its own; it is the shelf its metric pages
  // sit on. The name matches GET /metrics' own 獲利能力 category, which is where `eps` lives, so
  // the nav and the metric catalog agree without a second mapping.
  //
  // 月營收 was meant to be the next entry here. It is BLOCKED on data, not on work: GET
  // /stocks/:symbol/monthly-revenue-history is a one-time manual backfill covering 2330 and
  // nothing else — measured again 2026-09-20 (2330 has 60 months, 2454/1101/2891/1216 all return
  // an empty entries array). A per-stock page family would be 2,587 empty pages out of 2,588, so
  // it is not being built until that becomes a real pipeline; asked analysis-ts the same day.
  // Two further things it needs beyond the data, so nobody reads this as a one-line job: monthly
  // revenue has no metricCode at all (nowhere to hang the description/limitations/misreadings
  // this template reads — the user's call is that copy comes from the backend), and it is MONTHLY
  // while METRIC_PAGES' template is quarterly/annual (fiscalYear + fiscalQuarter periods).
  {
    label: '獲利能力',
    children: [
      { label: 'EPS', to: code => `/stock/${code}/eps` }
    ]
  },
  // 指標歷史 hidden 2026-09-20（「指標歷史先隱藏」）— commented out rather than deleted, the same
  // way APP_FEATURES parks its temporarily-shelved entries; re-add by uncommenting. The PAGE is
  // untouched and still live: /stock/{code}/metrics-history still renders, still carries its own
  // canonical, and is still one of INDEXABLE_SUFFIXES in the stocks sitemap. That matches how
  // ETF 專區/特別股專區 were hidden (nav entry out, route left published). It does NOT orphan the
  // page: dividend.vue and financial-statements.vue both still link to it from their own body
  // copy. Unpublishing it properly (sitemap suffix out + noindex, what 公司健檢 below got) would
  // be a different, bigger call and is not what this change did.
  // { label: '指標歷史', to: code => `/stock/${code}/metrics-history` },
  // 公司健檢 was removed 2026-09-19 (unpublished pending a redesign — see that page's own comment).
  //
  // 財務報表 became a group 2026-09-20 when the latest filing's three tables moved to their own
  // URLs. It stays reachable as its own page through the first child rather than through the group
  // title, per the rule above.
  {
    label: '財務報表',
    children: [
      { label: '瀏覽任意季度', to: code => `/stock/${code}/financial-statements` },
      { label: '資產負債表', to: code => `/stock/${code}/balance-sheet` },
      { label: '損益表', to: code => `/stock/${code}/income-statement` },
      { label: '現金流量表', to: code => `/stock/${code}/cash-flow-statement` }
    ]
  }
]

// Every group whose subtree contains `path`, by the index StockPageNavNode gives its el-sub-menu.
// el-menu's `default-openeds` wants those ids, and this is what keeps the branch you arrived on
// expanded — landing on /balance-sheet must not hide the group it belongs to.
export function openGroupsFor(nodes: StockNavNode[], code: string, path: string): string[] {
  const open: string[] = []
  const walk = (list: StockNavNode[]): boolean =>
    list.reduce((hit, node) => {
      if (!node.children) return node.to?.(code) === path || hit
      if (!walk(node.children)) return hit
      open.push(`group:${node.label}`)
      return true
    }, false)
  walk(nodes)
  return open
}
