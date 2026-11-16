// 更新紀錄（2026-10-29，/changelog）：管理站寫、業務中台存、這裡讀。三種都收（網站功能、資料、維護公告），進行中的維護公告置頂、不在
// 時間軸重複。資料是管理站寫的，全部當純文字；站內連結只收 / 開頭的路徑。被 scripts/check-release-notes.mjs 直接 import，所以零 import
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
  // 只有維護公告有；endedAt 是 null＝進行中
  startedAt?: string | null
  endedAt?: string | null
  // 通知方式（2026-11-16 站內信，詞彙表二之十）：inbox＝站內信、banner＝全站橫幅、null＝只放更新紀錄（一般更新）
  channel?: string | null
  // 橫幅從 publishedAt 掛到這個時刻；null＝一直掛，到管理站填上為止
  bannerEndsAt?: string | null
}

const YEAR_MS = 365 * 86_400_000
const newestFirst = (a: ReleaseNote, b: ReleaseNote) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt)

// 站內信（帳號區的「站內信」）：近 12 個月 channel 是 inbox 的，新的在上；更早的看更新紀錄
export const inboxNotes = (items: ReleaseNote[], now: number) =>
  items.filter(note => note.channel === 'inbox' && Date.parse(note.publishedAt) <= now && now - Date.parse(note.publishedAt) <= YEAR_MS).sort(newestFirst)

// 全站橫幅：已發布、還沒過 bannerEndsAt、這台瀏覽器沒關掉的；同時有好幾則只掛最新的一則（通知降噪指南，2026-11-16）
export function activeBanner(items: ReleaseNote[], now: number, dismissed: string[]): ReleaseNote | null {
  const live = items.filter(note => note.channel === 'banner' && Date.parse(note.publishedAt) <= now
    && (!note.bannerEndsAt || Date.parse(note.bannerEndsAt) > now) && !dismissed.includes(note.id))
  return live.sort(newestFirst)[0] ?? null
}

export const RELEASE_KIND_LABELS: Record<ReleaseKind, string> = { site: '網站功能', data: '資料', maintenance: '維護公告' }
export const RELEASE_CATEGORY_LABELS: Record<string, string> = { new: '新增', improved: '改善', fixed: '修正' }

// ?kind= 的值；不認得的當「全部」（null）
export function releaseKindOf(value: unknown): ReleaseKind | null {
  return typeof value === 'string' && Object.hasOwn(RELEASE_KIND_LABELS, value) ? value as ReleaseKind : null
}

const isOngoing = (note: ReleaseNote) => note.kind === 'maintenance' && note.endedAt == null

// 進行中的維護公告不管篩選都顯示；時間軸照篩選、不含進行中的
export function splitReleaseNotes(items: ReleaseNote[], kind: ReleaseKind | null) {
  return {
    ongoing: items.filter(isOngoing),
    timeline: items.filter(note => !isOngoing(note) && (!kind || note.kind === kind))
  }
}

// 站內路徑才給連結：`//x`、`/\x` 瀏覽器都當成別的網站，`https:`、`javascript:` 不是 / 開頭
export function sitePath(path: string | null | undefined): string | null {
  return typeof path === 'string' && /^\/(?![/\\])/.test(path) && !path.includes('\\') ? path : null
}

const DATE = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' })
const DATE_TIME = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

// 台灣時間（伺服器與瀏覽器算出來一樣）：2026-10-29、2026-10-29 14:30；壞的時間字串回空字串
function formatWith(format: Intl.DateTimeFormat, iso: string | null | undefined): string {
  const date = new Date(iso ?? '')
  return Number.isNaN(date.getTime()) ? '' : format.format(date)
}
export const taipeiDate = (iso: string | null | undefined) => formatWith(DATE, iso)
export const taipeiDateTime = (iso: string | null | undefined) => formatWith(DATE_TIME, iso)
