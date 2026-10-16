import type { Auth } from 'firebase/auth'
import type firebaseCompat from 'firebase/compat/app'

// modular 的 Auth（firebase.client.ts 建的那一個）：登出等一般操作用這個
export function useFirebaseAuth() {
  return useNuxtApp().$firebaseAuth as Auth
}

// FirebaseUI 只會用 compat API，所以只有登入視窗需要 compat——打開時才動態載入（2026-10-16），不再包進每一頁的入口檔。
// 用同一份設定初始化，包的是同一個 [DEFAULT] app、沿用 getAuth 已經建好的那一個 Auth，FirebaseUI 登入後 modular 的狀態跟著變。
// 已經有 compat app 就沿用（compat 自己另有一份 app 清單，重複 initializeApp 會報 duplicate-app）。promise 留在模組層級：
// 重複打開登入視窗不會再載一次
let compatAuthPromise: Promise<firebaseCompat.auth.Auth> | null = null

export function loadFirebaseCompatAuth(): Promise<firebaseCompat.auth.Auth> {
  const { firebase: firebaseConfig } = useRuntimeConfig().public
  compatAuthPromise ??= Promise.all([import('firebase/compat/app'), import('firebase/compat/auth')]).then(([{ default: compat }]) => {
    const compatApp = compat.apps.length ? compat.app() : compat.initializeApp(firebaseConfig)
    return compat.auth(compatApp)
  })
  return compatAuthPromise
}
