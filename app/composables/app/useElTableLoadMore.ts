import type { Ref, WatchSource } from 'vue'
import type { TableInstance } from 'element-plus'

// 無限捲動：el-table 的 #append 哨兵進入視窗就載下一頁。2026-10-02 之前 OrganismResultTable 與
// EtfResultTable 各寫一份，兩份的函式體一字不差，只差回呼與重掛的條件。
//
// 三件事是這兩份原本就寫在註解裡、而複製第三份時一定會漏掉的，所以跟著搬過來：
//
//   1. **root 必須是 `.el-table__body-wrapper .el-scrollbar__wrap`，不能是 body-wrapper 自己。**
//      body-wrapper 的 scrollHeight 永遠等於 clientHeight，它不是真的會捲的那一層——拿它當
//      IntersectionObserver 的 root 會靜默沒作用（第一版就是這樣，實測卡在
//      scrollHeight === clientHeight，不管捲多遠）。寫 scrollTop 也一樣沒反應。
//      注意這跟隔壁 attachDragReorder 的 `.el-table__header-wrapper` 不同——那裡 header-wrapper
//      才是對的元素，兩者不要互相抄。
//   2. **有 fixed 欄位時 `.el-table__body-wrapper` 會有多個**（每組 fixed 欄位一個），所以要排除
//      `.el-table__fixed` / `.el-table__fixed-right` 底下的那些。
//   3. **`rootMargin: '200px'`**：等哨兵真的完全進入視窗才載，讀起來像卡住。
//
// SSR 安全：`IntersectionObserver` 在 server 上不存在，而 attach 只從 onMounted 與 watch 呼叫
// （兩個都是 client-only 的生命週期），不會在 setup() 時直接執行。
//
// `reattachOn` 是必要的而不是方便：兩個呼叫端的表格都會在某些狀態下重建 DOM——哨兵元素被
// v-if/v-else 換成「沒有更多結果」那句靜態文字時是另一個元素，而 OrganismResultTable 還會因為
// tableKey 變動整個 remount。觀察的是舊元素就等於無限捲動靜默失效。
export function useElTableLoadMore(options: {
  table: Ref<TableInstance | undefined>
  sentinel: Ref<HTMLElement | undefined>
  loadMore: () => void
  reattachOn: WatchSource[]
}) {
  let observer: IntersectionObserver | null = null

  function attach() {
    observer?.disconnect()
    const rootEl = options.table.value?.$el as HTMLElement | undefined
    const bodyWrapper = Array.from(rootEl?.querySelectorAll<HTMLElement>('.el-table__body-wrapper') ?? []).find(
      wrapper => !wrapper.closest('.el-table__fixed, .el-table__fixed-right')
    )
    const scrollRoot = bodyWrapper?.querySelector<HTMLElement>('.el-scrollbar__wrap')
    if (!scrollRoot || !options.sentinel.value) return
    observer = new IntersectionObserver(
      entries => {
        if (entries[0]?.isIntersecting) options.loadMore()
      },
      { root: scrollRoot, rootMargin: '200px' }
    )
    observer.observe(options.sentinel.value)
  }

  onMounted(() => nextTick(attach))
  watch(options.reattachOn, () => nextTick(attach))
  onBeforeUnmount(() => observer?.disconnect())
}
