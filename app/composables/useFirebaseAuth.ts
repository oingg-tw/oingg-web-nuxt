import type { Auth } from 'firebase/auth'
import type firebaseCompat from 'firebase/compat/app'

export function useFirebaseAuth() {
  return useNuxtApp().$firebaseAuth as Auth
}

// Only needed to hand off to FirebaseUI, which speaks the legacy compat API.
export function useFirebaseCompatAuth() {
  return useNuxtApp().$firebaseCompatAuth as firebaseCompat.auth.Auth
}
