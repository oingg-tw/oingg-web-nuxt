// /screener/values 與 /screener 回傳的儲存格（字串）怎麼顯示。篩選器結果表與觀察清單的自訂欄位共用
// （2026-10-06 從 SharedMetricTable 搬出來；原本的理由註解留在那邊的呼叫處）。
// unit 來自 GET /metrics 型錄（locateFieldInSchema），只有百分比會加 %。
// 型錄的百分比單位是 '%'，不是早期的 'percent'（2026-10-06 實測 roe／grossMargin／dividendYield 全是 '%'）。
// 這裡原本比的是 'percent'，於是篩選器結果表的百分比欄位不知從哪天起就沒有 % 了；
// screener/[preset].vue、metrics-history.vue、stock-answers.ts 早就是比 '%'。
// 個股殖利率 0 ＝ 最近一年度沒有配發現金股利（交易所的殖利率是最近一年度現金股利÷收盤價）。待辦清單
// 2026-10-01：「殖利率 0%」改寫成「不配息」。**只在個股層級**——類股中位數是 0 不等於整個類股不配息。
export const NO_DIVIDEND_TEXT = '不配息'

// 多值的類別欄位（除權息月份，上游寫成「1、7、11」，2026-10-22）逐項換成選項的名稱：「1 月、7 月、11 月」。三組篩選共用
export const labelEachValue = (raw: string, labelOf: (value: string) => string | undefined) => raw.split('、').map(value => labelOf(value) ?? value).join('、')

// 一格數字的資料時間（2026-10-23，使用者：「顯示資料時間 那邊 近四季的資料可以一律用 26Q1 26Q2這種表示方式嗎? 這才是用戶真正關心的」）：
// 有財報期別就寫期別——單季、累計、近四季是最後那一季（"2026Q2" 寫成 26Q2，同「最新財報季別」的選項），年度是年份（"2025"），月頻是
// 月份（"2026-09"）；逐日、窗口型與即時的沒有期別（null），照舊寫那一天。期別是 analysis-ts 789ba5e1／業務中台 a52f7b5 每格帶的
// fiscalPeriod，不從 knowledgeDate 推（每季更新的年度指標，2026Q2 公布時的值是 2025 年度的）
export const cellPeriodText = (cell: { knowledgeDate: string | null; fiscalPeriod?: string | null }) => cell.fiscalPeriod?.replace(/^20(\d\d)Q/, '$1Q') ?? cell.knowledgeDate

// 除權息月份的選項（特別股、ETF 的值是字串 '1'～'12'；普通股的選項由型錄給，值是整數、名稱同樣是「1 月」）
export const EX_DIVIDEND_MONTH_OPTIONS = Array.from({ length: 12 }, (_, index) => ({ value: String(index + 1), label: `${index + 1} 月` }))

// options：類別型欄位（型錄的 kind categorical，例如河道位置）的選項。上游的值一律是十進位字串（"0"），選項的 value 是數字，
// 所以用字串比對後顯示中文（破底…破頂）；對不到的照原值（2026-10-21）
export function formatScreenerValue(raw: string | null | undefined, unit: string | undefined, field?: string, options?: { value: string | number; label: string }[] | null): string {
  if (raw === null || raw === undefined) return '—'
  if (options?.length) return labelEachValue(raw, value => options.find(option => String(option.value) === value)?.label)
  if (field === 'dividendYield.EOD' && Number(raw) === 0) return NO_DIVIDEND_TEXT
  if (unit === '%') return `${raw}%`
  const value = Number(raw)
  if (!Number.isFinite(value)) return raw
  if (Math.abs(value) >= 1e6) return formatSignificantDigits(value, 4)
  return groupThousands(raw)
}

// 兩個欄位值的升冪比較：數字比數字；讀不出數字的（例如日期字串）照字串比。null 由呼叫端決定放哪裡。
// 觀察清單的表格（el-table 的 sort-method）與手機卡片的排序選單共用（2026-10-08）。
export function compareFieldValues(x: string, y: string): number {
  const nx = Number(x)
  const ny = Number(y)
  return Number.isFinite(nx) && Number.isFinite(ny) ? nx - ny : x.localeCompare(y)
}
