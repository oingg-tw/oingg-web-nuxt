import type { Component } from 'vue'
import { Checked, Coin, Document, Lock, Opportunity, PriceTag, Promotion, TrendCharts } from '@element-plus/icons-vue'

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
  // Set on the TOP-LEVEL rows only（2026-09-21,「Sidebar 最上層母項目 希望可以加上icon」）— a nested
  // row simply leaves it undefined and StockPageNavNode renders nothing, so "top level only" is
  // expressed by where the value is set rather than by a depth prop threaded through the recursion.
  //
  // 亮點與風險 gets one too although it is a LEAF, not a 母項目: it is the only top-level row that
  // isn't a group, and leaving it as the one unindented row in a column of five icons would read
  // as a rendering fault rather than a distinction.
  //
  // Purely decorative — every row's own text label is right beside it, so StockPageNavNode marks
  // these aria-hidden and the link's accessible name is unchanged.
  icon?: Component
}

export const STOCK_NAV_ITEMS: StockNavNode[] = [
  { label: '亮點與風險', icon: Opportunity, to: code => `/stock/${code}` },
  // 配股配息 became a group 2026-09-21（「sidebar 配股配息底下要拆子項目，就像是獲利能力底下拆 EPS
  // 出來一樣」）— same rule as 財務報表/獲利能力 above/below: the parent still has a real page of its
  // own (five question sections: 現金殖利率/近幾季/歷年/股息來源/除權息日期), so it stays reachable
  // as the group's FIRST child rather than moving behind the group title. 殖利率 — the single most
  // intuitive split candidate — is NOT one of the three children: checked live and rejected, its
  // only cadence is EOD (a snapshot, not a filed periodic figure), so it has no TTM/Q/FY series to
  // build a metric page from at all. It stays answered on the group's own first child until that's
  // resolved (request sent to analysis-ts); see METRIC_PAGES' own comment on the three that shipped
  // instead.
  {
    label: '配股配息',
    icon: Coin,
    children: [
      // 總覽→現金殖利率 2026-09-21（「也就是把sidebar的總覽改名為 現金殖利率」）— matches
      // dividend.vue's own scope-down the same day: that page dropped its 總覽 framing to answer
      // just 現金殖利率 specifically (dividendPerShare/dividendPayoutRatio/shareholderYield/
      // consecutiveDividendYears moved out of its lead sentence; the aggregate "cash + buyback"
      // view belongs on 股東總回饋率 now).
      { label: '現金殖利率', to: code => `/stock/${code}/dividend` },
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
    icon: TrendCharts,
    children: [
      { label: 'EPS', to: code => `/stock/${code}/eps` },
      // ROE 2026-09-21（「sidebar獲利能力那邊要新增ROE」）— points at the EXISTING badge page
      // (/stock/:code/roe, BADGE_PAGES in hub-slugs.ts, shipped 2026-09-20), not a new registry
      // entry: the page already exists and was only reachable via the badge table/dialog links
      // until now, not the nav tree. Confirmed roe's own GET /metrics category really is 獲利能力
      // (not assumed from the label) before adding it here, same "nav agrees with the catalog"
      // rule this group's own comment states above.
      { label: 'ROE', to: code => `/stock/${code}/roe` },
      // 財報三率 2026-09-21（「sidebar 獲利能力 加上 財報三率」）— the first THREE-level branch this
      // tree actually uses（獲利能力 → 財報三率 → 毛利率）, which is what the 2026-09-20 el-menu
      // rewrite was built for. Kept as one group rather than three flat siblings because 三率 is a
      // single idea in this market's vocabulary（三率三升）: the three rates are read against each
      // other down the income statement, not one at a time.
      //
      // Order is the income statement's own, top to bottom（營收 → 毛利 → 營業利益 → 稅後淨利）, not
      // alphabetical and not "existing pages first" — that descent IS the concept.
      //
      // The three destinations deliberately come from DIFFERENT registries, because the metrics
      // themselves differ (all three checked live against GET /metrics, per this group's own
      // "nav agrees with the catalog" rule above — and all three really are in its 獲利能力
      // category): 毛利率/稅後淨利率 have real badge definitions and are BADGE_PAGES, 營業利益率 has
      // none and is a METRIC_PAGES entry. 毛利率 needed no new page at all — /gross-margin has
      // existed since 2026-09-20 and was only reachable from the badge table until now, the same
      // thing that was true of ROE above.
      //
      // 營業利益率's page went live a few hours ahead of its own catalog copy and carried `noindex`
      // until analysis-ts wrote it (face95d8, same day — see METRIC_PAGES' own comment on that
      // entry). It was listed here from the start regardless: a backend text gap was never a reason
      // to show a 三率 group with two rates in it, and the DATA behind all three was equally real
      // throughout (TTM+Q, 20 periods on 2330).
      {
        label: '財報三率',
        children: [
          // 三率的關係 2026-09-21（「希望有頁面同時解釋 三率 的 關係」）— the group's own page, and
          // therefore its FIRST child under a descriptive label, exactly the rule 配股配息 and
          // 財務報表 already follow (see the top of this file). It is the only page that shows the
          // three rates TOGETHER and spends the gaps between them（推銷管理費用率／研發費用率／
          // 業外損益與所得稅）; the three below each answer about one rate on its own.
          { label: '三率的關係', to: code => `/stock/${code}/margins` },
          { label: '毛利率', to: code => `/stock/${code}/gross-margin` },
          { label: '營業利益率', to: code => `/stock/${code}/operating-margin` },
          { label: '稅後淨利率', to: code => `/stock/${code}/net-profit-margin` }
        ]
      }
    ]
  },
  // 市場估值 2026-09-21（「Sidbear 下面 加開 市場估值，裡面就放 PER PBR PSR等等」）. Sits after
  // 獲利能力 deliberately: the three groups above answer what the COMPANY earned and paid out, and
  // this one is the first that depends on the share PRICE — which is also why it is the group most
  // exposed to the catalog's own EOD-only wall（see METRIC_PAGES' own note on why these point at
  // peRatio/pbRatio rather than the exchange's published exchangePeRatio/exchangePbRatio）.
  //
  // The group's name follows the user's wording; GET /metrics calls this category 市場評價. That is
  // a label difference only — every member below really is in that one catalog category, which is
  // the part the「nav agrees with the catalog」rule above is actually about, and no second mapping
  // exists to drift.
  //
  // 葛拉漢倍數 and PEG were listed here for a few hours the same day and REMOVED FROM THE NAV by
  // direct instruction（「SIDEBAR的選項希望更忠於財報 避免葛拉漢數字 這種 複合運算 徽章性質遠勝於
  // 指標性質的」）. The test that instruction sets, applied to each candidate rather than only to
  // the one it named:
  //   * 葛拉漢倍數 = PER × PBR, tested against 22.5 — a ratio OF two ratios, existing only to be
  //     compared with a published rule. Badge through and through.
  //   * PEG = PER ÷ 盈餘成長率, tested against 1 — the same construct shape, a derived quantity
  //     divided by another derived quantity.
  //   * PER / PBR / PSR are each 股價（or 市值）÷ ONE filed figure. One step from the statement,
  //     quoted as metrics in their own right long before any threshold is attached. They stay.
  // The PAGES are untouched and still live（/graham-number and /peg still render, still carry their
  // canonicals and still sit in the sitemap）— this is the same nav-entry-out/route-published split
  // 指標歷史 below and ETF／特別股專區 already use. Neither is orphaned: the badge table on
  // /stock/{code} links every badge row that has a page, via findBadgePageByMetric().
  {
    label: '市場估值',
    icon: PriceTag,
    children: [
      { label: 'PER', to: code => `/stock/${code}/pe-ratio` },
      { label: 'PBR', to: code => `/stock/${code}/pb-ratio` },
      { label: 'PSR', to: code => `/stock/${code}/psr` }
    ]
  },
  // 安全韌性 2026-09-21（「sidebar 底下增加此 分類 底下要放入 流速動比 長債比例 等等的 指標」）.
  //
  // The NAME came from「財務韌性 改叫安全韌性」, and the rename was done where the string is OWNED
  // rather than here: 財務韌性 was a backend value in GET /metrics' own category name and in
  // GET /stocks/:symbol/badges' categoryDisplayName. analysis-ts renamed both the same day
  //（8f7b4ddd, categoryKey `resilience` untouched）and bff-ts re-synced, so this label and the
  // catalog AGREE — no second mapping, unlike 市場估值 above which still differs from 市場評價.
  //
  // A third surface was reported alongside those two and turned out NOT to be one: GET /screener/
  // templates also has a template literally named 財務韌性, which SCREENER_TEMPLATE_SLUGS is keyed
  // by, so renaming it would have silently dropped that link the way 股利穩健→股利連續性 did on
  // 2026-09-20. bff-ts clarified it is a same-name coincidence in their own PresetTemplate table,
  // not a downstream of the category — it is still called 財務韌性 today and that key is still
  // correct. If the template is ever renamed too, THAT is when the key needs changing (slug stays
  // financial-resilience, a live sitemap URL).
  //
  // Membership follows the same「更忠於財報」test as 市場估值 above, applied to all 25 metrics in
  // that category: out go the four regression SCORES（Altman Z / Z″ / Ohlson O / Zmijewski）as
  // composite badge constructs, out go the five bank-only capital ratios（不適用 on ~95% of
  // symbols）, and out go every candidate whose series is one period deep — see METRIC_PAGES' own
  // note, which is also why 長債比例 has no entry here despite being named in the request.
  // What is left is five one-step statement ratios: two liquidity, two leverage, one coverage.
  {
    label: '安全韌性',
    icon: Lock,
    children: [
      // 安全韌性的組成 2026-09-21（「只有單一一個指標呈現好像沒甚麼意思」→「那先做安全韌性」）—
      // the group's own page, and therefore its FIRST child, the same rule 財報三率／配股配息／
      // 財務報表 follow. It is the only page that shows these ratios TOGETHER and spends the gaps
      // between them（存貨、應收帳款等其他速動資產）, plus the 負債＋權益＝100% split; the five
      // below each answer about one ratio on its own.
      { label: '安全韌性的組成', to: code => `/stock/${code}/solvency` },
      { label: '流動比率', to: code => `/stock/${code}/current-ratio` },
      { label: '速動比率', to: code => `/stock/${code}/quick-ratio` },
      { label: '負債比率', to: code => `/stock/${code}/debt-ratio` },
      { label: '有息負債權益比', to: code => `/stock/${code}/interest-bearing-debt-to-equity` },
      { label: '長期負債對淨流動資產比', to: code => `/stock/${code}/long-term-debt-to-net-current-assets` },
      { label: '利息保障倍數', to: code => `/stock/${code}/interest-coverage` }
    ]
  },
  // 獲利品質 2026-09-21（「獲利品質需要跟獲利能力分開做嗎？在sidebar上面」）— yes, separate, and
  // placed directly after 獲利能力 because the pair reads as one question split in two: 獲利能力
  // asks how MUCH profit a company made, 獲利品質 asks whether that profit is real — backed by cash
  // rather than by accruals. For this app's own audience that second question is arguably the more
  // useful of the two, which is why it gets its own group rather than a few extra rows on the first.
  //
  // Name matches GET /metrics' own 獲利品質 category with no rename needed. Membership picked from
  // its 15 metrics by the standing「更忠於財報，避免複合運算、徽章性質遠勝指標性質」test — see
  // METRIC_PAGES' own note for what was excluded and why.
  //
  // 淨利 → 營業現金流 → 自由現金流 is a real chain here, the same shape 財報三率 and 安全韌性 each
  // got a 關係頁 for. Not built yet: the group's metric pages come first, the way both of those did.
  {
    label: '獲利品質',
    icon: Checked,
    children: [
      { label: '營業現金流對淨利比', to: code => `/stock/${code}/ocf-to-net-income` },
      { label: 'FCF 轉換率', to: code => `/stock/${code}/fcf-conversion-rate` },
      { label: 'OCF 利潤率', to: code => `/stock/${code}/ocf-margin` },
      { label: '應計項目比率', to: code => `/stock/${code}/accruals-ratio` }
      // 連續獲利年數 removed with its registry entry 2026-09-22 — its series doesn't behave
      // annually（see hub-slugs.ts for the measurements）.
    ]
  },
  // 成長動能 2026-09-21（「sidebar 加一個成長動能，裡面放 淨值成長 投資支出 等等」）. Last of the
  // metric groups, after 安全韌性: the four before it describe what the company earned, what it is
  // priced at and whether it can pay its bills — all about the period just filed — while this one
  // is the only group about the DIRECTION between periods.
  //
  // Name matches GET /metrics' own 成長動能 category with no rename needed, unlike 市場估值 and
  // 安全韌性 above. Four of the five members come from it; 資本支出佔營收比 is the exception and
  // METRIC_PAGES' own note says why.
  //
  // 淨值成長 and 投資支出 are the two the request named: equityGrowthRate is literally the
  // catalog's 淨值成長年增率, and 投資支出 is capexToRevenue — 資本支出 on the cash-flow statement
  // as a share of revenue, which is the filed form of that idea. 研發費用率 joins them as the other
  // spend-for-the-future line, and is the one metric this group shares with /margins' own
  // decomposition.
  {
    label: '成長動能',
    icon: Promotion,
    children: [
      { label: '營收成長年增率', to: code => `/stock/${code}/revenue-growth` },
      { label: '淨利成長年增率', to: code => `/stock/${code}/net-income-growth` },
      { label: '淨值成長年增率', to: code => `/stock/${code}/equity-growth` },
      { label: '資本支出佔營收比', to: code => `/stock/${code}/capex-to-revenue` },
      { label: '研發費用率', to: code => `/stock/${code}/rd-intensity` }
      // 盈餘創新高比率 removed with its registry entry 2026-09-22 — analysis-ts retired the badge
      // it was built on, and this group has no badge page any more.
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
    icon: Document,
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
