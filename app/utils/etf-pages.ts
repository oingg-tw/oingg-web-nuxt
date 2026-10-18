import type { EtfDistributionComposition } from '#shared/types/screener-detail'

// ETF 個別頁的面向（2026-10-18，使用者：「幫發想個別 etf 指標與圖表，類似現在股票那邊的架構」→ 提案第一批用現有資料做 1～6 加速覽首頁）。
// 側欄就是這份清單，順序是退休族看一檔 ETF 會問的順序：領多少 → 配的錢從哪來 → 除息後多久漲回來 → 被收多少費用 → 長期報酬 → 好不好買賣。
// 不做釘選：只有六個面向，首頁（速覽）全部畫出來，自選沒有意義。
// 第二批（等 analysis-ts 開單檔歷史端點，2026-10-18 已提）：規模與受益人數、折溢價、持有人結構。
//
// 文案底線（投信投顧法）：只陳述數字，不寫推薦、便宜、貴；配息不等於報酬（收益平準金、資本利得都是本金的一部分）。
export const ETF_FACETS = [
  { key: 'overview', label: '指標速覽', suffix: '' },
  { key: 'distributions', label: '配息', suffix: '/distributions' },
  { key: 'composition', label: '配息組成', suffix: '/distribution-composition' },
  { key: 'fill', label: '填息', suffix: '/distribution-fill' },
  { key: 'expenses', label: '費用', suffix: '/expenses' },
  { key: 'returns', label: '報酬率', suffix: '/returns' },
  { key: 'liquidity', label: '成交量', suffix: '/liquidity' }
] as const

export type EtfFacetKey = typeof ETF_FACETS[number]['key']

export const etfFacetPath = (code: string, key: EtfFacetKey) => `${etfPath(code)}${ETF_FACETS.find(facet => facet.key === key)!.suffix}`
export const etfFacetItems = (code: string) => ETF_FACETS.map(facet => ({ label: facet.label, to: etfFacetPath(code, facet.key) }))

// 配息組成的五個來源（投信公告的預估比例），順序同公告
export const ETF_DISTRIBUTION_PARTS = [
  { key: 'dividendIncomePct', name: '股利所得' },
  { key: 'interestIncomePct', name: '利息所得' },
  { key: 'incomeEqualizationPct', name: '收益平準金' },
  { key: 'realizedCapitalGainPct', name: '已實現資本利得' },
  { key: 'otherIncomePct', name: '其他' }
] as const

export const hasEtfComposition = (composition: EtfDistributionComposition | null): composition is EtfDistributionComposition =>
  !!composition && ETF_DISTRIBUTION_PARTS.some(part => composition[part.key] !== null)

// 上游報酬率欄位（投信投顧公會基金月報），短到長
export const ETF_RETURN_FIELDS = [
  { field: 'return3m', label: '近3月' },
  { field: 'return6m', label: '近6月' },
  { field: 'returnYtd', label: '今年以來' },
  { field: 'return1y', label: '近1年' },
  { field: 'return2y', label: '近2年' },
  { field: 'return3y', label: '近3年' },
  { field: 'return5y', label: '近5年' },
  { field: 'return10y', label: '近10年' }
] as const

// 費率拆解（上游 /etfs/{代號} 的各項費率，%）
export const ETF_FEE_FIELDS = [
  { field: 'managementFeeRate', label: '經理費' },
  { field: 'custodianFeeRate', label: '保管費' },
  { field: 'guaranteeFeeRate', label: '保證費' },
  { field: 'otherFeeRate', label: '其他費用' },
  { field: 'commissionRate', label: '交易手續費' },
  { field: 'transactionTaxRate', label: '交易稅' },
  { field: 'etfTradingFeeRate', label: 'ETF 交易費' }
] as const

export const etfYuan = (value: number | null | undefined) => (value === null || value === undefined ? '－' : `${formatSignificantDigits(value, 4)} 元`)
export const etfPct = (value: number | null | undefined) => (value === null || value === undefined ? '－' : `${value.toFixed(2)}%`)
