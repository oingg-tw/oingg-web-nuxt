// 停止買賣的一句話（2026-10-22，使用者：「做吧」——摘要卡股價下面一行灰字，同興櫃「沒有成交價」那句）。停止買賣期間股價與逐日指標
// 都停住，讀者會以為資料壞了。資料是 業務中台 的 tradingHalt（analysis 依台北日期算好 status；admin-vue 的公司檢視寫法相同）。
// 被 scripts/check-trading-halt.mjs 直接 import，所以零 import
export interface TradingHalt {
  // 'active' 停止買賣中、'upcoming' 已公告還沒開始；其他值不顯示（說不出對的話）
  status: string
  reason: string | null
  haltFrom: string
  haltTo: string | null
  resumeOn: string | null
}

// 'other' 與上游之後新增的原因不寫原因
const REASONS: Record<string, string> = {
  capital_reduction: '減資換發',
  par_value_change: '面額變更換發',
  pending_announcement: '重大訊息待公布',
  regulatory: '主管機關處分'
}

// 日期寫 M/D；跨年、或沒有結束日（處分可能拖很久）才帶年份。不看「今天」：伺服器與瀏覽器的今天在跨年那幾小時不一樣，畫出來會對不上
export function tradingHaltText(halt: TradingHalt | null | undefined): string | null {
  if (!halt || (halt.status !== 'active' && halt.status !== 'upcoming')) return null
  const dates = [halt.haltFrom, halt.haltTo, halt.resumeOn].filter((date): date is string => !!date)
  const withYear = !halt.haltTo || new Set(dates.map(date => date.slice(0, 4))).size > 1
  const day = (iso: string) => `${withYear ? `${iso.slice(0, 4)}/` : ''}${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}`
  const span = halt.haltTo ? `${day(halt.haltFrom)}～${day(halt.haltTo)}` : `${day(halt.haltFrom)} 起`
  const reason = halt.reason ? REASONS[halt.reason] : undefined
  const resume = halt.resumeOn ? `，預計 ${day(halt.resumeOn)} 恢復` : ''
  return `${halt.status === 'active' ? '停止買賣中' : '將停止買賣'}（${reason ? `${reason}，` : ''}${span}）${resume}`
}
