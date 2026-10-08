import { h } from 'vue'
import { ElMessage } from 'element-plus'

// 長輩的閱讀速度：從看到提示到找到「復原」要時間。這是校準旋鈕，不是隨手的數字。
export const UNDO_WINDOW_MS = 10_000

// 「已刪除…／復原」提示：持股頁（刪除、匯入、清除全部、自訂欄位）、觀察清單（移除）、指標速覽（刪除）共用。
// 按鈕掛載時取得焦點——觸發它的那顆按鈕（刪除鈕跟著那一列消失、匯入對話框關了）已經不在，焦點若不移到這裡，
// 鍵盤使用者會被丟回頁首、找不到復原。onClose 在逾時、Esc、或按了復原之後都會跑，呼叫端用它送出真正的刪除。
//
// 倒數自己管（2026-10-07 a11y 盤點，WCAG 2.2.1）：ElMessage 內建的計時只在滑鼠停留時暫停，鍵盤焦點在提示裡
// 不會停。現在滑鼠停留或焦點在提示裡都暫停，兩者都離開才繼續倒數。焦點一開始就在「復原」上，所以鍵盤使用者
// 不離開就不會被收走；按 Tab 離開後才開始那 10 秒。
// 提示關掉時，如果焦點原本在提示裡（或已經掉到 <body>），移到頁面的 h1，不讓鍵盤使用者回到頁首重新找。
export function undoToast(text: string, onUndo: () => void, onClose: () => void) {
  let remaining = UNDO_WINDOW_MS
  let startedAt = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  let hovered = false
  let focused = false
  let root: HTMLElement | null = null

  const run = () => {
    if (timer !== undefined || hovered || focused) return
    startedAt = Date.now()
    timer = setTimeout(() => instance.close(), remaining)
  }
  const pause = () => {
    if (timer === undefined) return
    clearTimeout(timer)
    timer = undefined
    remaining = Math.max(0, remaining - (Date.now() - startedAt))
  }

  const instance = ElMessage({
    type: 'info',
    duration: 0,
    showClose: false,
    message: h('span', {
      class: 'app-toast',
      onMouseenter: () => { hovered = true; pause() },
      onMouseleave: () => { hovered = false; run() },
      onFocusin: () => { focused = true; pause() },
      onFocusout: () => { focused = false; run() }
    }, [
      h('span', { class: 'app-toast__text' }, text),
      h('button', {
        type: 'button',
        class: 'app-toast__action',
        // 晚一個畫面再 focus：ElMessage 掛載內容時外層還是 v-show 隱藏的（它在自己的 onMounted 才設為
        // 顯示），對隱藏元素 focus() 會靜默失敗。2026-10-06 量到焦點一直停在 body——持股頁從一開始就
        // 是這樣，只是沒被測到。
        onVnodeMounted: (vnode: { el: unknown }) => requestAnimationFrame(() => {
          const button = vnode.el as HTMLElement | null
          root = button?.closest('.el-message') ?? null
          button?.focus()
        }),
        onClick: () => {
          onUndo()
          instance.close()
        }
      }, '復原')
    ]),
    onClose: () => {
      clearTimeout(timer)
      const active = document.activeElement
      if (!active || active === document.body || root?.contains(active)) {
        const heading = document.querySelector<HTMLElement>('main h1, h1')
        if (heading) {
          if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1')
          heading.focus()
        }
      }
      onClose()
    }
  })
  run()
  return instance
}
