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

export interface SiteMapLink {
  label: string
  to: string
  // 網站導覽頁每一頁一句「這一頁能做什麼」（給新手，2026-10-22）；頁尾只用名稱
  description?: string
  requiresLogin?: boolean
}

export interface SiteMapGroup {
  label: string
  links: SiteMapLink[]
}

const HOME_LINK: SiteMapLink = { label: '首頁', to: '/', description: '搜尋股票，從這裡進到各個功能' }
const APPEARANCE_LINK: SiteMapLink = { label: '外觀設定', to: '/appearance', description: '字型大小、深淺色、版面寬度、主題色與漲跌顏色' }
const PROFILE_LINK: SiteMapLink = { label: '個人資料設定', to: '/profile', description: '帳號與登入方式', requiresLogin: true }
const ACCESSIBILITY_LINK: SiteMapLink = { label: '無障礙聲明', to: '/accessibility', description: '本站的無障礙規範、檢測方式與回饋管道' }
const CHANGELOG_LINK: SiteMapLink = { label: '更新紀錄', to: '/changelog', description: '本站最近改了什麼，以及進行中的維護公告' }

// 本站相關：頁尾只放這一組（2026-10-22，使用者先要「網站地圖 請在footer也來一份」，看過之後改成「footer 只放 本站相關」「學習 塞進去
// 網站導覽」）。其餘分組只在網站導覽頁
export const ABOUT_SITE_LINKS: SiteMapLink[] = [HOME_LINK, SITEMAP, APPEARANCE_LINK, PROFILE_LINK, ACCESSIBILITY_LINK, CHANGELOG_LINK]

// 網站地圖（網站導覽頁 /sitemap）：用「我想…」分組（2026-10-22，使用者在方案頁選了 B；網站導覽「主要服務 a11y 與新手」——新手不用先知道
//「篩選」「月覽」是什麼），每一頁一句說明、要登入的標出來。網站導覽從每一頁的頁尾連過去，所以每個區塊的入口都要列在這裡，不然那一區
// 會變孤兒頁（2026-09-22 總經特區、09-23 產業索引就是這樣補上的；那時入口直接放頁尾）。學習排第一（使用者：「sitemap 學習 順序往上面放」）
export const SITE_MAP: SiteMapGroup[] = [
  {
    label: '我想學會看這些數字',
    links: [
      { label: '新手專區', to: '/learn', description: '用一家真實公司的數字，一步一步看懂從營收到股利的每一個指標' },
      { ...MACRO, description: '景氣時鐘、股債風險溢酬與市場大事，看大環境走到哪裡' },
      { ...GURU, description: '知名投資人提出的選股門檻，看一家公司符合哪幾項' },
      { label: '部落格', to: '/blog', description: '財報指標與殖利率觀念的文章，用真實案例說明' }
    ]
  },
  {
    label: '我想找符合條件的股票',
    links: [
      { label: '普通股篩選', to: SCREENER_PATHS.common, description: '用 ROE、負債比率、殖利率等條件，篩出符合的上市櫃公司' },
      { label: '特別股篩選', to: SCREENER_PATHS.preferred, description: '比較特別股的股息率、最差殖利率與契約條件' },
      { label: 'ETF 篩選', to: SCREENER_PATHS.etf, description: '依規模、費用率、配息頻率比較 ETF' },
      { ...RANK, description: '單一指標由高到低的全市場排行' },
      { ...INDUSTRIES, description: '證交所各類股的家數、殖利率與公司名單' }
    ]
  },
  {
    label: '我想知道什麼時候配息',
    links: [
      { ...CALENDAR, description: '每一天有哪些股票除權息、哪天發放' },
      { label: '除權息月覽', to: '/calendar/months', description: '一年裡哪幾個月除權息最多，每個月有哪些標的' }
    ]
  },
  {
    label: '我想記下自己的股票',
    links: [
      { ...WATCHLIST, description: '追蹤關心的股票，欄位自己選', requiresLogin: true },
      { ...HOLDINGS, description: '記下買賣，看持股、配息、報酬與風險', requiresLogin: true }
    ]
  },
  { label: '我想調整網站或了解本站', links: [APPEARANCE_LINK, PROFILE_LINK, ACCESSIBILITY_LINK, CHANGELOG_LINK, HOME_LINK] }
]
