import { Filter, HomeFilled, Star } from '@element-plus/icons-vue'
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
  { key: 'watchlist', label: '自選股', icon: Star, to: '/watchlist' },
  { key: 'screener', label: '選股篩選', icon: Filter, to: '/screener' }
]
