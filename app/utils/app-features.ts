import { Collection, Filter, Money, Odometer, Star, OfficeBuilding, Trophy } from '@element-plus/icons-vue'
import type { Component } from 'vue'

export interface AppFeature {
  key: string
  label: string
  icon: Component
  to: string
}

// The app's top-level sections, rendered by AppFeatureMenu as an icon grid (mobile) or
// a collapsible sidebar (desktop). Add more entries here as new sections are built.
export const APP_FEATURES: AppFeature[] = [
  // Renamed 2026-09-16 per direct request ("現在的dashboard 改名叫做 calendar") — key/label/route
  // all updated together (dashboard.vue → calendar.vue); confirmed live that `key` isn't read as
  // a string literal anywhere else in the codebase (only used for Vue's own :key list-diffing),
  // so changing it is safe.
  { key: 'calendar', label: '配息月曆', icon: Odometer, to: '/calendar' },
  // 觀察清單／持股管理 kept adjacent on purpose — per explicit user direction that these are
  // two separate features (watchlist = stocks you're just tracking, holdings = stocks you
  // actually own with quantity/cost), not one list wearing two hats. Placing them next to
  // each other in the nav makes that split legible at a glance instead of burying holdings
  // behind unrelated entries (screener/大師指標) the way its old commented-out position did.
  { key: 'watchlist', label: '觀察清單', icon: Star, to: '/watchlist' },
  // WalletFilled → Money 2026-09-14, one of a 3-icon refresh across this file the same day (見
  // etf-zone/preferred-stocks 這兩筆的同批說明) — user picked from an AskUserQuestion icon
  // preview, no functional reasoning beyond "換一輪" (wanted a visual refresh).
  { key: 'holdings', label: '持股管理', icon: Money, to: '/holdings' },
  { key: 'screener', label: '普通股篩選', icon: Filter, to: '/screener' },
  // 個股總表 2026-09-19 (the SEO build) — /stock, every listed company grouped by 證交所類股, the
  // browse-by-list counterpart to the screener right above it.
  { key: 'stock-directory', label: '個股總表', icon: Collection, to: '/stock' },
  // { key: 'day-trading', label: '短線交易', icon: DataLine, to: '/day-trading' },
  // { key: 'dividend-backtest', label: '存股回測', icon: DataAnalysis, to: '/dividend-backtest' },
  { key: 'industries', label: '產業追蹤', icon: OfficeBuilding, to: '/industries' },
  // History: 2026-09-14 briefly deleted then restored per direct correction, migrated onto
  // oingg-playwright-py's real supply-chain tree (GET /industries/chain-tree) 2026-09-15. That
  // entire data source was hard-deleted 2026-09-20 by analysis-ts (commit a7489d65, a compliance
  // call on the underlying classification's data provenance — not a temporary outage; no
  // replacement endpoint) along with chain-clusters/chain-classification/peer-group. See
  // industries.vue's own comment: the page now falls back to GET /industries/securities-sectors,
  // the same still-live 證交所類股 catalog /stock's directory page uses.
  //
  // industry-value-chain entry REMOVED 2026-09-09, same day it was added — analysis-ts pulled
  // GET /industries/value-chain offline: the data source (ic.tpex.org.tw) requires written
  // permission before its content can be redistributed, which hasn't been obtained yet. This
  // isn't a technical outage, it's a licensing/compliance hold. UPDATE same day: the old
  // page/composable files (industry-value-chain.vue, useIndustryValueChain.ts) were then
  // deleted outright per direct request ("目前內容要打掉，我正在生成新的實踐方式") — the
  // feature itself is still planned, but the user is designing a different implementation
  // approach from scratch rather than resuming this one, so there's nothing to relink. Re-add
  // this nav entry once that new design is built.
  // Hidden from the sidebar 2026-09-14 per direct request ("特別股專區與ETF專區先隱藏") — the
  // page/route/icon history below is kept as-is, just commented out of this array like every
  // other temporarily-shelved entry in this file; re-add by uncommenting once ready to relaunch.
  // ShoppingCartFull → PieChart 2026-09-14, same icon-refresh round as 持股管理/特別股專區 above/
  // below — user picked from an AskUserQuestion icon preview ("換一輪").
  // { key: 'etf-zone', label: 'ETF 專區', icon: PieChart, to: '/etf-zone' },
  // { key: 'emerging-market', label: '興櫃專區', icon: Sunrise, to: '/emerging-market' },
  // Icon changed SEVEN times now: GoldMedal→Tickets (2026-09-08, once 徽章系統 started using
  // Medal), Tickets→IconCertificate the same day (a custom @iconify/vue component, since none of
  // Element Plus's own icons read as "特別股" at the time), IconCertificate→Postcard 2026-09-14
  // in a 3-icon refresh round (see 持股管理/ETF 專區 above, dropping back to a plain Element Plus
  // icon removed this file's only @iconify/vue dependency), Postcard→Rank the same day per direct
  // follow-up ("特別股專區可以幫我換成頒獎台嗎?" — Rank is Element Plus's own 3-tier award-stand
  // pictogram, no icon literally named "podium" exists), Rank→Lock the same day once Rank read as
  // too close to guru-indicators' own Medal (both award/ranking-themed, sitting in the same
  // sidebar) — a request for a "sparkles" icon from a different package (@primeicons/vue) was set
  // aside unverified in favor of Lock, Lock→Stamp the same day once guru-badges.ts's own 財務韌性
  // category tab (see that file's own GURU_CATEGORY_ICON) ALSO landed on Lock, then finally
  // Stamp→GoldMedal the same day per direct instruction ("特別股icon 用 GoldMedal") — back to the
  // very first icon this entry ever had, now safe to reuse since 徽章與指標 moved off Medal onto
  // Trophy in the same round (see that entry's own comment), so GoldMedal/Trophy/Medal no longer
  // collide with each other.
  // { key: 'preferred-stocks', label: '特別股專區', icon: GoldMedal, to: '/preferred-stocks' },
  // { key: 'ky-stocks', label: 'KY 股專區', icon: MapLocation, to: '/ky-stocks' },
  // { key: 'full-cash-delivery', label: '全額交割股專區', icon: Warning, to: '/full-cash-delivery' },
  // Un-commented 2026-09-08 — was reserved for an earlier, larger 大師-picker + editable radar
  // chart design (see project_guru_zone_radar_chart_idea memory), rolled back to a placeholder
  // shell 2026-09-03 per direct request. This slot now points at a different, smaller feature
  // instead (a static reference gallery of named academic scoring methodologies — see
  // guru-indicators.vue's own comment) — the radar-chart plan stays parked in that memory for a
  // future separate feature, not built here. Icon changed from IconHexagon (radar-chart visual
  // identity, no longer relevant) to Medal — distinct from GoldMedal (特別股專區) — since this
  // page now literally is a gallery of "badges." Label renamed 大師指標→徽章系統 same day per
  // direct follow-up, once the page itself was built and the "gallery of badges" framing (not
  // "guru indicators") was confirmed as the better description of what it actually is. Moved to
  // the LAST position in this array same day per direct follow-up ("徽章系統永遠放在sidebar最
  // 下面") — both AppFeatureMenu.vue/AppPinnedSidebar.vue just v-for this array in order, so
  // array position IS render position; keep this entry last if more entries are ever appended
  // above it. Renamed again 徽章系統→徽章與指標 2026-09-10 per direct request, once the stock
  // detail cards started mixing in real badges (with a pass/fail threshold) alongside plain
  // indicator charts with no threshold (e.g. Fama-French operating profitability) — "徽章系統"
  // implied everything here has a judged pass/fail, which is no longer true. Icon changed again
  // Medal→Trophy 2026-09-14 per direct instruction ("徽章iocn 用 Trophy"), same batch as
  // preferred-stocks' own Stamp→GoldMedal above — freed up Medal so 特別股專區 could safely move
  // back onto GoldMedal without the two colliding. Renamed again 徽章與指標→大師徽章 the same day
  // per direct follow-up ("徽章與指標功能，改為 大師徽章") once guru-indicators.vue itself dropped
  // its plain "其他指標" reference table ("不再顯示指標，因為表格模式取代了指標" — stock/[code].vue's
  // own 表格模式 already shows every real metric as plain numbers, so a second, symbol-less
  // reference table of the same metrics was redundant) — this page is genuinely just badges now,
  // so "指標" no longer belongs in the label either.
  { key: 'guru-indicators', label: '大師徽章', icon: Trophy, to: '/guru-indicators' }
]
