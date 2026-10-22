// 篩選的條件、欄位、排序放進網址（2026-10-22，使用者：「篩選 條件 可以放在 query嗎? 這樣用戶也可以直接儲存成書籤快速到訪 也可以用
// 網址直接分享給別人」，選了條件＋欄位＋排序、不另外放複製連結按鈕）。看得懂的寫法：
//   f=roe.TTM:15~           數字條件：15 以上（~20 是 20 以下，10~20 是之間）
//   f=!debtRatio.Q:~60      前面加 ! 是排除
//   f=market.EOD:sii,otc    類別條件，逗號分隔
//   c=roe.TTM,debtRatio.Q   欄位，照順序
//   sort=roe.TTM:desc
// 網址是任何人都能改的輸入：格式不對的條件整個略過，最多 20 個條件、40 個欄位；欄位在不在型錄由呼叫端對。
// 被 scripts/check-screener-url.mjs 直接 import，所以零 import

export interface ScreenerUrlFilter {
  field: string
  min: number | null
  max: number | null
  exclude: boolean
  // 解析出來一律是字串；畫面上的條件可能是數字（除權息月份的選項值是整數），呼叫端照型錄的選項換回去
  values?: (string | number)[]
}

export interface ScreenerUrlState {
  filters: ScreenerUrlFilter[]
  columns: string[]
  sort: { field: string; order: 'asc' | 'desc' } | null
}

const FIELD = /^[A-Za-z][\w.]*$/
const NUMBER = /^-?\d+(\.\d+)?$/
const MAX_FILTERS = 20
const MAX_COLUMNS = 40

const filterText = (filter: ScreenerUrlFilter, values = filter.values) =>
  `${filter.exclude ? '!' : ''}${filter.field}:${values ? values.join(',') : `${filter.min ?? ''}~${filter.max ?? ''}`}`

export function encodeScreenerQuery(state: ScreenerUrlState): Record<string, string | string[]> {
  const query: Record<string, string | string[]> = {}
  const filters = state.filters.map(filter => filterText(filter))
  if (filters.length) query.f = filters
  if (state.columns.length) query.c = state.columns.join(',')
  if (state.sort) query.sort = `${state.sort.field}:${state.sort.order}`
  return query
}

const strings = (value: unknown): string[] => (Array.isArray(value) ? value : [value]).filter((item): item is string => typeof item === 'string')

function decodeFilter(raw: string): ScreenerUrlFilter | null {
  const match = /^(!?)([^:]+):(.+)$/.exec(raw)
  if (!match || !FIELD.test(match[2]!)) return null
  const exclude = match[1] === '!'
  const field = match[2]!
  const body = match[3]!
  if (body.includes('~')) {
    const parts = body.split('~')
    if (parts.length !== 2 || parts.some(part => part !== '' && !NUMBER.test(part))) return null
    const [min, max] = parts.map(part => (part === '' ? null : Number(part)))
    return min === null && max === null ? null : { field, min: min!, max: max!, exclude }
  }
  const values = body.split(',').filter(value => value !== '' && value.length <= 40)
  return values.length ? { field, min: null, max: null, exclude, values } : null
}

export function decodeScreenerQuery(query: Record<string, unknown>): ScreenerUrlState | null {
  const filters = strings(query.f).slice(0, MAX_FILTERS).map(decodeFilter).filter((filter): filter is ScreenerUrlFilter => filter !== null)
  const columns = (strings(query.c)[0] ?? '').split(',').filter(column => FIELD.test(column)).slice(0, MAX_COLUMNS)
  const sortMatch = /^([^:]+):(asc|desc)$/.exec(strings(query.sort)[0] ?? '')
  const sort = sortMatch && FIELD.test(sortMatch[1]!) ? { field: sortMatch[1]!, order: sortMatch[2] as 'asc' | 'desc' } : null
  return filters.length || columns.length || sort ? { filters, columns, sort } : null
}

// 兩組條件是不是同一組（網址打開時找已存的那一組用）：條件的順序、類別值的順序都不算
export function sameFilters(a: ScreenerUrlFilter[], b: ScreenerUrlFilter[]): boolean {
  const key = (filters: ScreenerUrlFilter[]) => filters.map(filter => filterText(filter, filter.values && [...filter.values].map(String).sort())).sort().join('|')
  return key(a) === key(b)
}
