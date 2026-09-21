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
  // 配股配息 became a group 2026-09-21（「sidebar 配股配息底下要拆子項目，就像是獲利能力底下拆 EPS
  // 出來一樣」）— same rule as 財務報表/獲利能力 above/below: the parent still has a real page of its
  // own (five question sections: 總覽/近幾季/歷年/股息來源/除權息日期), so it stays reachable as the
  // group's FIRST child rather than moving behind the group title. 殖利率 — the single most
  // intuitive split candidate — is NOT one of the three children: checked live and rejected, its
  // only cadence is EOD (a snapshot, not a filed periodic figure), so it has no TTM/Q/FY series to
  // build a metric page from at all. It stays answered on 總覽 itself until that's resolved
  // (request sent to analysis-ts); see METRIC_PAGES' own comment on the three that shipped instead.
  {
    label: '配股配息',
    children: [
      { label: '總覽', to: code => `/stock/${code}/dividend` },
      { label: '盈餘發放率', to: code => `/stock/${code}/dividend-payout-ratio` },
      { label: '股利保障倍數', to: code => `/stock/${code}/dividend-coverage-ratio` },
      { label: '股東總回饋率', to: code => `/stock/${code}/shareholder-yield` }
    ]
  },
  // 獲利能力 2026-09-20（「配股配息下面增加獲利能力。但是獲利能力裡面會有月營收 EPS 等等」）—
  // the first real use of this nav's own group depth. A group is not itself a link (see the rule
  // at the top of this file), so 獲利能力 has no page of its own; it is the shelf its metric pages
  // sit on. The name matches GET /metrics' own 獲利能力 category, which is where `eps` lives, so
  // the nav and the metric catalog agree without a second mapping.
  //
  // 月營收 was meant to be the next entry here. It is BLOCKED on data, not on work. Measured
  // 2026-09-20: GET /stocks/:symbol/monthly-revenue-history gives 2330 sixty months and
  // 2454/1101/2891/1216 an empty entries array. analysis-ts traced why, same day — that endpoint
  // is still wired to twse's DEV database, a 2026-09-07 stopgap for the 2330 demo data, so every
  // other company reads empty regardless of what exists upstream. Their PROD export does have
  // real data and does look like a live pipeline (2026-07: 296 companies, 2026-08: 292), but it
  // covers only ~300 of ~1,000 listed companies and goes back two months, so repointing it would
  // not be enough either. twse-ts has been asked whether PROD updates monthly, whether the gap
  // closes to the full market, and whether history gets backfilled.
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
