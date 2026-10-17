// Google Analytics 要先問過才載（2026-10-18，治理盤點：「GA4 未經同意就載入」；使用者看了草稿：「先做功能」）。
// Google Analytics 的條款要求告知使用者存放了 Cookie、讓使用者選擇同意或拒絕。
//
// 選擇存在 cookie（同 useAppTheme 的 theme-* 一年）：伺服器讀得到，已經選過的人第一個畫面就不會閃出橫幅。
// 只在真的會送分析的地方問——部署的建置、而且設了 measurementId；本機開發本來就不送（firebase.client.ts），問了沒有意義。
//
// 拒絕或撤回時把 Google Analytics 已經放的 cookie（_ga、_ga_<容器>）清掉：只是不再載入的話，舊的識別碼還留在瀏覽器裡。
export type AnalyticsConsent = 'granted' | 'denied'

const ONE_YEAR = 60 * 60 * 24 * 365

export function useAnalyticsConsent() {
  const cookie = useCookie<AnalyticsConsent | null>('analytics-consent', { default: () => null, maxAge: ONE_YEAR, sameSite: 'lax' })
  // 每次呼叫 useCookie 都是一個新的 ref，彼此不會在同一個 tick 同步（頁尾按「Cookie 設定」後，橫幅那一份還沒變、焦點移不過去）：
  // 共用一份 useState，寫的時候兩邊一起寫
  const consent = useState<AnalyticsConsent | null>('analytics-consent', () => cookie.value)
  const asks = !import.meta.dev && !!useRuntimeConfig().public.firebase.measurementId

  function clearAnalyticsCookies() {
    if (!import.meta.client) return
    // GA 把 cookie 設在最上層網域（.oingg.com），也可能在目前的主機名稱上；兩個都清
    const host = location.hostname
    const domains = ['', host, `.${host.split('.').slice(-2).join('.')}`]
    for (const name of document.cookie.split(';').map(part => part.split('=')[0]!.trim()).filter(name => name === '_ga' || name.startsWith('_ga_'))) {
      for (const domain of domains) document.cookie = `${name}=; Max-Age=0; path=/${domain ? `; domain=${domain}` : ''}`
    }
  }

  function setConsent(value: AnalyticsConsent | null) {
    if (value !== 'granted') clearAnalyticsCookies()
    cookie.value = value
    consent.value = value
  }

  return { consent, asks, setConsent }
}
