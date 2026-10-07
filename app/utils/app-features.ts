import { Collection, Compass, DataLine, Filter, Money, Odometer, Star, OfficeBuilding, Trophy } from '@element-plus/icons-vue'
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
  // 配息月曆 — 暫緩過又回來（2026-09-23）。先被拿掉（「配息月曆這條線要暫緩 從功能中拿掉」），當天
  // 又放回來，理由是「ETF可以用」：這條線的價值不在普通股。量過的證據——2026-07 有 620 筆除息事件
  // 全是普通股、零 ETF，而 2026-10 只有 17 筆卻有 8 筆是 ETF。兩者的除息季節完全錯開，月配型 ETF
  // 又是這個站的讀者最常追的，所以普通股歷史還薄並不折損月曆對 ETF 持有人的用處。
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
  { key: 'industries', label: '產業追蹤', icon: OfficeBuilding, to: '/industries' },
  // 總經特區 2026-09-21（as 大盤與升降息 at /rate-cycle）, renamed and re-pointed 2026-09-22 when
  // the zone was called for（「可以成立 總經特區 了，Sidebar 就放不同指標跟大盤比較」）. Listed
  // here rather than only in the sitemap because nothing in the per-stock navigation would ever
  // lead to a market-wide page — without this entry it would be reachable only from /sitemap and
  // check-click-depth would be measuring an orphan.
  //
  // Points at /macro since 2026-09-22 — the re-point this entry's own note asked for once the zone
  // had enough members（it has seven）.
  { key: 'macro', label: '總經特區', icon: DataLine, to: '/macro' },
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
  // Icon changed SEVEN times now: GoldMedal→Tickets (2026-09-08, once 徽章系統 started using
  // Medal), Tickets→IconCertificate the same day (a custom @iconify/vue component, since none of
  // Element Plus's own icons read as "特別股" at the time), IconCertificate→Postcard 2026-09-14
  // in a 3-icon refresh round (see 持股管理/ETF 專區 above, dropping back to a plain Element Plus
  // icon removed this file's only @iconify/vue dependency), Postcard→Rank the same day per direct
  // follow-up ("特別股專區可以幫我換成頒獎台嗎?" — Rank is Element Plus's own 3-tier award-stand
  // pictogram, no icon literally named "podium" exists), Rank→Lock the same day once Rank read as
  // too close to guru-indicators' own Medal (both award/ranking-themed, sitting in the same
  // sidebar) — a request for a "sparkles" icon from a different package (@primeicons/vue) was set
  // aside unverified in favor of Lock, Lock→Stamp the same day once guru-badges.ts's own 安全韌性（then 財務韌性）
  // category tab (see that file's own GURU_CATEGORY_ICON) ALSO landed on Lock, then finally
  // Stamp→GoldMedal the same day per direct instruction ("特別股icon 用 GoldMedal") — back to the
  // very first icon this entry ever had, now safe to reuse since 徽章與指標 moved off Medal onto
  // Trophy in the same round (see that entry's own comment), so GoldMedal/Trophy/Medal no longer
  // collide with each other.
  // { key: 'preferred-stocks', label: '特別股專區', icon: GoldMedal, to: '/preferred-stocks' },
  // 網站導覽 re-added to the sidebar 2026-09-20 per direct request（「網站導覽要加回來喔」）—
  // /sitemap 這一頁一直都在，但自從 2026-09-17 把 sidebar 內容清空、導覽改掛 AppHeaderMenu 之後，
  // 它就只剩 SharedFooter.vue 一個入口（頁尾連結），等於從主導覽消失了。它是真的給人看的 HTML
  // 網站地圖（不是 /sitemap.xml，那支是 @nuxtjs/sitemap 產的給爬蟲的），所以放回這個清單裡。
  { key: 'sitemap', label: '網站導覽', icon: Compass, to: '/sitemap' },
  // highlights-lab（亮點排版試作）2026-09-20 加入當天就刪：它是跟財報亮點與風險並排比較的一次性試作頁，結論已採用（摘要卡的視覺
  // 規格進了 StockFinancialHighlightsRisksCard），頁面、nav 入口、sitemap 排除項一併拿掉。
  // 大師徽章：2026-09-08 從佔位殼恢復，指向學術評分法的靜態參考集（原本更大的大師挑選＋雷達圖構想停在記憶裡，沒建）。名稱
  // 大師指標→徽章系統→徽章與指標→大師徽章（2026-09-14 定案，頁面只剩徽章後「指標」不該在標籤裡）；圖示 IconHexagon→Medal→Trophy
  // （2026-09-14「徽章iocn 用 Trophy」，把 Medal 讓給特別股專區）。永遠放陣列最後（「徽章系統永遠放在sidebar最下面」）——
  // AppFeatureMenu 照陣列順序 v-for，陣列位置就是渲染位置。
  { key: 'guru-indicators', label: '大師徽章', icon: Trophy, to: '/guru-indicators' }
]
