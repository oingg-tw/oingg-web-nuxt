import { MACRO_PAGES, macroPagePath } from '#shared/utils/macro-pages'

// 總經特區 的側邊欄（2026-09-22,「可以成立 總經特區 了，Sidebar 就放不同指標跟大盤比較」）.
//
// Derived from MACRO_PAGES rather than hand-listed, so a page can never exist without a nav entry
// or the other way round — the same "one registry decides what exists" rule hub-slugs.ts holds for
// every other page family here.
//
// 政策利率與大盤 is prepended by hand because it is the one member with its own route file: its
// shape is discrete decision events, not a continuous series, so it is deliberately absent from
// MACRO_PAGES (see that file's own comment). It leads the list because it was the zone's first
// page and because a policy rate is the most directly market-facing of the seven.
//
// This zone spent a day as a single parked plan: all six series existed in gov-ts's export schema
// with no endpoint, and the entries here were comments recording what each was waiting on. They
// were un-parked the moment analysis-ts (50aeae18) and bff-ts (7a17266) made them reachable —
// which is what the parking was for.
export interface MacroNavNode {
  label: string
  to: string
}

// 市場階段 is prepended by hand for the same reason 政策利率 is: it has its own route file, because
// its content is discrete dated events rather than a continuous series, so it is deliberately
// absent from MACRO_PAGES. It leads the list because it is the one page here that needs no prior
// knowledge of any indicator — a reader who has lived through 921 and COVID can start there.
export const MACRO_NAV_ITEMS: MacroNavNode[] = [
  // 市場階段 right after 大事件 rather than beside the indicators: the two are a pair（「市場階段」跟
  // 「宣告事件」分開）— the first is what the world declared, the second is what the index itself
  // did — and reading them adjacent is the point of keeping them on separate pages.
  { label: '市場階段', to: '/macro/market-phases' },
  { label: '政策利率', to: '/macro/policy-rate' },
  ...MACRO_PAGES.map(page => ({ label: page.topic, to: macroPagePath(page.slug) }))
]
