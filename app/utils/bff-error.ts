// bff-ts 的錯誤回應裡那句人看得懂的訊息，一份（2026-10-02）。
//
// 它原本在 6 支「同步到帳號」的 composable 裡各寫一份逐字相同的拷貝（useUserDashboardCards、
// useScreenerColumnPresets、useScreenerPresets、useScreenerTemplates、
// useUserStockDetailPreferences、useUserTheme）。
//
// 四層窄化不是防衛性過頭：`error` 是 unknown，而 bff 的訊息藏在 `error.data.error.message`，
// 中間每一層都可能不是物件（網路層的失敗根本沒有 data）。少一層就會在那種失敗上丟 TypeError，
// 而這些呼叫端的契約正是「同步失敗不要把畫面弄壞」。
//
// 回傳 null 而不是一個預設字串：呼叫端要分得出「上游給了理由」與「這是一次沒有理由的失敗」，
// 前者可以顯示給使用者，後者只能寫進 console。
export function describeBffError(error: unknown): string | null {
  if (!error || typeof error !== 'object' || !('data' in error)) return null
  const data = (error as { data?: unknown }).data
  if (!data || typeof data !== 'object' || !('error' in data)) return null
  const inner = (data as { error?: unknown }).error
  if (!inner || typeof inner !== 'object' || !('message' in inner)) return null
  const message = (inner as { message?: unknown }).message
  return typeof message === 'string' ? message : null
}

// 同一個錯誤的 HTTP 狀態碼。2026-10-05 從 useUserWatchlist.ts 搬過來：持股管理是第二個需要分辨
// 409（重複）／404（不存在）的呼叫端。
//
// 名字刻意不叫 statusOf：app/utils 的 export 會被自動匯入到整個 app，通名遲早被某個檔案的同名區域
// 函式靜默遮蔽——那正是這一天稍早 REQUEST_TIMEOUT_MS 能並存九份沒人發現的原因。
export function bffErrorStatus(error: unknown): number | null {
  if (!error || typeof error !== 'object') return null
  const status = (error as { statusCode?: unknown; status?: unknown }).statusCode ?? (error as { status?: unknown }).status
  return typeof status === 'number' ? status : null
}

// bff-ts 的 `error.code`：只有少數錯誤帶，而帶了就是那個回應裡唯一穩定的部分（訊息的措辭不保證）。
// 第一個用到的是持股的賣超（"LEDGER_OVERSOLD"，bff-ts f3388fd）。
export function bffErrorCode(error: unknown): string | null {
  const data = error && typeof error === 'object' ? (error as { data?: unknown }).data : null
  const inner = data && typeof data === 'object' ? (data as { error?: unknown }).error : null
  const code = inner && typeof inner === 'object' ? (inner as { code?: unknown }).code : null
  return typeof code === 'string' ? code : null
}
