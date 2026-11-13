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
export const labelEachValue = (raw: string | number, labelOf: (value: string) => string | undefined) => String(raw).split('、').map(value => labelOf(value) ?? value).join('、')

// 一格數字的資料時間（2026-10-23，使用者：「顯示資料時間 那邊 近四季的資料可以一律用 26Q1 26Q2這種表示方式嗎? 這才是用戶真正關心的」）：
// 有財報期別就寫期別——單季、累計、近四季是最後那一季（"2026Q2" 寫成 26Q2，同「最新財報季別」的選項），年度是年份（"2025"），月頻是
// 月份（"2026-09"）；逐日、窗口型與即時的沒有期別（null），照舊寫那一天。期別是每格帶的 fiscalYear／fiscalQuarter／yearMonth
// （2026-11-04 數據中台把 fiscalPeriod 字串拆成數字），不從 knowledgeDate 推（每季更新的年度指標，2026Q2 公布時的值是 2025 年度的）
export const cellPeriodText = (cell: { knowledgeDate: string | null; fiscalYear?: number | null; fiscalQuarter?: number | null; yearMonth?: string | null }) =>
  cell.fiscalYear != null && cell.fiscalQuarter != null
    ? `${String(cell.fiscalYear).slice(-2)}Q${cell.fiscalQuarter}`
    : cell.yearMonth ?? (cell.fiscalYear != null ? String(cell.fiscalYear) : cell.knowledgeDate)

// 除權息月份的選項（特別股自己列；值是整數，同普通股、ETF 型錄給的選項，名稱同樣是「1 月」）
export const EX_DIVIDEND_MONTH_OPTIONS = Array.from({ length: 12 }, (_, index) => ({ value: index + 1, label: `${index + 1} 月` }))

// 類別選項（2026-10-23，analysis-ts 54e0699e）：最新財報季別的選項是相對值——value 是 latest、latest-1…latest-7、older，label 照樣
// 「26Q3」，fiscalYear＋fiscalQuarter 是實際季別（older 是 null）。格子的值 2026-11-04 起也是相對值；存檔與網址裡 10-23 以前的實際季別
// （"2026Q2"）靠這兩欄對回選項、換成相對值（不換的話業務中台回 400，見 useScreenerTabs 的 buildSlots）
export type ScreenerOption = { value: string | number; label: string; fiscalYear?: number | null; fiscalQuarter?: number | null }

// 類別條件送給業務中台時照型別送（2026-11-03 格式統一）：只有布林在畫面裡是 "true"／"false"（Element Plus 的勾選框群組不收布林），
// 送出前換回布林。其他值本來就是選項的型別（月份是整數，類股、季別代碼是字串）：網址與存檔讀回的字串先經 findScreenerOption 換成選項的值
export const wireValue = (value: string | number): string | number | boolean => (value === 'true' ? true : value === 'false' ? false : value)
export const wireFilters = <T extends { field: string; values?: (string | number)[] }>(filters: T[]) =>
  filters.map(filter => (filter.values ? { ...filter, values: filter.values.map(wireValue) } : filter))
export const findScreenerOption = (options: readonly ScreenerOption[] | null | undefined, raw: string | number): ScreenerOption | null =>
  options?.find(option => String(option.value) === String(raw) || (option.fiscalQuarter != null && `${option.fiscalYear}Q${option.fiscalQuarter}` === String(raw))) ?? null

// options：類別型欄位（型錄的 kind categorical，例如河道位置）的選項，選項的 value 是數字，用字串比對後顯示中文（破底…破頂）；
// 對不到的照原值（2026-10-21）。值：數值欄位是 JSON 數字，文字欄位是字串，照原樣顯示
export function formatScreenerValue(raw: string | number | null | undefined, unit: string | null | undefined, field?: string, options?: readonly ScreenerOption[] | null): string {
  if (raw === null || raw === undefined) return '－'
  if (options?.length) return labelEachValue(raw, value => findScreenerOption(options, value)?.label)
  if (typeof raw !== 'number') return raw
  if (field === 'dividendYield.EOD' && raw === 0) return NO_DIVIDEND_TEXT
  if (unit === '%') return minusSign(`${raw}%`)
  if (Math.abs(raw) >= 1e6) return formatSignificantDigits(raw, 4)
  return groupThousands(raw)
}

// 兩個欄位值的升冪比較：數字比數字，文字（例如日期）照字串比。null 由呼叫端決定放哪裡。
// 觀察清單的表格（el-table 的 sort-method）與手機卡片的排序選單共用（2026-10-08）。
// 選項帶財報年季的（最新財報季別）照時間比，「更早」最小：值是 latest、latest-1…，照字串比的話最新的 latest 最小（2026-11-14，使用者：
//「最新財報季別 由小到大排序 為什麼是 26Q3 在上面?」）
export function compareFieldValues(x: string | number, y: string | number, options?: readonly ScreenerOption[] | null): number {
  if (options?.some(option => option.fiscalYear != null)) {
    const rank = (value: string | number) => {
      const option = findScreenerOption(options, value)
      return option ? (option.fiscalYear ?? 0) * 10 + (option.fiscalQuarter ?? 0) : null
    }
    const [rx, ry] = [rank(x), rank(y)]
    if (rx !== null && ry !== null) return rx - ry
  }
  return typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))
}
