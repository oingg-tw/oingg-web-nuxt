// 篩選區的三組（2026-10-15 三組篩選重新設計）：側欄（ScreenerNav）與 /screener 首頁讀同一份，名稱、網址、說明不會分家。
// description 是 /screener 首頁每一段的答句——有它首頁才不是側欄的複本。只陳述能篩什麼，不說哪一組比較好。
export interface ScreenerZoneItem {
  key: 'common' | 'preferred' | 'etf'
  // 首頁問句的主詞：「普通股可以怎麼篩？」
  subject: string
  label: string
  to: string
  description: string
}

export const SCREENER_ZONE_ITEMS: ScreenerZoneItem[] = [
  { key: 'common', subject: '普通股', label: '普通股篩選', to: SCREENER_PATHS.common, description: '用 ROE、負債比率、殖利率等財報指標設條件，從上市櫃公司裡篩出符合的；可限定或排除證交所類股，也可以從官方範本開始。' },
  { key: 'preferred', subject: '特別股', label: '特別股篩選', to: SCREENER_PATHS.preferred, description: '比較上市櫃特別股的股息率、最差情境殖利率（YTW）、溢價率與累積、參加、可轉換、可贖回等契約條件。' },
  { key: 'etf', subject: 'ETF', label: 'ETF 篩選', to: SCREENER_PATHS.etf, description: '依資產類型、規模、總費用率、配息頻率、折溢價與各期報酬篩選上市櫃 ETF。' }
]
