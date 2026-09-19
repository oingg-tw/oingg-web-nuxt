import type { WatchSource } from 'vue'

// el-table's horizontal scroll container（`.el-scrollbar__wrap` inside `.el-table__body-wrapper`）
// is a plain <div>: on a phone, a wide statement table scrolls sideways with a finger but a
// keyboard user has no way to reach or move it — axe `scrollable-region-focusable`, found at
// 375px on 財務報表 during the single-layout merge (2026-09-19). Marks that wrap focusable
// (tabindex 0) as a named region once the table has mounted, and again after each data change in
// case Element Plus rebuilds it. The global :focus-visible ring then shows around the table body
// when it's tabbed to, and arrow keys scroll it. Client-only by nature (DOM); no-op on the server.
//
// Generic over the ref's own type so both a plain `{ $el: HTMLElement }` duck-typed ref and
// Element Plus's TableInstance (`$el: any`) fit without casts at the call site.
export function useFocusableTableScroll<T extends { $el?: HTMLElement | null } | null | undefined>(tableRef: Ref<T>, label: string, trigger?: WatchSource) {
  if (import.meta.server) return

  function apply() {
    const wrap = tableRef.value?.$el?.querySelector<HTMLElement>('.el-table__body-wrapper .el-scrollbar__wrap')
    if (!wrap) return
    wrap.setAttribute('tabindex', '0')
    wrap.setAttribute('role', 'region')
    wrap.setAttribute('aria-label', label)
  }

  onMounted(() => {
    nextTick(apply)
  })
  if (trigger) {
    watch(trigger, () => {
      nextTick(apply)
    }, { flush: 'post' })
  }
}
