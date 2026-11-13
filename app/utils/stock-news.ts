import type { StockNewsArticle } from '#shared/types/stock-news'

// 近期新聞的時間（2026-11-12 使用者定案「並用」，設計頁 https://claude.ai/artifact/3n25Tvhai5n8ZzkdCqkRhu）：依台北日期分組，組名是
// 今天／昨天加日期（日期由頁面用 shortDayLabel 寫）；每則寫台北時刻，24 小時內再補「（N 分鐘前／N 小時前）」。
// 上游已經新到舊排好，相鄰同一天的併成一組；發布時間讀不懂的那則不列，一則壞資料不會弄壞整頁
export interface StockNewsGroup {
  day: string
  prefix: '今天' | '昨天' | ''
  items: (StockNewsArticle & { time: string })[]
}

const TAIPEI_OFFSET_MS = 8 * 3600_000

export function stockNewsGroups(articles: StockNewsArticle[], today: string): StockNewsGroup[] {
  const yesterday = new Date(Date.parse(`${today}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10)
  const groups: StockNewsGroup[] = []
  for (const article of articles) {
    const instant = Date.parse(article.publishedAt)
    if (Number.isNaN(instant)) continue
    const taipei = new Date(instant + TAIPEI_OFFSET_MS).toISOString()
    const day = taipei.slice(0, 10)
    if (groups.at(-1)?.day !== day) groups.push({ day, prefix: day === today ? '今天' : day === yesterday ? '昨天' : '', items: [] })
    groups.at(-1)!.items.push({ ...article, time: taipei.slice(11, 16) })
  }
  return groups
}

const relative = new Intl.RelativeTimeFormat('zh-TW')

// 要讀者看的時刻，所以只在瀏覽器掛上之後算。不到 1 分鐘算 1 分鐘；未來的時間（來源時鐘不準）和超過 24 小時不寫
export function stockNewsAgo(publishedAt: string, now: number): string {
  const minutes = Math.floor((now - Date.parse(publishedAt)) / 60_000)
  if (!(minutes >= 0 && minutes < 24 * 60)) return ''
  return `（${minutes < 60 ? relative.format(-Math.max(minutes, 1), 'minute') : relative.format(-Math.floor(minutes / 60), 'hour')}）`
}
