import { h } from 'vue'
import { ElIcon, ElMessage } from 'element-plus'
import { Close } from '@element-plus/icons-vue'

// Every error toast in this app goes through this instead of calling ElMessage.error(...)
// directly. ElMessage's default 3s auto-dismiss doesn't give anyone time to actually read a
// real backend failure (e.g. `{"error":{"message":"Metric \"nissimPenmanRnoa\" isn't wired
// up to the analysis database yet"}}`) and act on it — who do they tell, what's actually
// broken. duration: 0 means it stays on screen until the user closes it themselves.
// Not named showError — that collides with Nuxt's own built-in showError() (navigates to
// the error page), an unrelated thing.
//
// 本站自己的關閉鈕，不用 showClose（2026-09-23「那個把訊息關掉的按鈕實在突兀地傷眼睛」）：Element Plus 的關閉鈕是 <i>，
// 不可聚焦、沒有名字，配上 duration: 0 等於鍵盤使用者關不掉（WCAG 2.1.1）。外觀見 main.css 的全站提示段落。
export function toastCloseButton(close: () => void) {
  return h('button', { type: 'button', class: 'app-toast__close', 'aria-label': '關閉訊息', onClick: close }, h(ElIcon, null, () => h(Close)))
}

export function showErrorMessage(message: string) {
  const instance = ElMessage.error({
    duration: 0,
    showClose: false,
    message: h('span', { class: 'app-toast' }, [
      h('span', { class: 'app-toast__text' }, message),
      toastCloseButton(() => instance.close())
    ])
  })
  return instance
}
