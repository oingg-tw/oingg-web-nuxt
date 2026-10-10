// 景氣時鐘（2026-10-11，「設計圖表幫助用戶判讀自己在景氣時鐘或是景氣循環的哪個階段」）。OECD Business Cycle Clock 的
// 四區：橫軸是指標的去趨勢值（100＝長期趨勢），縱軸是比上個月的變動。區域名稱是那張圖的定義，不是本站對景氣下的判斷——
// 頁面一律寫成「落在『高於趨勢、仍在上升』那一區（OECD 稱為擴張）」，並標出是哪一個月的數字（合規：非擇時工具）。
// 沒有 import：scripts/check-business-cycle-clock.mjs 直接用 Node 載入這個檔案。
export type ClockZone = 'expansion' | 'slowdown' | 'contraction' | 'recovery'

export const CLOCK_ZONES: Record<ClockZone, { name: string; definition: string }> = {
  expansion: { name: '擴張', definition: '高於趨勢、仍在上升' },
  slowdown: { name: '趨緩', definition: '高於趨勢、開始下降' },
  contraction: { name: '衰退', definition: '低於趨勢、仍在下降' },
  recovery: { name: '復甦', definition: '低於趨勢、開始上升' }
}

// 剛好等於 100 算「高於」、月變動剛好 0 算「上升」：兩者在四位小數的資料裡幾乎不會發生，只是要有一個確定的答案
export function clockZone(level: number, change: number): ClockZone {
  if (level >= 100) return change >= 0 ? 'expansion' : 'slowdown'
  return change >= 0 ? 'recovery' : 'contraction'
}
