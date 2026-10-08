import type { MarketConvention, ThemeColor, ThemeMode } from '~/composables/theme/useAppTheme'

// 包 bff-ts 的主題偏好契約（2026-08-31 實測）：GET 一次回全部欄位（包在 { theme } 裡，不是平的），每個欄位各有單欄 PUT。
export interface UserThemePreferences {
  mode: ThemeMode
  accentColor: ThemeColor
  marketColorConvention: MarketConvention
  // 2026-09-01 加的，同樣的 GET／單欄 PUT 形狀。DB 欄位可為 null 但 API 永遠先解析成預設值（true，對齊本站的實際版面）才回
  isFullWidth: boolean
}

type ThemeField = 'mode' | 'accent-color' | 'market-color-convention' | 'full-width'

// 同步失敗不彈錯誤訊息：主題在 setMode／setColor／setMarket 那一刻已經套在本地了，失敗只代表這台裝置的選擇這次沒存到帳號，
// 下一次成功的同步會補上。背景的偏好儲存不值得用 toast 打斷使用者。
export function useUserTheme() {
  const currentUser = useCurrentUser()
  const authedFetch = useAuthedFetch()

  async function fetchTheme(): Promise<UserThemePreferences | null> {
    if (!currentUser.value) return null
    try {
      const response = await authedFetch<{ theme: UserThemePreferences }>('/users/me/theme')
      return response.theme
    } catch (error) {
      devWarn('user-theme', 'GET /users/me/theme failed', error)
      return null
    }
  }

  // 單欄 PUT /users/me/theme/<field>，body 是 { <欄位名>: 值 }
  async function putTheme(field: ThemeField, body: Partial<UserThemePreferences>): Promise<boolean> {
    if (!currentUser.value) return false
    try {
      await authedFetch(`/users/me/theme/${field}`, { method: 'PUT', body })
      return true
    } catch (error) {
      devWarn('user-theme', `PUT /users/me/theme/${field} failed`, error)
      return false
    }
  }

  return { fetchTheme, putTheme }
}
