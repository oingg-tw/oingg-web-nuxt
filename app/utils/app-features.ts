import { Filter, GoldMedal, Medal, Odometer, ShoppingCartFull, Star, WalletFilled, OfficeBuilding } from '@element-plus/icons-vue'
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
  { key: 'home', label: '總覽', icon: Odometer, to: '/dashboard' },
  // 觀察清單／持股管理 kept adjacent on purpose — per explicit user direction that these are
  // two separate features (watchlist = stocks you're just tracking, holdings = stocks you
  // actually own with quantity/cost), not one list wearing two hats. Placing them next to
  // each other in the nav makes that split legible at a glance instead of burying holdings
  // behind unrelated entries (screener/大師指標) the way its old commented-out position did.
  { key: 'watchlist', label: '觀察清單', icon: Star, to: '/watchlist' },
  { key: 'holdings', label: '持股管理', icon: WalletFilled, to: '/holdings' },
  { key: 'screener', label: '上市櫃篩選', icon: Filter, to: '/screener' },
  // { key: 'day-trading', label: '短線交易', icon: DataLine, to: '/day-trading' },
  // { key: 'dividend-backtest', label: '存股回測', icon: DataAnalysis, to: '/dividend-backtest' },
  { key: 'industries', label: '產業追蹤', icon: OfficeBuilding, to: '/industries' },
  { key: 'etf-zone', label: 'ETF 專區', icon: ShoppingCartFull, to: '/etf-zone' },
  // { key: 'emerging-market', label: '興櫃專區', icon: Sunrise, to: '/emerging-market' },
  { key: 'preferred-stocks', label: '特別股專區', icon: GoldMedal, to: '/preferred-stocks' },
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
  // above it.
  { key: 'guru-indicators', label: '徽章系統', icon: Medal, to: '/guru-indicators' }
]
