import { initializeApp } from 'firebase/app'
import { getAnalytics, isSupported } from 'firebase/analytics'
import { getAuth, type User } from 'firebase/auth'
import firebaseCompat from 'firebase/compat/app'
import 'firebase/compat/auth'

export default defineNuxtPlugin(async () => {
  const { firebase: firebaseConfig } = useRuntimeConfig().public

  const app = initializeApp(firebaseConfig)
  const auth = getAuth(app)
  const analytics = (await isSupported()) ? getAnalytics(app) : null

  // FirebaseUI for Web only speaks the legacy compat API, and compat keeps its own app
  // registry separate from the modular one above — reusing the modular `app` object here
  // throws `app-compat/invalid-app-argument`, so compat needs its own `initializeApp` call.
  const compatApp = firebaseCompat.initializeApp(firebaseConfig)
  const compatAuth = firebaseCompat.auth(compatApp)

  // FirebaseUI drives sign-in through `compatAuth`, so that's the authoritative source for
  // login state; single app-lifetime subscription, useCurrentUser() just reads this state.
  const currentUser = useState<User | null>('firebase-current-user', () => null)
  compatAuth.onAuthStateChanged(user => {
    currentUser.value = user as User | null
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
