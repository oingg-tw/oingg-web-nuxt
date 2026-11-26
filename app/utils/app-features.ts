import { Calendar, Compass, Filter, GoldMedal, OfficeBuilding, PieChart, Star } from '@element-plus/icons-vue'
import { defineComponent, h, type Component } from 'vue'

// 圖示（2026-11-09，使用者從 https://claude.ai/artifact/2o2bYgjRtHUbEsVmatFztG 選的）：導覽、篩選、觀察清單、外觀設定、產業索引不變；
// 配息月曆換月曆、排行換頒獎台、持股管理換圓餅（投資組合）、大師徽章換寫著 1 的金牌。總經特區同一天稍晚換溫度計（使用者：「總經特區用溫度計
// 我認為很好」：景氣的冷熱，像景氣燈號的紅燈、藍燈）。全部是線條圖示，實心的放在一起會很突兀
// 頒獎台、溫度計 Element Plus 沒有，自己畫：線寬 1.6／24 跟 Element Plus 線條圖示的 64／1024 差不多。首頁便當盒格的排行也用頒獎台
const lineIcon = { xmlns: 'http://www.w3.org/2000/svg', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' } as const
export const Podium = defineComponent({
  name: 'PodiumIcon',
  render: () => h('svg', lineIcon, [
    h('path', { d: 'M8.5 21V10h7v11M2.5 21v-7h6M15.5 16.5h6V21M2 21h20' }),
    h('path', { d: 'M12 2l.76 1.95 2.09.12-1.61 1.33.52 2.03L12 6.3l-1.76 1.13.52-2.03-1.61-1.33 2.09-.12z' })
  ])
})
// 溫度計：玻璃管加底下的球，管裡一條水銀到球裡的實心圓點，右邊三道刻度
const Thermometer = defineComponent({
  name: 'ThermometerIcon',
  render: () => h('svg', lineIcon, [
    h('path', { d: 'M8 13.7V4.5a2.5 2.5 0 0 1 5 0v9.2a4.5 4.5 0 1 1-5 0z' }),
    h('path', { d: 'M10.5 15.5V8M16 5.5h3M16 9h3M16 12.5h3' }),
    h('circle', { cx: 10.5, cy: 17.4, r: 1.7, fill: 'currentColor', stroke: 'none' })
  ])
})

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
// 股東月曆：2026-09-16 由 dashboard 改名配息月曆；2026-11-25 改名股東月曆（使用者：「配息月曆改名股東月曆，這樣就可以把現金增資放到
// sidebar」），底下是配息的月曆、全年除權息，之後加現金增資。2026-07 的 620 筆除息全是普通股、2026-10 的 17 筆有 8 筆是 ETF
const CALENDAR: AppFeature = { key: 'calendar', label: '股東月曆', icon: Calendar, to: '/calendar' }
// 網站導覽：/sitemap 是給人看的 HTML 網站地圖（不是 sitemap.xml）。2026-09-20 放回第一位（「導覽順位要在Logo後面 也就是第一位」）
const SITEMAP: AppFeature = { key: 'sitemap', label: '網站導覽', icon: Compass, to: '/sitemap' }
// 股票篩選：普通股／特別股／ETF 三組篩選的入口（2026-10-15 起 ETF、特別股都收在 /screener 底下）
const SCREENER: AppFeature = { key: 'screener', label: '股票篩選', icon: Filter, to: '/screener/common', match: '/screener' }
const RANK: AppFeature = { key: 'rank', label: '排行', icon: Podium, to: '/rank' }
// 產業索引（2026-10-21 由產業追蹤改名：「追蹤」像是能關注某個產業，點進去其實是 34 個類股的索引頁）；/industry/{類股} 也算它底下
const INDUSTRIES: AppFeature = { key: 'industries', label: '產業索引', icon: OfficeBuilding, to: '/industries', match: '/industr' }
// 觀察清單與持股管理相鄰：使用者明確指示這是兩個功能（追蹤 vs 真的持有、有股數與成本），擺在一起讓這個區分一眼看得出來
const WATCHLIST: AppFeature = { key: 'watchlist', label: '觀察清單', icon: Star, to: '/watchlist' }
const HOLDINGS: AppFeature = { key: 'holdings', label: '持股管理', icon: PieChart, to: '/holdings' }
// 頁首沒放、只在手機圖示格的兩個（頁首 2026-09-19 收斂、09-22「總經特區從top nav移除」，桌機的入口在頁尾）。總經特區列在這裡而不只在
// sitemap：個股導覽永遠不會通到全市場頁，沒有這一筆手機只剩 /sitemap 一個入口
const MACRO: AppFeature = { key: 'macro', label: '總經特區', icon: Thermometer, to: '/macro' }
// 大師徽章：永遠放最後（「徽章系統永遠放在 sidebar 最下面」）
const GURU: AppFeature = { key: 'guru-indicators', label: '大師徽章', icon: GoldMedal, to: '/guru-indicators' }

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
  // 首頁的便當盒格用它找自己那一組（2026-11-02）
  key: 'learn' | 'find' | 'market' | 'dividends' | 'mine' | 'site'
  label: string
  links: SiteMapLink[]
}

const HOME_LINK: SiteMapLink = { label: '首頁', to: '/', description: '搜尋股票，從這裡進到各個功能' }
const APPEARANCE_LINK: SiteMapLink = { label: '外觀設定', to: '/appearance', description: '字型大小、深淺色、版面寬度、主題色與漲跌顏色' }
const PROFILE_LINK: SiteMapLink = { label: '帳號', to: '/account', description: '登入方式、方案與用量', requiresLogin: true }
const ACCESSIBILITY_LINK: SiteMapLink = { label: '無障礙聲明', to: '/accessibility', description: '本站的無障礙規範、檢測方式與回饋管道' }

// 本站相關：頁尾只放這一組（2026-10-22，使用者先要「網站地圖 請在footer也來一份」，看過之後改成「footer 只放 本站相關」「學習 塞進去
// 網站導覽」）。其餘分組只在網站導覽頁
export const ABOUT_SITE_LINKS: SiteMapLink[] = [HOME_LINK, SITEMAP, APPEARANCE_LINK, PROFILE_LINK, ACCESSIBILITY_LINK]

// 網站地圖（網站導覽頁 /sitemap）：用「我想…」分組（2026-10-22，使用者在方案頁選了 B；網站導覽「主要服務 a11y 與新手」——新手不用先知道
//「篩選」「月覽」是什麼），每一頁一句說明、要登入的標出來。網站導覽從每一頁的頁尾連過去，所以每個區塊的入口都要列在這裡，不然那一區
// 會變孤兒頁（2026-09-22 總經特區、09-23 產業索引就是這樣補上的；那時入口直接放頁尾）。學習排第一（使用者：「sitemap 學習 順序往上面放」）
export const SITE_MAP: SiteMapGroup[] = [
  {
    key: 'learn',
    label: '我想學會看這些數字',
    links: [
      { label: '新手專區', to: '/learn', description: '用一家真實公司的數字，一步一步看懂從營收到股利的每一個指標' },
      { ...MACRO, description: '景氣時鐘、股債風險溢酬與市場大事，看大環境走到哪裡' },
      { ...GURU, description: '知名投資人提出的選股門檻，看一家公司符合哪幾項' },
      { label: '部落格', to: '/blog', description: '財報指標與殖利率觀念的文章，用真實案例說明' }
    ]
  },
  {
    key: 'find',
    label: '我想找符合條件的股票',
    links: [
      { label: '普通股篩選', to: SCREENER_PATHS.common, description: '用 ROE、負債比率、殖利率等條件，篩出符合的上市櫃公司' },
      // 選股策略的入口只有這裡與「新增篩選」彈窗（2026-11-26，使用者：「這樣使用流程我認為比較合理」）；首頁那一格的連結列把它濾掉
      { label: '選股策略', to: STRATEGIES_PATH, description: '幾組寫明出處的選股條件，看每組篩什麼、今天有幾檔符合' },
      { label: '特別股篩選', to: SCREENER_PATHS.preferred, description: '比較特別股的股息率、最差殖利率與契約條件' },
      { label: 'ETF 篩選', to: SCREENER_PATHS.etf, description: '依規模、費用率、配息頻率比較 ETF' },
      { label: 'REITs 總覽', to: SCREENER_PATHS.reits, description: '比較 REITs 的淨值折溢價與近 12 個月分配率' },
      { ...RANK, description: '單一指標由高到低的全市場排行' },
      { ...INDUSTRIES, description: '證交所各類股的殖利率與股利成長' }
    ]
  },
  // 市場上發生什麼（2026-11-24，使用者選「做一頁」的兩頁）：全市場一覽，個股自己的在各股的頁面
  {
    key: 'market',
    label: '我想知道市場上發生什麼',
    links: [
      { label: '注意與處置股票', to: '/market/alerts', description: '交易所列為注意股票、處置股票的有哪些，處置期間與原因' },
      { label: '最新重大訊息', to: '/market/announcements', description: '上市櫃與興櫃公司最近發布的重大訊息，點開看公告全文' },
      // 現金增資（2026-11-26）：側欄在股東月曆底下，網站導覽放這一組不放「什麼時候配息」——現增要自己付錢，不是股利（使用者 11-25）
      { label: '現金增資', to: '/calendar/capital-increases', description: '接下來要現金增資除權的公司、繳款期間與認購價，以及初次上市櫃的公開申購' }
    ]
  },
  {
    key: 'dividends',
    label: '我想知道什麼時候配息',
    links: [
      { ...CALENDAR, description: '每一天有哪些股票除權息、哪天發放' },
      { label: '全年除權息', to: '/calendar/months', description: '一年裡哪幾個月除權息最多，每個月有哪些標的' }
    ]
  },
  {
    key: 'mine',
    label: '我想記下自己的股票',
    links: [
      { ...WATCHLIST, description: '追蹤關心的股票，欄位自己選', requiresLogin: true },
      { ...HOLDINGS, description: '記下買賣，看持股、配息、報酬與風險', requiresLogin: true }
    ]
  },
  { key: 'site', label: '我想調整網站或了解本站', links: [APPEARANCE_LINK, PROFILE_LINK, ACCESSIBILITY_LINK, HOME_LINK] }
]
