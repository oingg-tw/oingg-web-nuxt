import { DataAnalysis, Filter, GoldMedal, HomeFilled, OfficeBuilding, Present, Star, Sunrise, WalletFilled } from '@element-plus/icons-vue'
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
  { key: 'home', label: '首頁', icon: HomeFilled, to: '/' },
  { key: 'watchlist', label: '觀察清單', icon: Star, to: '/watchlist' },
  { key: 'holdings', label: '持股管理', icon: WalletFilled, to: '/holdings' },
  { key: 'dividend-backtest', label: '存股回測', icon: DataAnalysis, to: '/dividend-backtest' },
  { key: 'screener', label: '選股篩選', icon: Filter, to: '/screener' },
  { key: 'industries', label: '產業追蹤', icon: OfficeBuilding, to: '/industries' },
  { key: 'emerging-market', label: '興櫃專區', icon: Sunrise, to: '/emerging-market' },
  { key: 'preferred-stocks', label: '特別股專區', icon: GoldMedal, to: '/preferred-stocks' },
  { key: 'shareholder-gifts', label: '股東紀念品', icon: Present, to: '/shareholder-gifts' }
]
