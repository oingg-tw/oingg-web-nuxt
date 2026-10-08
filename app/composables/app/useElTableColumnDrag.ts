import type { Ref } from 'vue'
import type { TableInstance } from 'element-plus'
import { draggable, dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/adapter/element-adapter'
import { combine } from '@atlaskit/pragmatic-drag-and-drop/utils/combine'
import { reorder } from '@atlaskit/pragmatic-drag-and-drop/utils/reorder'

// el-table 表頭拖曳換欄位順序（2026-10-08 從 SharedMetricTable 抽出，同 useElTableLoadMore 的形狀）。
// Pragmatic Drag and Drop 而不是 SortableJS（它會在拖過另一欄時就把 <th> 真的換位）：使用者要的是來源欄位拖曳中不動，只用
// 發亮的邊框標示會插到哪個縫（「該位置左邊 div 的右邊 border 發亮、右邊 div 的左邊 border 發亮」），放手才換。
// dropInsertIndex 是欄位之間的縫（0..length，orderedColumns 的索引空間）：指標在某一欄左半＝它前面的縫、右半＝後面的縫；緊貼著
// 來源欄的兩個縫放手等於沒動，不發亮（「這是無效資訊，因為放手後東西還在原地」）。
// 每個 <th> 各掛一組 draggable＋dropTarget，各自閉包住自己的 field；放手時讀 drop target 自己的事件資料而不是 draggingField——
// 那個 ref 由來源元素的 onDrop 清掉，兩個回呼順序不定，依賴它曾經讓每一次重排都靜默失效（實測）。
// 掛載時機：Element Plus 把 label-class-name 反映到真的 <th> 不一定在一個 nextTick 內（實測 headerCells 為空），所以用
// requestAnimationFrame 重試最多 5 次；欄位常在掛載後才非同步到位，所以 watch(columns) 重掛而不只 onMounted。
export function useElTableColumnDrag<T extends { field: string }>(options: {
  table: Ref<TableInstance | undefined>
  columns: Ref<T[]>
  readonly: () => boolean
  // 可拖的表頭用這個 class 標記（el-table-column 的 label-class-name）
  headerClass: string
  onReorder: (updated: T[]) => void
}) {
  let cleanup: (() => void) | undefined
  const draggingField = ref<string | null>(null)
  const dropInsertIndex = ref<number | null>(null)
  const dragStartIndex = ref<number | null>(null)

  function headerClassFor(column: T, index: number): string {
    if (options.readonly()) return ''
    const classes = [options.headerClass]
    if (draggingField.value === column.field) classes.push('is-dragging')
    if (dropInsertIndex.value === index) classes.push('is-insert-before')
    if (dropInsertIndex.value === index + 1) classes.push('is-insert-after')
    return classes.join(' ')
  }

  // 指標在 element 的左半→index 前面的縫，右半→後面的縫；緊貼來源欄的兩個縫回 null（放手不會動）
  function resolveInsertIndex(element: HTMLElement, clientX: number, index: number): number | null {
    const rect = element.getBoundingClientRect()
    const insertIndex = clientX < rect.left + rect.width / 2 ? index : index + 1
    if (dragStartIndex.value !== null && (insertIndex === dragStartIndex.value || insertIndex === dragStartIndex.value + 1)) return null
    return insertIndex
  }

  function attach(retriesLeft = 5) {
    cleanup?.()
    if (options.readonly()) return
    const rootEl = options.table.value?.$el as HTMLElement | undefined
    if (!rootEl) return
    // 有 fixed 欄位時 header-wrapper 會有多個，要排除 .el-table__fixed 底下的
    const headerWrapper = Array.from(rootEl.querySelectorAll<HTMLElement>('.el-table__header-wrapper')).find(
      wrapper => !wrapper.closest('.el-table__fixed, .el-table__fixed-right')
    )
    const headerRow = headerWrapper?.querySelector<HTMLElement>('thead tr')
    if (!headerRow) return
    const headerCells = Array.from(headerRow.querySelectorAll<HTMLElement>(`th.${options.headerClass}`))
    if (headerCells.length !== options.columns.value.length && retriesLeft > 0) {
      requestAnimationFrame(() => attach(retriesLeft - 1))
      return
    }
    cleanup = combine(
      ...headerCells.flatMap((th, index) => {
        const field = options.columns.value[index]?.field
        if (!field) return []
        return [
          draggable({
            element: th,
            getInitialData: () => ({ field }),
            onDragStart: () => {
              draggingField.value = field
              dragStartIndex.value = index
            },
            onDrop: () => {
              draggingField.value = null
              dragStartIndex.value = null
            }
          }),
          dropTargetForElements({
            element: th,
            getData: () => ({ field }),
            canDrop: ({ source }) => source.data.field !== field,
            onDragEnter: ({ location }) => {
              dropInsertIndex.value = resolveInsertIndex(th, location.current.input.clientX, index)
            },
            onDrag: ({ location }) => {
              dropInsertIndex.value = resolveInsertIndex(th, location.current.input.clientX, index)
            },
            onDragLeave: () => {
              if (dropInsertIndex.value === index || dropInsertIndex.value === index + 1) dropInsertIndex.value = null
            },
            onDrop: ({ source }) => {
              const targetIndex = dropInsertIndex.value
              dropInsertIndex.value = null
              if (targetIndex === null) return
              const sourceField = source.data.field as string
              const startIndex = options.columns.value.findIndex(column => column.field === sourceField)
              if (startIndex === -1) return
              // reorder() 的 finishIndex 是「來源已移除」的索引空間：插到比來源晚的位置要左移一格
              const finishIndex = startIndex < targetIndex ? targetIndex - 1 : targetIndex
              if (finishIndex === startIndex) return
              options.onReorder(reorder({ list: options.columns.value, startIndex, finishIndex }))
            }
          })
        ]
      })
    )
  }

  onMounted(attach)
  watch(options.columns, () => nextTick(attach))
  onUnmounted(() => cleanup?.())

  return { headerClassFor }
}
