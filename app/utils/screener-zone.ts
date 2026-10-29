// 篩選區的三組（2026-10-15 三組篩選重新設計）：側欄（ScreenerNav）與篩選頁的標題讀同一份，名稱、網址不會分家。
// 標題下的說明文字 2026-10-22 拿掉（使用者：「screener-shell__intro 文字說明拿掉」），description 一起刪了。
// 業務中台 的 universe（2026-10-15，84112d8）：三組的「我的篩選」「欄位組合」存在同一個資源，用這個分開；免費額度三組合計
export type ScreenerUniverse = 'common' | 'preferred' | 'etf'

export interface ScreenerZoneItem {
  key: ScreenerUniverse
  // 句子裡的主詞：「沒有符合上述條件的普通股」
  subject: string
  label: string
  to: string
}

export const SCREENER_ZONE_ITEMS: ScreenerZoneItem[] = [
  { key: 'common', subject: '普通股', label: '普通股篩選', to: SCREENER_PATHS.common },
  { key: 'preferred', subject: '特別股', label: '特別股篩選', to: SCREENER_PATHS.preferred },
  { key: 'etf', subject: 'ETF', label: 'ETF 篩選', to: SCREENER_PATHS.etf }
]

// 側欄：三組篩選，再加 REITs 總覽（2026-10-29 使用者：「把"篩選" 改成 選擇 或是總覽」「至少要可以排序」）——不是篩選頁，沒有 universe
export const SCREENER_NAV_ITEMS = [...SCREENER_ZONE_ITEMS, { label: 'REITs 總覽', to: SCREENER_PATHS.reits }]
