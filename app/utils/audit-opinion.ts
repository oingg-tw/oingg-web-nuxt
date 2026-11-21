// 會計師查核（核閱）意見（數據中台 A 批，2026-11-22；使用者同日「按照建議執行」，設計 https://claude.ai/artifact/BffXAybhLkibJSNAcRTDkz）：
// 數據中台的 GET /stocks/{symbol}/audit-opinions，業務中台照轉、網站經 /api/cached 讀（摘要一起，useStockSummary）。
// 示警只算三種：繼續經營有重大不確定性、無法表示意見、年報的保留意見。季報的「保留結論」多半是部分非重要子公司的財報沒經會計師核閱
//（2026 Q3 有 939 家），不算示警、表格也不列。摘要卡寫一句帶期別的狀態（同停止買賣），基本資料頁列出示警的那幾期。
// 被 scripts/check-audit-opinion.mjs 直接 import，所以零 import
export interface AuditOpinionEntry {
  fiscalYear: number
  fiscalQuarter: number | null
  // 'audit' 查核、'review' 核閱
  reportKind: string
  // unqualified、unqualified_with_emphasis、going_concern_uncertainty、qualified、disclaimer_of_opinion；讀不到是 null（DEV 實測 2314 的 2015 年四期）
  opinion: string | null
  accountants: string[]
  reviewAuditDate: string | null
}

export interface AuditOpinions {
  symbol: string
  // 最近一期的示警：going_concern_uncertainty、disclaimer_of_opinion、annual_qualified_opinion、none；一期意見都沒有是 null
  auditorWarning: string | null
  // 新到舊
  entries: AuditOpinionEntry[]
}

const WARNING_TEXT: Record<string, string> = {
  going_concern_uncertainty: '繼續經營有重大不確定性',
  disclaimer_of_opinion: '無法表示意見',
  qualified: '保留意見'
}
// 摘要的 auditorWarning 對到哪一種意見
const WARNING_OPINION: Record<string, string> = {
  going_concern_uncertainty: 'going_concern_uncertainty',
  disclaimer_of_opinion: 'disclaimer_of_opinion',
  annual_qualified_opinion: 'qualified'
}

const isAnnual = (entry: AuditOpinionEntry) => entry.reportKind === 'audit' && (entry.fiscalQuarter ?? 4) === 4
export const isAuditWarning = (entry: AuditOpinionEntry) => entry.opinion === 'going_concern_uncertainty' || entry.opinion === 'disclaimer_of_opinion' || (entry.opinion === 'qualified' && isAnnual(entry))
export const auditPeriodLabel = (entry: AuditOpinionEntry) => (isAnnual(entry) ? `${entry.fiscalYear} 年報` : `${entry.fiscalYear} Q${entry.fiscalQuarter}`)
export const auditReportLabel = (entry: AuditOpinionEntry) => (entry.reportKind === 'review' ? '季報核閱' : isAnnual(entry) ? '年度查核' : '查核')
// 核閱報告的無法表示意見叫「無法作成結論」（8084 的 2026 Q3），查核報告才是「無法表示意見」
export const auditOpinionText = (entry: AuditOpinionEntry) => (entry.opinion === 'disclaimer_of_opinion' && entry.reportKind === 'review' ? '無法作成結論' : WARNING_TEXT[entry.opinion ?? ''] ?? '')
// 答句裡的那一份報告：「2025 年報」「2026 Q3 的核閱報告」
const reportPhrase = (entry: AuditOpinionEntry) => (isAnnual(entry) ? auditPeriodLabel(entry) : `${auditPeriodLabel(entry)} 的${entry.reportKind === 'review' ? '核閱' : '查核'}報告`)

// 摘要卡：「會計師：繼續經營有重大不確定性（2026 Q3）」；最近一期沒有示警就不寫
export function auditorWarningText(audit: AuditOpinions | null | undefined): string | null {
  const opinion = WARNING_OPINION[audit?.auditorWarning ?? '']
  if (!audit || !opinion) return null
  const entry = audit.entries.find(item => item.opinion === opinion && isAuditWarning(item))
  return entry ? `會計師：${auditOpinionText(entry)}（${auditPeriodLabel(entry)}）` : `會計師：${WARNING_TEXT[opinion]}`
}

// 基本資料頁那一段的答句（80 字內）：有沒有、最近是哪一份報告寫的、共幾期；過去有、最近一期沒有的另外說。沒有任何一期意見回 null（不畫這一段）
export function auditAnswer(audit: AuditOpinions | null | undefined): string | null {
  const entries = audit?.entries ?? []
  if (!entries.length) return null
  const warnings = entries.filter(isAuditWarning)
  // 「X 年以來」只算意見都讀得到的整年：從最新一期往回，碰到讀不到的（null）就停，那一年不完整就從下一年算
  const unknown = entries.findIndex(entry => !entry.opinion)
  const oldest = (unknown === -1 ? entries : entries.slice(0, unknown)).at(-1)
  const since = oldest ? `${oldest.fiscalYear + (unknown === -1 || (oldest.fiscalQuarter ?? 1) === 1 ? 0 : 1)} 年以來` : '近幾年'
  if (!warnings.length) return `沒有：${since}的財報都沒有繼續經營疑慮、無法表示意見或年報保留意見。`
  const latest = warnings[0]!
  const count = warnings.length > 1 ? `，${since}共 ${warnings.length} 期` : ''
  return WARNING_OPINION[audit?.auditorWarning ?? '']
    ? `有：${reportPhrase(latest)}寫了「${auditOpinionText(latest)}」${count}。`
    : `最近一期沒有；${reportPhrase(latest)}曾寫「${auditOpinionText(latest)}」${count}。`
}
