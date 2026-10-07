export type ContentWidthMode = 'full' | 'centered'

// 主內容區（layouts/default.vue 的 .app-shell__content）是滿版（"full"）還是置中的固定欄（"centered"）。開關在外觀設定頁
// （2026-09-17 從頁首搬過去）——它是全站外觀，不是篩選器專屬設定。
// 薄薄的 string↔boolean 轉接層，包著 useAppTheme 的 cookie＋帳號同步的 fullWidth（bff-ts 把 isFullWidth 跟 mode／accentColor／
// marketColorConvention 一起放在 GET/PUT /users/me/theme，2026-09-01），SSR 正確、跨裝置同步；保留獨立 composable 只是為了讓
// 呼叫端沿用 'full'／'centered' 這組字串（el-switch 的 active-value／inactive-value、=== 'centered' 的判斷）。
export function useContentWidthMode() {
  const { fullWidth, setFullWidth } = useAppTheme()

  return computed<ContentWidthMode>({
    get: () => (fullWidth.value ? 'full' : 'centered'),
    set: next => setFullWidth(next === 'full')
  })
}
