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
