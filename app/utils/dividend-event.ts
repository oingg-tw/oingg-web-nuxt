// 除權息類型的讀法（2026-10-17 從觀察清單抽出，持股的配息日程共用）：上游的 exType 是「息／權／權息」
export const EX_TYPE_LABELS: Record<string, string> = { 息: '除息', 權: '除權', 權息: '除權息' }

// 這些日期（YYYY-MM-DD）有沒有週六、週日：沒有的話配息月曆不畫那兩欄（main.css 的 .app-calendar--weekdays，理由寫在那裡）
export const hasWeekendDate = (days: Iterable<string>): boolean => [...days].some(day => [0, 6].includes(new Date(`${day}T00:00:00Z`).getUTCDay()))
