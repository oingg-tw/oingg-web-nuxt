import { Collection, Compass, DataLine, Filter, Money, Odometer, Star, OfficeBuilding, Trophy } from '@element-plus/icons-vue'
import type { Component } from 'vue'

export interface AppFeature {
  key: string
  label: string
  icon: Component
  to: string
}

// 全站的第一層功能，AppFeatureMenu 照陣列順序渲染（手機是圖示格、桌機是側邊欄）
export const APP_FEATURES: AppFeature[] = [
  // dashboard 2026-09-16 改名 calendar（使用者指示）。2026-09-23 暫緩過又當天放回（「ETF 可以用」）：2026-07 的 620 筆除息全是
  // 普通股、2026-10 的 17 筆有 8 筆是 ETF，兩者除息季節錯開，月配型 ETF 又是讀者最常追的。
  { key: 'calendar', label: '配息月曆', icon: Odometer, to: '/calendar' },
  // 觀察清單與持股管理相鄰：使用者明確指示這是兩個功能（追蹤 vs 真的持有、有股數與成本），擺在一起讓這個區分一眼看得出來
  { key: 'watchlist', label: '觀察清單', icon: Star, to: '/watchlist' },
  // WalletFilled → Money（2026-09-14 換一輪 icon，使用者從預覽挑的）
  { key: 'holdings', label: '持股管理', icon: Money, to: '/holdings' },
  { key: 'screener', label: '普通股篩選', icon: Filter, to: '/screener' },
  // 個股總表 2026-09-19 (the SEO build) — /stock, every listed company grouped by 證交所類股, the
  // browse-by-list counterpart to the screener right above it.
  { key: 'stock-directory', label: '個股總表', icon: Collection, to: '/stock' },
  { key: 'industries', label: '產業追蹤', icon: OfficeBuilding, to: '/industries' },
  // 總經特區 2026-09-21（當時叫大盤與升降息，在 /rate-cycle），2026-09-22 成立特區後改指 /macro。列在這裡而不只在 sitemap：
  // 個股導覽永遠不會通到全市場頁，沒有這一筆它只剩 /sitemap 一個入口，check-click-depth 量到的會是孤兒。
  { key: 'macro', label: '總經特區', icon: DataLine, to: '/macro' },
  // 產業追蹤的資料來源變過：供應鏈樹（2026-09-15）被 analysis-ts 2026-09-20 整個刪除（合規考量，沒有替代端點），頁面退回證交所類股；
  // 產業價值鏈 2026-09-09 加入當天下架（ic.tpex.org.tw 需書面授權才能轉載，檔案已刪，使用者另案重做）。
  // ETF 專區與特別股專區 2026-09-14 依指示從側邊欄隱藏（頁面都在，入口在首頁／頁尾／網站導覽），要重新上架就加回：
  // { key: 'etf-zone', label: 'ETF 專區', icon: PieChart, to: '/etf-zone' }
  // { key: 'preferred-stocks', label: '特別股專區', icon: GoldMedal, to: '/preferred-stocks' }（icon 換過七次，最後定 GoldMedal）
  // 網站導覽 2026-09-20 放回側邊欄（使用者：「網站導覽要加回來喔」）：/sitemap 是給人看的 HTML 網站地圖（不是 sitemap.xml），
  // 2026-09-17 清空側邊欄後只剩頁尾一個入口。
  { key: 'sitemap', label: '網站導覽', icon: Compass, to: '/sitemap' },
  // 大師徽章：名稱 大師指標→徽章系統→徽章與指標→大師徽章（2026-09-14 定案），icon 最後定 Trophy（把 Medal 讓給特別股）。永遠放陣列
  // 最後（「徽章系統永遠放在 sidebar 最下面」）——AppFeatureMenu 照陣列順序 v-for。
  { key: 'guru-indicators', label: '大師徽章', icon: Trophy, to: '/guru-indicators' }
]
