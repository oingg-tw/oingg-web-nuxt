import type { Ref } from 'vue'

// 受控 popover 的「點外面或按 Esc 就關」。2026-10-02 之前 ScreenerIndicatorPicker 與
// ScreenerRangeEditor 各寫一份，兩份一字不差（只差面板 ref 的名字）。
//
// 為什麼要自己寫而不是用 el-popover 的 `hide-after`／`trigger`：這兩個 popover 是**受控的**
// （`:visible` 綁在 useScreenerTabs 的狀態上、`virtual-triggering` 搭配外部的觸發元素），
// Element Plus 自己的關閉手勢在這個模式下不會動，關閉必須由我們 emit 回去。
//
// 三個細節是這兩份原本就有、而複製第三份時最容易漏掉的：
//
//   1. **點在面板自己身上不算外面**。少了這一條，點選單裡的任何東西都會先把它關掉。
//   2. **點在觸發元素上也不算外面**。少了這一條，再按一次那顆按鈕會先被這裡關掉、再被按鈕自己
//      的 handler 開起來，於是看起來像按了沒反應。
//   3. **`onUnmounted` 要再拆一次**。watch 的 else 分支只在「開著 → 關掉」時跑，元件在開著的
//      狀態下被卸載時那條分支不會執行，listener 就留在 document 上（stale listener）。
//
// `active` 收一個 getter 而不是 Ref，因為兩個呼叫端的條件都是複合的（`modelValue && isDesktop`），
// 傳 getter 就不用在呼叫端多一個 computed。
export function useDismissOnOutside(options: {
  active: () => boolean
  panel: Ref<HTMLElement | null>
  trigger: () => HTMLElement | null | undefined
  dismiss: () => void
}) {
  function isOutside(event: MouseEvent): boolean {
    const target = event.target as Node
    if (options.panel.value?.contains(target)) return false
    if (options.trigger()?.contains(target)) return false
    return true
  }

  function handleOutsideClick(event: MouseEvent) {
    if (isOutside(event)) options.dismiss()
  }

  function handleEscapeKey(event: KeyboardEvent) {
    if (event.key === 'Escape') options.dismiss()
  }

  function detach() {
    document.removeEventListener('click', handleOutsideClick)
    document.removeEventListener('keydown', handleEscapeKey)
  }

  watch(options.active, isActive => {
    if (isActive) {
      document.addEventListener('click', handleOutsideClick)
      document.addEventListener('keydown', handleEscapeKey)
    } else {
      detach()
    }
  })

  onUnmounted(detach)
}
