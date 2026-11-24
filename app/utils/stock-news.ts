import type { StockNewsArticle } from '#shared/types/stock-news'
import type { MaterialAnnouncement } from '#shared/types/material-announcements'

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

// 重大訊息（2026-11-21）同一種分組：依發言日期（已經是台灣日期），組名今天／昨天加日期，每則寫發言時刻（時：分；沒有時刻的寫空的）。
// 上游已經新到舊排好
// 全市場的最新重大訊息（2026-11-24，/market/announcements）也用這一組：那邊的列多了代號與名稱、沒有 market
export interface AnnouncementGroup<T = MaterialAnnouncement> {
  day: string
  prefix: '今天' | '昨天' | ''
  items: (T & { time: string })[]
}

// 重大訊息的負面事件（2026-11-24，數據中台 negativeEvent，詞彙表：網站自己對中文）。不認得的代碼（上游之後新增的）不標
export const NEGATIVE_EVENT_LABELS: Record<string, string> = {
  auditor_change: '更換會計師',
  litigation: '重大訴訟',
  bounced_check: '退票',
  production_halt: '停工',
  reorganization_or_bankruptcy: '重整或破產',
  searched: '遭搜索',
  cybersecurity_incident: '資安事件',
  sanction: '受處分'
}
export const negativeEventLabel = (code: string | null | undefined): string | null => (code ? NEGATIVE_EVENT_LABELS[code] ?? null : null)

// 主旨與全文的換行一律換成 \n（上游原樣給 \r\n）：伺服器畫出來的 HTML 裡 \r 會被瀏覽器拿掉，跟瀏覽器自己畫的對不上（hydration 不一致，2026-11-24）
export function announcementGroups<T extends Pick<MaterialAnnouncement, 'announcementDate' | 'announcementTime' | 'subject' | 'description'>>(entries: T[], today: string): AnnouncementGroup<T>[] {
  const yesterday = new Date(Date.parse(`${today}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10)
  const groups: AnnouncementGroup<T>[] = []
  for (const entry of entries) {
    const day = entry.announcementDate
    if (groups.at(-1)?.day !== day) groups.push({ day, prefix: day === today ? '今天' : day === yesterday ? '昨天' : '', items: [] })
    groups.at(-1)!.items.push({ ...entry, subject: entry.subject.replace(/\r\n?/g, '\n'), description: entry.description.replace(/\r\n?/g, '\n'), time: entry.announcementTime?.slice(0, 5) ?? '' })
  }
  return groups
}
