import { initializeApp } from 'firebase/app'
import { getAnalytics, isSupported } from 'firebase/analytics'
import { getAuth, type User } from 'firebase/auth'
import firebaseCompat from 'firebase/compat/app'
import 'firebase/compat/auth'

export default defineNuxtPlugin(async () => {
  const { firebase: firebaseConfig } = useRuntimeConfig().public

  const app = initializeApp(firebaseConfig)
  const auth = getAuth(app)
  // 本機開發（pnpm dev）不送 GA：自己點來點去和 Playwright 檢查都不該算進流量（使用者 2026-10-16）。部署的建置照送，ID 跟環境走
  const analytics = !import.meta.dev && (await isSupported()) ? getAnalytics(app) : null

  // FirebaseUI for Web only speaks the legacy compat API, and compat keeps its own app
  // registry separate from the modular one above — reusing the modular `app` object here
  // throws `app-compat/invalid-app-argument`, so compat needs its own `initializeApp` call.
  const compatApp = firebaseCompat.initializeApp(firebaseConfig)
  const compatAuth = firebaseCompat.auth(compatApp)

  // FirebaseUI drives sign-in through `compatAuth`, so that's the authoritative source for
  // login state; single app-lifetime subscription, useCurrentUser() just reads this state.
  const currentUser = useState<User | null>('firebase-current-user', () => null)
  // Separate from currentUser being non-null — this flips true the first time
  // onAuthStateChanged fires AT ALL, including a real "signed out" resolution (currentUser
  // stays null in that case, so watching currentUser alone can't tell "not signed in" apart
  // from "haven't checked yet"). onAuthStateChanged's callback is always asynchronous, even
  // for a warm/cached session — see useAuthResolved.ts for why callers need this.
  const authResolved = useState('firebase-auth-resolved', () => false)
  compatAuth.onAuthStateChanged(user => {
    currentUser.value = user as User | null
    authResolved.value = true
  })

  return {
    provide: {
      firebaseApp: app,
      firebaseAuth: auth,
      firebaseCompatAuth: compatAuth,
      firebaseAnalytics: analytics
    }
  }
})
