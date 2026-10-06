import { h } from 'vue'
import { ElMessage } from 'element-plus'

// 長輩的閱讀速度：從看到提示到找到「復原」要時間。這是校準旋鈕，不是隨手的數字。
export const UNDO_WINDOW_MS = 10_000

// 「已刪除…／復原」提示：持股頁（刪除、匯入、清除全部）與觀察清單（移除）共用。按鈕掛載時取得焦點——
// 觸發它的那顆按鈕（刪除鈕跟著那一列消失、匯入對話框關了）已經不在，焦點若不移到這裡，鍵盤使用者會被
// 丟回頁首、找不到復原。onClose 在逾時、Esc、或按了復原之後都會跑，呼叫端用它送出真正的刪除。
export function undoToast(text: string, onUndo: () => void, onClose: () => void) {
  const instance = ElMessage({
    type: 'info',
    duration: UNDO_WINDOW_MS,
    showClose: false,
    message: h('span', { class: 'app-undo-toast' }, [
      h('span', text),
      h('button', {
        type: 'button',
        class: 'app-undo-toast__action',
        // 晚一個畫面再 focus：ElMessage 掛載內容時外層還是 v-show 隱藏的（它在自己的 onMounted 才設為
        // 顯示），對隱藏元素 focus() 會靜默失敗。2026-10-06 量到焦點一直停在 body——持股頁從一開始就
        // 是這樣，只是沒被測到。
        onVnodeMounted: (vnode: { el: unknown }) => requestAnimationFrame(() => (vnode.el as HTMLElement | null)?.focus()),
        onClick: () => {
          onUndo()
          instance.close()
        }
      }, '復原')
    ]),
    onClose
  })
  return instance
}
