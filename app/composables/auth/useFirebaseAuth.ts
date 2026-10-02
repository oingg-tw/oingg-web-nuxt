import type firebaseCompat from 'firebase/compat/app'

// Only needed to hand off to FirebaseUI, which speaks the legacy compat API.
export function useFirebaseCompatAuth() {
  return useNuxtApp().$firebaseCompatAuth as firebaseCompat.auth.Auth
}
