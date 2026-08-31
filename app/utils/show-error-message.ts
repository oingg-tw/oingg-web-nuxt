// Every error toast in this app goes through this instead of calling ElMessage.error(...)
// directly. ElMessage's default 3s auto-dismiss doesn't give anyone time to actually read a
// real backend failure (e.g. `{"error":{"message":"Metric \"nissimPenmanRnoa\" isn't wired
// up to the analysis database yet"}}`) and act on it — who do they tell, what's actually
// broken. duration: 0 + showClose: true means it stays on screen until the user closes it
// themselves.
// Not named showError — that collides with Nuxt's own built-in showError() (navigates to
// the error page), an unrelated thing.
export function showErrorMessage(message: string) {
  ElMessage.error({ message, duration: 0, showClose: true })
}
