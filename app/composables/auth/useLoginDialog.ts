// Shared visibility flag for the single global <LoginDialog/> mounted once in app.vue —
// lets any component (UserMenuButton, or a gated "+" action like screener.vue's) open the
// same login flow without each owning its own firebaseui instance.
export function useLoginDialog() {
  const visible = useState('login-dialog-visible', () => false)
  return {
    visible,
    open: () => { visible.value = true },
    close: () => { visible.value = false }
  }
}
