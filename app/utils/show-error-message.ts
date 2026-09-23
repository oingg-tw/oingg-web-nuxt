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
// OUR OWN CLOSE BUTTON, not `showClose: true`（2026-09-23,「那個把訊息關掉的按鈕實在突兀地傷眼
// 睛」）. Element Plus renders its own close as an `<ElIcon>` — an `<i>` with a click handler,
// read straight from its compiled source. That is not focusable and carries no accessible name,
// and paired with `duration: 0` it meant a keyboard-only reader got a toast that never goes away
// and cannot be dismissed. So the visual complaint and a real WCAG 2.1.1 failure had the same
// fix: render a REAL button we own.
//
// Owning it also means not fighting Element Plus's own close styling. Its `<i>` is a bare 16px
// glyph in a cold grey（#67696d, measured）pressed against the message text on a warm pink field
// — no hit area, no hover, no container. Ours is a 44px round target that only tints on hover,
// in the app's own --el-text-color-regular（measured at 5.2–5.7:1 on all four message fills, vs
// the per-type text token which would have dropped warning to 2.04:1 and info to 2.80:1）.
export function showErrorMessage(message: string) {
  const instance = ElMessage.error({
    duration: 0,
    showClose: false,
    message: h('span', { class: 'app-toast' }, [
      h('span', { class: 'app-toast__text' }, message),
      h('button', {
        type: 'button',
        class: 'app-toast__close',
        'aria-label': '關閉訊息',
        onClick: () => instance.close()
      }, h(ElIcon, null, () => h(Close)))
    ])
  })
  return instance
}
