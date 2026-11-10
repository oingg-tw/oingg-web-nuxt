import { h, ref } from 'vue'
import { ElMessage } from 'element-plus'

// 長輩的閱讀速度：從看到提示到找到「復原」要時間。這是校準旋鈕，不是隨手的數字。
export const UNDO_WINDOW_MS = 10_000

// 「已刪除…／復原」提示：持股頁（刪除、匯入、清除全部、自訂欄位）、觀察清單（移除）、指標速覽（刪除）、帳戶與清單管理共用。
// 按鈕掛載時取得焦點——觸發它的那顆按鈕（刪除鈕跟著那一列消失、匯入對話框關了）已經不在，焦點若不移到這裡，
// 鍵盤使用者會被丟回頁首、找不到復原。onClose 在逾時、Esc、或按了復原之後都會跑，呼叫端用它送出真正的刪除。
//
// 倒數自己管（2026-10-07 a11y 盤點，WCAG 2.2.1）：ElMessage 內建的計時只在滑鼠停留時暫停，鍵盤焦點在提示裡不會停。
// 現在滑鼠停在提示上、或鍵盤焦點在提示裡都暫停，離開才繼續倒數；鍵盤使用者焦點一開始就在「復原」上，不離開就不會被收走。
// 剩幾秒寫在「復原」旁邊（2026-10-22，使用者：「移除 以後 跳出的 復原 要給倒數」），不唸出來（按鈕的名稱還是「復原」）。
// 同一天起焦點只有「鍵盤的」才暫停（:focus-visible）：原本任何焦點都停，而焦點一開始就被移到「復原」，於是用滑鼠、手指移除的人
// 在點別的地方之前倒數根本沒開始——秒數寫出來會一直停在 10。「停在上面」也只認滑鼠：手機點一下會觸發 mouseenter、卻等不到離開。
// 提示關掉時，如果焦點原本在提示裡（或已經掉到 <body>），移到頁面的 h1，不讓鍵盤使用者回到頁首重新找。
//
// scope（'watchlist'、'holdings'）：同一個範圍要寫入之前，commitUndoToasts 先把還開著的提示收掉、送出、等完。復原期間業務中台還算著
// 那些還沒刪的東西：額度、同名，還有刪一整檔時連剛記的那筆一起刪（2026-11-11，使用者：「我把觀察清單都清空了 可是想要新增觀察清單
// 的個股時 跳出了 觀察清單已達免費版的上限」）。分享連結的「關閉後又按建立」是同一件事，在 SharedShareButton 自己處理
const pendingByScope = new Map<string, Set<() => Promise<void>>>()

export async function commitUndoToasts(scope: string): Promise<void> {
  await Promise.all([...(pendingByScope.get(scope) ?? [])].map(commit => commit()))
}

export function undoToast(text: string, onUndo: () => void, onClose: () => unknown, scope?: string) {
  let remaining = UNDO_WINDOW_MS
  let startedAt = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  let hovered = false
  let focused = false
  let root: HTMLElement | null = null
  const seconds = ref(Math.ceil(UNDO_WINDOW_MS / 1000))

  const tick = () => {
    const left = timer === undefined ? remaining : remaining - (Date.now() - startedAt)
    seconds.value = Math.max(1, Math.ceil(left / 1000))
  }
  const ticker = setInterval(tick, 200)
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
    tick()
  }
  const isMouse = (event: PointerEvent) => event.pointerType === 'mouse'

  const instance = ElMessage({
    type: 'info',
    duration: 0,
    showClose: false,
    message: () => h('span', {
      class: 'app-toast',
      onPointerenter: (event: PointerEvent) => { if (isMouse(event)) { hovered = true; pause() } },
      onPointerleave: (event: PointerEvent) => { if (isMouse(event)) { hovered = false; run() } },
      onFocusin: (event: FocusEvent) => { focused = (event.target as HTMLElement).matches(':focus-visible'); if (focused) pause() },
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
      }, ['復原', h('span', { class: 'app-toast__countdown', 'aria-hidden': 'true' }, String(seconds.value))])
    ]),
    onClose: () => {
      clearTimeout(timer)
      clearInterval(ticker)
      const active = document.activeElement
      if (!active || active === document.body || root?.contains(active)) {
        const heading = document.querySelector<HTMLElement>('main h1, h1')
        if (heading) {
          if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1')
          heading.focus()
        }
      }
      void settle()
    }
  })
  // onClose 只跑一次：提示自己收掉（逾時、Esc、復原）和提前送出都走這裡；送完才從範圍拿掉，送到一半被要求提前送出也等得到
  let settled: Promise<void> | undefined
  const settle = () => (settled ??= Promise.resolve(onClose())
    .then(() => {}, error => devWarn('undo-toast', 'onClose failed', error))
    .finally(() => pendingByScope.get(scope ?? '')?.delete(commit)))
  const commit = () => {
    instance.close()
    return settle()
  }
  if (scope) pendingByScope.set(scope, (pendingByScope.get(scope) ?? new Set()).add(commit))
  run()
  return instance
}
