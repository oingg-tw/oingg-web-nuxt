// 指標搜尋的比對鍵（2026-10-23，使用者：「週轉 周轉 在指標搜尋上要讓它都可以搜尋到」）：型錄與頁面多寫「週轉」，常有人打「周轉」。
// 比對的兩邊（查詢字與名稱、別名、說明）都先換成同一個鍵再比：英文不分大小寫，異體字換成同一個寫法。指標挑選器（篩選、觀察清單、
// 自訂欄位）、個股的指標總覽、大師徽章共用。之後有別的異體字（臺／台…）加在這張表
const VARIANTS: [RegExp, string][] = [[/周/g, '週']]

export function searchKey(text: string): string {
  let key = text.trim().toLowerCase()
  for (const [pattern, replacement] of VARIANTS) key = key.replace(pattern, replacement)
  return key
}
