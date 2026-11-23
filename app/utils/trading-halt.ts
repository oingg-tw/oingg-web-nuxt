// 停止買賣與下市的一句話（2026-10-22，使用者：「做吧」「好」——摘要卡股價下面的灰字，同興櫃「沒有成交價」那句）。停止買賣期間股價與
// 逐日指標都停住，讀者會以為資料壞了。資料是 業務中台 的 tradingHalt、delisting（analysis 依台北日期算好 status；admin-vue 的公司檢視
// 寫法相同）。被 scripts/check-trading-halt.mjs 直接 import，所以零 import
// 日期三欄是 2026-11-16 詞彙檢核 X6 的新名（原本 haltFrom／haltTo／resumeOn）
export interface TradingHalt {
  // 'active' 停止買賣中、'upcoming' 已公告還沒開始；其他值不顯示（說不出對的話）
  status: string
  reason: string | null
  haltStartDate: string
  haltEndDate: string | null
  resumeDate: string | null
}

// 'other' 與上游之後新增的原因不寫原因
const REASONS: Record<string, string> = {
  capital_reduction: '減資換發',
  par_value_change: '面額變更換發',
  pending_announcement: '重大訊息待公布',
  regulatory: '主管機關處分'
}

// 日期寫 M/D；跨年、或沒有結束日（處分可能拖很久）才帶年份。不看「今天」：伺服器與瀏覽器的今天在跨年那幾小時不一樣，畫出來會對不上
const monthDay = (iso: string, withYear: boolean) => `${withYear ? `${iso.slice(0, 4)}/` : ''}${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}`
const dateSpan = (start: string, end: string) => `${monthDay(start, start.slice(0, 4) !== end.slice(0, 4))}～${monthDay(end, start.slice(0, 4) !== end.slice(0, 4))}`

export function tradingHaltText(halt: TradingHalt | null | undefined): string | null {
  if (!halt || (halt.status !== 'active' && halt.status !== 'upcoming')) return null
  const dates = [halt.haltStartDate, halt.haltEndDate, halt.resumeDate].filter((date): date is string => !!date)
  const withYear = !halt.haltEndDate || new Set(dates.map(date => date.slice(0, 4))).size > 1
  const day = (iso: string) => monthDay(iso, withYear)
  const span = halt.haltEndDate ? `${day(halt.haltStartDate)}～${day(halt.haltEndDate)}` : `${day(halt.haltStartDate)} 起`
  const reason = halt.reason ? REASONS[halt.reason] : undefined
  const resume = halt.resumeDate ? `，預計 ${day(halt.resumeDate)} 恢復` : ''
  return `${halt.status === 'active' ? '停止買賣中' : '將停止買賣'}（${reason ? `${reason}，` : ''}${span}）${resume}`
}

// 下市：上游只給還沒生效的公告，加上 90 天內剛生效的（證交所會重複使用代號）
export interface Delisting {
  // 'announced' 已公告、還沒到；'effective' 已生效；其他值不顯示
  status: string
  date: string
}

// 日期只寫 M/D：公告到下市通常一兩個月，不會讀錯年
export function delistingText(delisting: Delisting | null | undefined): string | null {
  if (!delisting) return null
  const day = `${Number(delisting.date.slice(5, 7))}/${Number(delisting.date.slice(8, 10))}`
  if (delisting.status === 'announced') return `已公告 ${day} 下市`
  if (delisting.status === 'effective') return `已於 ${day} 下市`
  return null
}

// 處置、可能達處置、注意股票、全額交割（2026-11-24；使用者 11-23 核准摘要卡的風險狀態，數據中台 00185-jqq 的 quote 四欄、業務中台照轉）。
// 跟停止買賣一樣是帶日期的狀態，不是說明；status 由上游依台北日期算好（同 tradingHalt），沒見過的值不顯示
export interface TradingStatuses {
  // 那一所最新交易日公布為注意股票
  attention?: { tradeDate: string } | null
  // 最新交易日「注意累計次數可能達處置標準」名單；一則可能同時符合好幾條。windowTradingDays null＝連續 noticeCount 次
  nearDispositionThreshold?: { announcedDate: string; clauses: { noticeCount: number; windowTradingDays: number | null; startDate: string; endDate: string }[] } | null
  disposition?: { status: string; startDate: string; endDate: string } | null
  // 11-26 起上游再加 startDate 與 status（指定全額交割的生效日）；在那之前只有名單日期，所以只寫「全額交割中」
  alteredTradingMethod?: { listedDate: string; startDate?: string | null; status?: string } | null
}

// 一行一個狀態，重的在前。注意股票只在沒有處置、可能達處置時寫：可能達處置那句的次數已經算進這一次的注意
export function tradingStatusTexts(statuses: TradingStatuses | null | undefined): string[] {
  if (!statuses) return []
  const lines: string[] = []
  const altered = statuses.alteredTradingMethod
  if (altered) {
    const since = altered.startDate ? `（${monthDay(altered.startDate, true)} 起）` : ''
    if (!altered.status || altered.status === 'active') lines.push(`全額交割中${since}`)
    else if (altered.status === 'upcoming' && since) lines.push(`將全額交割${since}`)
  }
  const disposition = statuses.disposition
  const disposed = disposition && (disposition.status === 'active' || disposition.status === 'upcoming')
  if (disposed) lines.push(`${disposition.status === 'active' ? '處置中' : '將處置'}（${dateSpan(disposition.startDate, disposition.endDate)}）`)
  // 每條的起訖跟「近 N 個營業日」「連續 N 次」說的是同一段，只寫公告日（手機上兩條各帶起訖會折成三行）
  const near = statuses.nearDispositionThreshold
  const clauses = near?.clauses ?? []
  if (near && clauses.length) {
    const clauseText = (clause: (typeof clauses)[number]) => `${clause.windowTradingDays === null ? '連續' : `近 ${clause.windowTradingDays} 個營業日`} ${clause.noticeCount} 次`
    lines.push(`可能達處置標準：${clauses.map(clauseText).join('、')}注意（${monthDay(near.announcedDate, false)} 公布）`)
  }
  if (statuses.attention && !disposed && !clauses.length) lines.push(`注意股票（${monthDay(statuses.attention.tradeDate, false)} 公布）`)
  return lines
}
