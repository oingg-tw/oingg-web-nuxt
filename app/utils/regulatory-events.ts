// 裁罰、違反申報規定與經營權異動（2026-11-28；使用者 11-25 挑的交易所警示資料，「建議要的來做 不建議就先不要做」，長文欄選了
// 「只顯示日期、類別、法條與金額」）：數據中台的 GET /stocks/{symbol}/regulatory-events，業務中台照轉、網站經 /api/cached 讀，
// 畫在基本資料頁會計師示警那一段之後。三份名單：
//   penalties            金管會證期局裁罰（罰鍰）；受罰的不一定是公司（櫃買 11-25：上櫃 20 列裡公司 6、負責人 4、個人 10）
//   disclosureViolations 違反資訊申報、重大訊息及說明記者會規定：交易所依上市、上櫃契約收的違約金，不是罰鍰
//   controlChanges       經營權異動，只有異動日
// 照名單原文、不評價：只寫日期、種類、對象、法條與金額，不寫姓名；違規事由那類長文（可能夾人名）上游沒有給，連到公開資訊觀測站的專區。
// 名單從 coverage 的 from 那天起才完整（上市 2026-10-01、上櫃 2026-11-25），所以沒有紀錄時寫「某天以來查不到」，不寫「沒有」；
// 興櫃沒有這類來源（coverage 三個都是 null），整段不畫。
// 被 scripts/check-regulatory-events.mjs 直接 import，所以零 import
export interface RegulatoryCoverage {
  from: string
  // 公開資訊觀測站的專區（連到專區，不連個別案件）
  sourceUrl: string
}

export interface RegulatoryEvents {
  symbol: string
  coverage: { penalties: RegulatoryCoverage | null; disclosureViolations: RegulatoryCoverage | null; controlChanges: RegulatoryCoverage | null }
  // 都是新到舊
  penalties: { letterDate: string; penalizedParty: string; violatedLaw: string | null; dispositionType: string; fineNtd: number | null }[]
  disclosureViolations: { letterDate: string; breachPenaltyNtd: number | null; filingRuleArticles: string[]; materialInfoRuleArticles: string[] }[]
  controlChanges: { changeDate: string }[]
}

const KINDS = ['penalties', 'disclosureViolations', 'controlChanges'] as const
type RegulatoryKind = typeof KINDS[number]
// 種類的名字要短：手機上日期、種類、金額三欄要放得下（375 寬時種類最多 6 個字）。「違反申報規定」是違反資訊申報、重大訊息及說明記者會規定，
// 哪一種規定寫在那一列底下的法條，定義段說明
const KIND_TEXT: Record<RegulatoryKind, string> = { penalties: '證期局裁罰', disclosureViolations: '違反申報規定', controlChanges: '經營權異動' }
// 上游之後新增的對象不寫（說不出是誰，更不能當成公司）
const PARTY_TEXT: Record<string, string> = { company: '公司', responsible_person: '公司的行為負責人', individual: '個人' }

export interface RegulatoryRow {
  date: string
  kind: string
  amount: string
  // 那一列底下的一句（對象、法條），沒有就不畫
  remark: string
}

// 金額只寫數字：裁罰的是罰鍰、違反申報規定的是違約金，由種類看得出來，定義段說明（寫進格子裡手機放不下三欄）
const amountText = (ntd: number | null) => (ntd === null ? '－' : formatMoney(ntd))

// 三份名單併成一張表，新的在前；同一天的照裁罰、違反申報、經營權異動排
export function regulatoryRows(events: RegulatoryEvents): RegulatoryRow[] {
  const rows: RegulatoryRow[] = [
    ...events.penalties.map((item) => {
      const party = PARTY_TEXT[item.penalizedParty]
      const law = item.violatedLaw?.trim()
      return {
        date: item.letterDate,
        kind: KIND_TEXT.penalties,
        // 處分種類目前只有罰鍰；不認得的種類不把金額寫成罰鍰
        amount: item.dispositionType === 'fine' ? amountText(item.fineNtd) : '－',
        remark: [party ? `對象：${party}。` : '', law ? `法條：${law.replace(/。$/, '')}。` : ''].join('')
      }
    }),
    ...events.disclosureViolations.map((item) => {
      const articles = [
        item.filingRuleArticles.length ? `資訊申報作業辦法 ${item.filingRuleArticles.join('、')}` : '',
        item.materialInfoRuleArticles.length ? `重大訊息處理程序 ${item.materialInfoRuleArticles.join('、')}` : ''
      ].filter(Boolean)
      return { date: item.letterDate, kind: KIND_TEXT.disclosureViolations, amount: amountText(item.breachPenaltyNtd), remark: articles.length ? `法條：${articles.join('；')}。` : '' }
    }),
    ...events.controlChanges.map(item => ({ date: item.changeDate, kind: KIND_TEXT.controlChanges, amount: '－', remark: '' }))
  ]
  // sort 是穩定的：同一天的維持上面的順序
  return rows.sort((a, b) => b.date.localeCompare(a.date))
}

// 有這類來源的才畫這一段（興櫃 coverage 都是 null）
export const hasRegulatoryCoverage = (events: RegulatoryEvents | null | undefined): events is RegulatoryEvents => !!events && KINDS.some(kind => events.coverage[kind])

// 名單從哪天起完整：三份的起日不一樣時取最晚的那天（那天以後三份都完整）
export const regulatorySince = (events: RegulatoryEvents): string => KINDS.flatMap(kind => events.coverage[kind]?.from ?? []).sort().at(-1) ?? ''

// 答句（80 字內）。有紀錄：幾筆、各幾筆、最近一筆的日期，受罰的不是公司時說一聲（表格那一列底下寫對象）。沒有紀錄：寫「那天以來查不到」，
// 不寫「沒有」。只有一種時不把筆數寫兩次（「有 2 筆：證期局裁罰 2 筆」）；裁罰的對象全都不是公司時寫「都不是」，不寫「其中 4 筆」（1589 四案都是個人）
export function regulatoryAnswer(events: RegulatoryEvents | null | undefined, name: string): string | null {
  if (!hasRegulatoryCoverage(events)) return null
  const rows = regulatoryRows(events)
  if (!rows.length) return `${regulatorySince(events)} 以來，交易所公布的名單裡查不到${name}的裁罰、違反申報規定或經營權異動。`
  const kinds = KINDS.filter(kind => events[kind].length)
  const penalties = events.penalties.length
  const others = events.penalties.filter(item => item.penalizedParty !== 'company').length
  const party = !others ? '' : others < penalties ? `其中 ${others} 筆裁罰的對象不是公司。` : `裁罰的對象${penalties > 1 ? '都' : ''}不是公司。`
  if (rows.length === 1) return `有 1 筆：${rows[0]!.date} 的${rows[0]!.kind}。${party}`
  const count = kinds.length === 1 ? `有 ${rows.length} 筆${KIND_TEXT[kinds[0]!]}` : `有 ${rows.length} 筆：${kinds.map(kind => `${KIND_TEXT[kind]} ${events[kind].length} 筆`).join('、')}`
  return `${count}，最近一筆在 ${rows[0]!.date}。${party}`
}

// 公開資訊觀測站的專區連結（上游給完整網址；只收 http、https）
export function regulatorySources(events: RegulatoryEvents): { label: string; href: string }[] {
  return KINDS.flatMap((kind) => {
    const href = websiteHref(events.coverage[kind]?.sourceUrl)
    return href ? [{ label: KIND_TEXT[kind], href }] : []
  })
}
