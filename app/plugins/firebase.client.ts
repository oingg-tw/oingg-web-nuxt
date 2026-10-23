import { initializeApp } from 'firebase/app'
import { getAuth, onAuthStateChanged, type User } from 'firebase/auth'

export default defineNuxtPlugin(() => {
  const { firebase: firebaseConfig } = useRuntimeConfig().public

  const app = initializeApp(firebaseConfig)
  const auth = getAuth(app)
  // GA：本機開發（pnpm dev）不送，自己點來點去和 Playwright 檢查都不該算進流量（使用者 2026-10-16）；部署的建置照送，ID 跟環境走。
  // 等頁面接手完成、瀏覽器閒下來才載（onNuxtReady），firebase/analytics 也改成動態載入：原本外掛 await isSupported()，Nuxt 要等
  // 外掛跑完才接手頁面，gtag 的下載與執行也擠在第一個畫面之前（2026-10-16 DEV 的 Lighthouse，手機每頁約 130 ms）
  // 2026-10-18 起還要使用者按過「接受」（useAnalyticsConsent，橫幅在 AppConsentBanner）；當下才按的，按了就載
  const { consent, asks } = useAnalyticsConsent()
  if (asks) {
    let started = false
    const start = async () => {
      if (started) return
      started = true
      const { getAnalytics, isSupported } = await import('firebase/analytics')
      if (await isSupported()) getAnalytics(app)
    }
    onNuxtReady(() => {
      if (consent.value === 'granted') void start()
      watch(consent, value => { if (value === 'granted') void start() })
    })
  }

  // 登入狀態的來源是 modular 的 Auth（2026-10-16 起）。FirebaseUI 只會用 compat API，但 compat 只在打開登入視窗時才載入
  // （loadFirebaseCompatAuth）：原本在這裡靜態 import，compat 的 app＋auth 就包進每一頁都要下載、執行的入口檔（DEV 的
  // Lighthouse 量到入口 173 KiB）。compat 用同一份設定初始化時包的是同一個 [DEFAULT] app、沿用 getAuth 已經建好的那一個
  // Auth，所以 FirebaseUI 登入後，這裡的監聽一樣會觸發。single app-lifetime subscription, useCurrentUser() just reads this state.
  const currentUser = useState<User | null>('firebase-current-user', () => null)
  // Separate from currentUser being non-null — this flips true the first time
  // onAuthStateChanged fires AT ALL, including a real "signed out" resolution (currentUser
  // stays null in that case, so watching currentUser alone can't tell "not signed in" apart
  // from "haven't checked yet"). onAuthStateChanged's callback is always asynchronous, even
  // for a warm/cached session — see useAuthResolved.ts for why callers need this.
  const authResolved = useState('firebase-auth-resolved', () => false)
  // 這台瀏覽器有沒有登入中的帳號（2026-10-20，使用者：「重新整理的時候會閃動」）：登入狀態只在瀏覽器、要等 Firebase 非同步還原，
  // 伺服器不知道，頁首原本先畫「登入」、還原後才換成頭像。這個 cookie 只是給畫面的提示（不是憑證、不帶身分），讓頁首先留一個頭像大小
  // 的空位（UserMenuButton）
  const authHint = useCookie<boolean | null>('auth-hint', { maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' })
  onAuthStateChanged(auth, user => {
    currentUser.value = user
    authResolved.value = true
    authHint.value = user ? true : null
  })

  return {
    provide: {
      firebaseAuth: auth
    }
  }
})
