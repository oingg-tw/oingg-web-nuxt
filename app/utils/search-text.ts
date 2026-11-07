// 搜尋的比對鍵（2026-10-23，使用者：「週轉 周轉 在指標搜尋上要讓它都可以搜尋到」）：型錄與頁面多寫「週轉」，常有人打「周轉」。
// 比對的兩邊（查詢字與名稱、別名、說明）都先換成同一個鍵再比：英文不分大小寫，全形字換半形（２３３０），異體字換成同一個寫法（臺／台：
// 站上是 台積電、臺企銀，兩種都有人打）。指標挑選器（篩選、觀察清單、自訂欄位）、個股的指標總覽、大師徽章、股票搜尋、除權息月覽共用。
// 之後有別的異體字加在這張表。
// 跟中文相鄰的空白不算（2026-11-04，型錄名稱統一成「營收 3 年複合成長率」，打「營收3年」要對得到）。英文字之間的留著：
// ScreenerIndicatorPickerBody 的 nameEnMatches 靠空白認出「book value」這種多字查詢。不用 lookbehind：Safari 16.4 以前整支 JS 會解析失敗
const VARIANTS: [RegExp, string][] = [[/周/g, '週'], [/臺/g, '台'], [/\s+(\p{Script=Han})/gu, '$1'], [/(\p{Script=Han})\s+/gu, '$1']]

export function searchKey(text: string): string {
  let key = text.normalize('NFKC').trim().toLowerCase()
  for (const [pattern, replacement] of VARIANTS) key = key.replace(pattern, replacement)
  return key
}

// 股票搜尋的比對與排序（2026-11-07，全市場 2,734 檔實測：打 878 找不到 00878、打 56 找不到 0056，打「中信」時中信金排在幾十檔 ETF 後面）。
// 代號開頭的零可以不打。排序：代號完全相同 → 去掉開頭的零後相同（6201 不能輸給 006201）→ 代號開頭相同 → 名稱開頭相同 → 名稱裡有。
// 代號也換小寫：特別股帶字母（1101B），打 1101b 要對得到
function stockRank(entry: { code: string; name: string }, query: string): number | null {
  const code = entry.code.toLowerCase()
  const bare = code.replace(/^0+/, '')
  const name = searchKey(entry.name)
  if (code === query) return 0
  if (bare === query) return 1
  if (code.startsWith(query)) return 2
  if (bare.startsWith(query)) return 3
  if (name.startsWith(query)) return 4
  return name.includes(query) ? 5 : null
}

// 名稱比中的，短的在前：公司本身通常比它的 ETF、特別股短
export function searchStocks<T extends { code: string; name: string }>(entries: T[], text: string): T[] {
  const query = searchKey(text)
  if (!query) return []
  return entries
    .flatMap((entry) => {
      const rank = stockRank(entry, query)
      return rank === null ? [] : [{ entry, rank }]
    })
    .sort((a, b) => a.rank - b.rank || (a.rank >= 4 ? a.entry.name.length - b.entry.name.length : 0) || a.entry.code.localeCompare(b.entry.code))
    .map(({ entry }) => entry)
}
