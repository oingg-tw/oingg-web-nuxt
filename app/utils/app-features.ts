import { Compass, DataLine, Filter, Money, Odometer, Sort, Star, OfficeBuilding, Trophy } from '@element-plus/icons-vue'
import type { Component } from 'vue'

export interface AppFeature {
  key: string
  label: string
  icon: Component
  to: string
  // 這一項底下的頁面也算在它裡面（頁首下拉的分組按鈕據此標成目前所在）；不給就是 to 本身
  match?: string
}

export interface AppNavGroup {
  key: string
  label: string
  items: AppFeature[]
}

// 全站的第一層功能，頁首（AppNavMenu）與手機選單的圖示格（AppFeatureMenu）讀同一份（2026-10-21，使用者：「app-header-menu 我懷疑 這邊的樣式
// 也是不一致的 請重新設計」）。原本兩份各自維護：桌機有排行、手機沒有；手機有總經特區、大師徽章，順序也不同。
// 配息月曆：2026-09-16 由 dashboard 改名；2026-07 的 620 筆除息全是普通股、2026-10 的 17 筆有 8 筆是 ETF，月配型 ETF 是讀者最常追的
const CALENDAR: AppFeature = { key: 'calendar', label: '配息月曆', icon: Odometer, to: '/calendar' }
// 網站導覽：/sitemap 是給人看的 HTML 網站地圖（不是 sitemap.xml）。2026-09-20 放回第一位（「導覽順位要在Logo後面 也就是第一位」）
const SITEMAP: AppFeature = { key: 'sitemap', label: '網站導覽', icon: Compass, to: '/sitemap' }
// 股票篩選：普通股／特別股／ETF 三組篩選的入口（2026-10-15 起 ETF、特別股都收在 /screener 底下）
const SCREENER: AppFeature = { key: 'screener', label: '股票篩選', icon: Filter, to: '/screener/common', match: '/screener' }
// 排行的圖示是線條的上下箭頭（Sort）：其他圖示都是線條，Histogram 是實心的直條，放在一起就是唯一一個實心的
const RANK: AppFeature = { key: 'rank', label: '排行', icon: Sort, to: '/rank' }
// 產業索引（2026-10-21 由產業追蹤改名：「追蹤」像是能關注某個產業，點進去其實是 34 個類股的索引頁）；/industry/{類股} 也算它底下
const INDUSTRIES: AppFeature = { key: 'industries', label: '產業索引', icon: OfficeBuilding, to: '/industries', match: '/industr' }
// 觀察清單與持股管理相鄰：使用者明確指示這是兩個功能（追蹤 vs 真的持有、有股數與成本），擺在一起讓這個區分一眼看得出來
const WATCHLIST: AppFeature = { key: 'watchlist', label: '觀察清單', icon: Star, to: '/watchlist' }
const HOLDINGS: AppFeature = { key: 'holdings', label: '持股管理', icon: Money, to: '/holdings' }
// 頁首沒放、只在手機圖示格的兩個（頁首 2026-09-19 收斂、09-22「總經特區從top nav移除」，桌機的入口在頁尾）。總經特區列在這裡而不只在
// sitemap：個股導覽永遠不會通到全市場頁，沒有這一筆手機只剩 /sitemap 一個入口
const MACRO: AppFeature = { key: 'macro', label: '總經特區', icon: DataLine, to: '/macro' }
// 大師徽章：永遠放最後（「徽章系統永遠放在 sidebar 最下面」）
const GURU: AppFeature = { key: 'guru-indicators', label: '大師徽章', icon: Trophy, to: '/guru-indicators' }

// 頁首的導覽：照這個順序；有 items 的是下拉分組（2026-09-20「找股票應該要與篩選排行合併成下拉選單」，2026-10-21 名稱對齊點進去的內容）
export const APP_NAV: (AppFeature | AppNavGroup)[] = [
  SITEMAP,
  CALENDAR,
  { key: 'find', label: '找股票', items: [SCREENER, RANK, INDUSTRIES] },
  { key: 'mine', label: '我的股票', items: [WATCHLIST, HOLDINGS] }
]

export const isNavGroup = (entry: AppFeature | AppNavGroup): entry is AppNavGroup => 'items' in entry

// 手機圖示格：頁首的全部攤平、同一個順序，再接頁首沒放的。外觀設定由 AppFeatureMenu 自己接在最後。
// ETF 專區與特別股專區 2026-09-14 依指示隱藏（2026-10-15 起收在股票篩選底下）
export const APP_FEATURES: AppFeature[] = [
  ...APP_NAV.flatMap(entry => (isNavGroup(entry) ? entry.items : [entry])),
  MACRO,
  GURU
]

export interface SiteMapGroup {
  label: string
  links: { label: string; to: string }[]
}

// 本站相關：頁尾只放這一組（2026-10-22，使用者先要「網站地圖 請在footer也來一份」，看過之後改成「footer 只放 本站相關」「學習 塞進去
// 網站導覽」）。其餘分組只在網站導覽頁
export const ABOUT_SITE_LINKS: SiteMapGroup['links'] = [{ label: '首頁', to: '/' }, SITEMAP, { label: '外觀設定', to: '/appearance' }, { label: '個人資料設定', to: '/profile' }, { label: '無障礙聲明', to: '/accessibility' }]

// 網站地圖：網站導覽頁（/sitemap）畫全部分組，頁尾畫最後的「本站」那組——共用資料不共用元件（兩邊版型不同）。原本兩邊各寫一份，
// /sitemap 漏了除權息月覽、排行與普通股篩選各列了兩次。網站導覽從每一頁的頁尾連過去，所以每個區塊的入口都要列在這裡，不然那一區
// 會變孤兒頁（2026-09-22 總經特區、09-23 產業索引就是這樣補上的；那時入口直接放頁尾）
// 學習排第一（2026-10-22，使用者：「sitemap 學習 順序往上面放」）
export const SITE_MAP: SiteMapGroup[] = [
  { label: '學習', links: [{ label: '新手專區', to: '/learn' }, MACRO, GURU, { label: '部落格', to: '/blog' }] },
  { label: '找股票', links: [{ label: '普通股篩選', to: SCREENER_PATHS.common }, { label: '特別股篩選', to: SCREENER_PATHS.preferred }, { label: 'ETF 篩選', to: SCREENER_PATHS.etf }, RANK, INDUSTRIES] },
  { label: '配息', links: [CALENDAR, { label: '除權息月覽', to: '/calendar/months' }] },
  { label: '我的股票', links: [WATCHLIST, HOLDINGS] },
  { label: '本站', links: ABOUT_SITE_LINKS }
]
