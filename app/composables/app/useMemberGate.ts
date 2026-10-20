// 會員頁先畫哪一層（2026-10-20，使用者：「載入之前，可以讓用戶看的出來畫面結構」「然後不要閃動」）：登入狀態還沒確定（伺服器、
// hydration、Firebase 還原中）時，這台瀏覽器登入過（auth-hint，firebase.client.ts）就先畫內容的結構，沒登入過就畫訪客的樣子——兩種都從
// 伺服器的第一個畫面就是對的。等 hydration 而不是只看 authResolved：Firebase 可能在 hydration 前就解析完，瀏覽器的第一次渲染要跟伺服器
// 一樣（2026-10-05 Hydration node mismatch）。持股頁的外殼（HoldingsPageShell）與觀察清單兩頁共用
export function useMemberGate() {
  const hasHydrated = useHasHydrated()
  const authResolved = useAuthResolved()
  const currentUser = useCurrentUser()
  const authHint = useCookie<boolean | null>('auth-hint')
  const resolving = computed(() => !hasHydrated.value || !authResolved.value)
  const member = computed(() => (resolving.value ? !!authHint.value : !!currentUser.value))
  return { resolving, member }
}
