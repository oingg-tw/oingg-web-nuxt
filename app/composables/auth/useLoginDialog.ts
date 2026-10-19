// Shared visibility flag for the single global <LoginDialog/> mounted once in app.vue —
// lets any component (UserMenuButton, or a gated "+" action like screener.vue's) open the
// same login flow without each owning its own firebaseui instance.
// reason（2026-10-20）：為什麼要登入的一句話，顯示在對話框裡（分享頁「存成觀察清單」用它誘導註冊）。open 常直接當 @click 用，
// 第一個參數會是事件物件，所以只收字串。
export function useLoginDialog() {
  const visible = useState('login-dialog-visible', () => false)
  const reason = useState<string | null>('login-dialog-reason', () => null)
  return {
    visible,
    reason,
    open: (why?: unknown) => {
      reason.value = typeof why === 'string' ? why : null
      visible.value = true
    },
    close: () => { visible.value = false }
  }
}
