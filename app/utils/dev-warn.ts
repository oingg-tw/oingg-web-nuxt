// 開發模式的「上游這一支讀不到」警告，一份（2026-10-02）。
//
// 它原本在 32 個檔案裡各寫一次同樣的四行：`if (import.meta.dev)` 包住一個把 unknown 窄化成字串的
// 三元式，再 console.warn 一個 `[tag] ... (${reason})` 的訊息。那個三元式
// （`error instanceof Error ? error.message : String(error)`）全 repo 出現 42 次。
//
// 為什麼是 dev-only：這些呼叫端的契約都是「樂觀抓取、優雅退場」——上游讀不到就回 null 或退到
// 備援值，畫面自己會處理。正式環境不需要在 console 裡吵，但開發時沒有這一行會很難查「為什麼這張卡
// 是空的」。
//
// `suffix` 不是為假想需求留的參數：32 個呼叫端裡有 8 個在 `(${reason})` 之後還要接一句
// （「, using fallback instead」「, using sample schema instead」），那句話說的是「所以我們改用什麼」，
// 跟失敗原因是兩件事，位置不能互換。其餘 24 個不傳。
export function devWarn(tag: string, what: string, error: unknown, suffix = ''): void {
  if (!import.meta.dev) return
  const reason = error instanceof Error ? error.message : String(error)
  console.warn(`[${tag}] ${what} (${reason})${suffix}`)
}
