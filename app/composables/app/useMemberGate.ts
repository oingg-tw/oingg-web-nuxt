// 會員頁先畫哪一層（2026-10-20，使用者：「載入之前，可以讓用戶看的出來畫面結構」「然後不要閃動」）：登入狀態還沒確定（伺服器、
// hydration、Firebase 還原中）時，這台瀏覽器登入過（auth-hint，firebase.client.ts）就先畫內容的結構，沒登入過就畫訪客的樣子——兩種都從
// 伺服器的第一個畫面就是對的。等 hydration 而不是只看 authResolved：Firebase 可能在 hydration 前就解析完，瀏覽器的第一次渲染要跟伺服器
// 一樣（2026-10-05 Hydration node mismatch）。持股頁的外殼（HoldingsPageShell）、觀察清單兩頁與普通股篩選的選範本共用
export function useMemberGate() {
  const hasHydrated = useHasHydrated()
  const authResolved = useAuthResolved()
  const currentUser = useCurrentUser()
  const authHint = useAuthHint()
  const resolving = computed(() => !hasHydrated.value || !authResolved.value)
  const member = computed(() => (resolving.value ? authHint.value : !!currentUser.value))
  return { resolving, member }
}

// auth-hint 取伺服器那一刻看到的值（隨頁面資料帶到瀏覽器，2026-11-13）：Firebase 在 hydration 前就還原完時會改寫這個 cookie，Chrome 的
// cookieStore 馬上同步到每一個 useCookie，提示過期（cookie 說登入過、其實沒登入）的瀏覽器第一次渲染就跟伺服器不一樣——持股、觀察清單、
// 篩選頁都量到 Hydration mismatch。新的值下一次載入才用
export function useAuthHint() {
  return useState('auth-hint-at-load', () => !!useCookie<boolean | null>('auth-hint').value)
}
