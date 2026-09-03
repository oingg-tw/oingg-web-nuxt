import { DataAnalysis, DataLine, Filter, GoldMedal, MapLocation, Odometer, OfficeBuilding, ShoppingCartFull, Star, Sunrise, WalletFilled, Warning } from '@element-plus/icons-vue'
import type { Component } from 'vue'
// Not from '@element-plus/icons-vue' — no hexagon glyph exists in that set (checked its full
// icon list). Imported directly by path rather than relying on Nuxt's auto-registered global
// component name (would be `SharedIconHexagon`, per components/shared/'s own naming
// convention) since this file is a plain .ts module, not a Vue SFC — auto-import only
// resolves inside templates/script setup blocks, not here.
import IconHexagon from '~/components/shared/IconHexagon.vue'

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
  { key: 'watchlist', label: '觀察清單', icon: Star, to: '/watchlist' },
  { key: 'screener', label: '上市櫃篩選', icon: Filter, to: '/screener' },
  { key: 'guru-tutorials', label: '大師指標', icon: IconHexagon, to: '/guru-tutorials' },
  // { key: 'day-trading', label: '短線交易', icon: DataLine, to: '/day-trading' },
  // { key: 'holdings', label: '持股管理', icon: WalletFilled, to: '/holdings' },
  // { key: 'dividend-backtest', label: '存股回測', icon: DataAnalysis, to: '/dividend-backtest' },
  // { key: 'industries', label: '產業追蹤', icon: OfficeBuilding, to: '/industries' },
  { key: 'etf-zone', label: 'ETF 專區', icon: ShoppingCartFull, to: '/etf-zone' },
  // { key: 'emerging-market', label: '興櫃專區', icon: Sunrise, to: '/emerging-market' },
  { key: 'preferred-stocks', label: '特別股專區', icon: GoldMedal, to: '/preferred-stocks' },
  // { key: 'ky-stocks', label: 'KY 股專區', icon: MapLocation, to: '/ky-stocks' },
  // { key: 'full-cash-delivery', label: '全額交割股專區', icon: Warning, to: '/full-cash-delivery' }
]
