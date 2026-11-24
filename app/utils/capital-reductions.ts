// 減資（2026-11-24，數據中台 a917c22 盤點三；業務中台 GET /stocks/{symbol}/capital-reductions?includeUpcoming=true）：股本變化頁
// 「有沒有減資？」那一段。includeUpcoming 另外列已公告、還沒恢復買賣的（同一家之後沒有更晚的減資，而且首次公告在三年內），那幾筆的
// resumeDate 是 null。缺的欄位照實是 null（899 筆裡減資基準日 801、換發新股基準日 789、停止買賣起訖 635 有值）
export interface CapitalReduction {
  firstAnnouncedOn: string
  resumeDate: string | null
  lastTradeDate: string | null
  newSharesPerThousand: number | null
  refundPerShare: number | null
  kind: string
  reductionRatioPct: number | null
  reductionRecordDate: string | null
  shareExchangeRecordDate: string | null
  haltStartDate: string | null
  haltEndDate: string | null
}

// 數據中台的 kind；不認得的不寫原因
export const CAPITAL_REDUCTION_KIND: Record<string, string> = { loss_offset: '彌補虧損', cash_refund: '退還股款' }

const trim = (value: number, digits: number) => String(Number(value.toFixed(digits)))
export const reductionRatioText = (event: CapitalReduction): string => (event.reductionRatioPct === null ? '－' : `${trim(event.reductionRatioPct, 2)}%`)
// 彌補虧損不退錢：0 寫「－」
export const refundText = (event: CapitalReduction): string => (event.refundPerShare ? `${trim(event.refundPerShare, 4)} 元` : '－')

// 表格那一列底下的一句：每千股換發、減資基準日、換發新股基準日、停止買賣起訖，有的才寫
export function reductionRemark(event: CapitalReduction): string {
  return [
    event.newSharesPerThousand !== null ? `每千股換發 ${trim(event.newSharesPerThousand, 3)} 股` : '',
    event.reductionRecordDate ? `減資基準日 ${event.reductionRecordDate}` : '',
    event.shareExchangeRecordDate ? `換發新股基準日 ${event.shareExchangeRecordDate}` : '',
    event.haltStartDate && event.haltEndDate ? `停止買賣 ${event.haltStartDate}～${event.haltEndDate}` : ''
  ].filter(Boolean).join('；')
}

// 「公告退還股款減資 25%（每股退 2.5 元）」
function what(event: CapitalReduction): string {
  const refund = event.refundPerShare ? `（每股退 ${trim(event.refundPerShare, 4)} 元）` : ''
  return `${CAPITAL_REDUCTION_KIND[event.kind] ?? ''}減資${event.reductionRatioPct === null ? '' : ` ${trim(event.reductionRatioPct, 2)}%`}${refund}`
}

// 答案：還沒恢復買賣的先說；沒有紀錄寫「查不到」，不寫「沒有」（資料只有公開資訊觀測站收到的那些）
export function reductionAnswer(events: CapitalReduction[], name: string): string {
  if (!events.length) return `查不到${name}的減資紀錄。`
  const newest = (list: CapitalReduction[]) => list.reduce((a, b) => (b.firstAnnouncedOn > a.firstAnnouncedOn ? b : a))
  const done = events.filter(event => event.resumeDate)
  const upcoming = events.filter(event => !event.resumeDate)
  if (upcoming.length) {
    const event = newest(upcoming)
    return `${name}在 ${event.firstAnnouncedOn} 公告${what(event)}，還沒恢復買賣${done.length ? `；之前減資過 ${done.length} 次` : ''}。`
  }
  const event = newest(done)
  return `${name}減資過 ${done.length} 次，最近一次是 ${event.firstAnnouncedOn} 公告的${what(event)}，${event.resumeDate} 恢復買賣。`
}
