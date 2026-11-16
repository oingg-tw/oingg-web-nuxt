// 電子報（2026-11-16，業務中台的合約：GET /newsletter、PUT /newsletter/{edition}、不用登入的 token 三支）：分塊的代碼與名稱、token 的形狀、
// 下一封預計的時間。零 import：scripts/check-newsletter.mjs 直接載入

// 分塊，照業務中台回應的固定順序
export const NEWSLETTER_SECTIONS = [
  { code: 'holdings', label: '持股週報', hint: '本週市值變化、報酬、今年股利收入' },
  { code: 'ex_dividends', label: '下週除權息與股利入帳', hint: '預估入帳＝你的股數 × 每股股利' },
  { code: 'material_announcements', label: '本週重大訊息', hint: '只有標題，點了看公告' },
  { code: 'attention_and_disposed_stocks', label: '注意股、處置股提醒', hint: '你的股票被列入時提醒' }
] as const

export type NewsletterSection = (typeof NEWSLETTER_SECTIONS)[number]['code']

export interface NewsletterEdition {
  edition: string
  optIn: boolean
  sections: NewsletterSection[]
  optedInAt: string | null
  optedOutAt: string | null
}

// 沒有帳號 email 的人（LINE 建立的）自己填的收件 email：填了是 entered，寄出驗證信是 pending_verification，點了連結是 verified
export interface NewsletterEmail {
  address: string
  status: 'entered' | 'pending_verification' | 'verified'
  verifiedAt: string | null
}

// 沒設定過的版別也列出來（optIn false、四塊全選）；email 是帳號的，LINE 建立的帳號是 null
export interface NewsletterSettings {
  email: string | null
  newsletterEmail: NewsletterEmail | null
  editions: NewsletterEdition[]
}

// 驗證連結確認後的回應（不用登入）：寄到的地址遮罩過，editions 讓結果頁知道週報開了沒
export interface NewsletterVerifyResult {
  status: 'verified'
  maskedDeliveryAddress: string
  editions: { edition: string; optIn: boolean }[]
}

// 週報寄到哪（業務中台的規則）：帳號有 email 就是帳號的，之前填過收件 email 也一樣；沒有才用自己填、驗證過的。都沒有是 null，週報開著也不會寄
export const newsletterAddress = (settings: NewsletterSettings): string | null =>
  settings.email ?? (settings.newsletterEmail?.status === 'verified' ? settings.newsletterEmail.address : null)

// 不用登入的查詢、退訂、繼續收都回這個。信件標頭那把 token 只能退訂，退訂時 maskedDeliveryAddress 是 null。鍵名是 2026-11-16 詞彙檢核的新名（業務中台 00083）：回應的 maskedDeliveryAddress（原本 maskedEmail、maskedAddress），body 的 optOutToken、verificationToken（原本都叫 token）
export interface NewsletterTokenState {
  edition: string
  optIn: boolean
  maskedDeliveryAddress: string | null
}

// token 的形狀（跟業務中台對過：最多 64 字、英數與 - _）。網址是信裡帶來的，形狀不對的不送上游
export const isNewsletterToken = (value: unknown): value is string => typeof value === 'string' && /^[\w-]{1,64}$/.test(value)

// 下一封預計什麼時候：下一個週日晚上 8 點（台北，固定 UTC+8），週日 8 點以前就是當天。那週沒有內容就不寄，所以畫面寫「預計」
export function nextNewsletterIssue(now: number): string {
  const taipei = new Date(now + 8 * 3_600_000)
  const issue = new Date(Date.UTC(taipei.getUTCFullYear(), taipei.getUTCMonth(), taipei.getUTCDate() + ((7 - taipei.getUTCDay()) % 7), 20))
  if (issue <= taipei) issue.setUTCDate(issue.getUTCDate() + 7)
  return `${issue.getUTCMonth() + 1}/${issue.getUTCDate()}（日）晚上 8 點`
}
