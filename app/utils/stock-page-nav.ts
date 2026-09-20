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
  { label: '指標歷史', to: code => `/stock/${code}/metrics-history` },
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
