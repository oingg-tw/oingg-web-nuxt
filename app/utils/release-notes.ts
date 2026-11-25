// 更新紀錄（2026-10-29）：管理站寫、業務中台存、這裡讀，給站內信與全站橫幅用（/changelog 頁 2026-11-25 拿掉，使用者：「changelog 移除
// 反正也沒有好好維護更新」）。資料是管理站寫的，全部當純文字；站內連結只收 / 開頭的路徑。被 scripts/check-release-notes.mjs 直接 import，所以零 import
export type ReleaseKind = 'site' | 'data' | 'maintenance'

export interface ReleaseChange {
  // 'new' | 'improved' | 'fixed'；沒見過的值不寫分類
  category: string
  text: string
  path?: string | null
}

export interface ReleaseNote {
  id: string
  kind: string
  publishedAt: string
  title: string
  changes: ReleaseChange[]
  // 通知方式（2026-11-16 站內信，詞彙表二之十）：inbox＝站內信、banner＝全站橫幅、null＝一般更新（更新紀錄頁拿掉後哪裡都不放）
  channel?: string | null
  // 橫幅從 publishedAt 掛到這個時刻；null＝一直掛，到管理站填上為止
  bannerEndsAt?: string | null
}

const YEAR_MS = 365 * 86_400_000
const newestFirst = (a: ReleaseNote, b: ReleaseNote) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt)

// 站內信（帳號區的「站內信」）：近 12 個月 channel 是 inbox 的，新的在上
export const inboxNotes = (items: ReleaseNote[], now: number) =>
  items.filter(note => note.channel === 'inbox' && Date.parse(note.publishedAt) <= now && now - Date.parse(note.publishedAt) <= YEAR_MS).sort(newestFirst)

// 全站橫幅：已發布、還沒過 bannerEndsAt、這台瀏覽器沒關掉的；同時有好幾則只掛最新的一則（通知降噪指南，2026-11-16）
export function activeBanner(items: ReleaseNote[], now: number, dismissed: string[]): ReleaseNote | null {
  const live = items.filter(note => note.channel === 'banner' && Date.parse(note.publishedAt) <= now
    && (!note.bannerEndsAt || Date.parse(note.bannerEndsAt) > now) && !dismissed.includes(note.id))
  return live.sort(newestFirst)[0] ?? null
}

export const RELEASE_KIND_LABELS: Record<ReleaseKind, string> = { site: '網站功能', data: '資料', maintenance: '維護公告' }

// 站內路徑才給連結：`//x`、`/\x` 瀏覽器都當成別的網站，`https:`、`javascript:` 不是 / 開頭
export function sitePath(path: string | null | undefined): string | null {
  return typeof path === 'string' && /^\/(?![/\\])/.test(path) && !path.includes('\\') ? path : null
}

const DATE = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' })

// 台灣日期（伺服器與瀏覽器算出來一樣）：2026-10-29；壞的時間字串回空字串
export function taipeiDate(iso: string | null | undefined): string {
  const date = new Date(iso ?? '')
  return Number.isNaN(date.getTime()) ? '' : DATE.format(date)
}
