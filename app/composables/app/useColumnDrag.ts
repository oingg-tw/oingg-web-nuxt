import type { Ref } from 'vue'

// 表頭拖曳換欄位順序（2026-10-08 從 SharedMetricTable 抽出；2026-10-17 改名、不再自己去 el-table 裡找表頭——表頭格子由呼叫端給，
// SharedMetricTable 的 el-table 與 SharedSheetGrid 的原生表格共用這一份）。2026-10-23 起直的清單也用（axis: 'y'，StockPageNavList
// 的側欄排序，取代 sortablejs）：同一套「拖曳中不動、縫發亮、放手才搬」。
// Pragmatic Drag and Drop 而不是 SortableJS（它會在拖過另一欄時就把 <th> 真的換位）：使用者要的是來源欄位拖曳中不動，只用
// 發亮的邊框標示會插到哪個縫（「該位置左邊 div 的右邊 border 發亮、右邊 div 的左邊 border 發亮」），放手才換。
// dropInsertIndex 是欄位之間的縫（0..length，orderedColumns 的索引空間）：指標在某一欄左半＝它前面的縫、右半＝後面的縫；緊貼著
// 來源欄的兩個縫放手等於沒動，不發亮（「這是無效資訊，因為放手後東西還在原地」）。
// 每個 <th> 各掛一組 draggable＋dropTarget，各自閉包住自己的 field；放手時讀 drop target 自己的事件資料而不是 draggingField——
// 那個 ref 由來源元素的 onDrop 清掉，兩個回呼順序不定，依賴它曾經讓每一次重排都靜默失效（實測）。
// 掛載時機：Element Plus 把 label-class-name 反映到真的 <th> 不一定在一個 nextTick 內（實測 headerCells 為空），所以表頭格子數
// 跟欄位數對不上時用 requestAnimationFrame 重試最多 5 次；欄位常在掛載後才非同步到位，所以 watch(columns) 重掛而不只 onMounted。
// Pragmatic DnD 只在瀏覽器載入（2026-10-14）：靜態 import 會把它的 CommonJS 版打進伺服器 bundle，而它依賴的
// @babel/runtime helper 在新版 Node（ESM 匯入 CJS 時多一個 'module.exports' 匯出名）被 rollup 的
// getDefaultExportFromNamespaceIfNotNamed 判成整個 namespace——正式建置的 /screener 一渲染就 500
//「_interopRequireDefault$1 is not a function」（App Hosting DEV 第一次上線時抓到，本機正式建置可重現）。拖曳本來就只在
// onMounted 之後發生，伺服器用不到。
let dndModules: Promise<typeof import('@atlaskit/pragmatic-drag-and-drop/adapter/element-adapter') & typeof import('@atlaskit/pragmatic-drag-and-drop/utils/combine') & typeof import('@atlaskit/pragmatic-drag-and-drop/utils/reorder')> | null = null
function loadDnd() {
  dndModules ??= Promise.all([
    import('@atlaskit/pragmatic-drag-and-drop/adapter/element-adapter'),
    import('@atlaskit/pragmatic-drag-and-drop/utils/combine'),
    import('@atlaskit/pragmatic-drag-and-drop/utils/reorder')
  ]).then(([adapter, combine, reorder]) => ({ ...adapter, ...combine, ...reorder }))
  return dndModules
}

export function useColumnDrag<T extends { field: string }>(options: {
  // 可拖的表頭格子，順序跟 columns 相同
  headerCells: () => HTMLElement[]
  columns: Readonly<Ref<T[]>>
  readonly: () => boolean
  // headerClassFor 回傳的 class 一定帶它（el-table 用它標記哪些 <th> 可以拖）
  headerClass: string
  // startIndex／finishIndex 跟 reorder() 同一個索引空間（finishIndex 是搬完之後的位置）
  onReorder: (updated: T[], startIndex: number, finishIndex: number) => void
  // 這一次按下去能不能開始拖（SharedSheetGrid：按在欄寬把手上是調欄寬，不是拖欄）
  canDrag?: () => boolean
  // x＝左右排的欄（預設），y＝上下排的列
  axis?: 'x' | 'y'
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

  // 指標在 element 的左（上）半→index 前面的縫，右（下）半→後面的縫；緊貼來源欄的兩個縫回 null（放手不會動）
  function resolveInsertIndex(element: HTMLElement, input: { clientX: number; clientY: number }, index: number): number | null {
    const rect = element.getBoundingClientRect()
    const before = options.axis === 'y' ? input.clientY < rect.top + rect.height / 2 : input.clientX < rect.left + rect.width / 2
    const insertIndex = before ? index : index + 1
    if (dragStartIndex.value !== null && (insertIndex === dragStartIndex.value || insertIndex === dragStartIndex.value + 1)) return null
    return insertIndex
  }

  let unmounted = false

  // 先等套件載入、再同步做完掛載：同時有兩次 attach 時，後到的那次的 cleanup 會清掉先到的，不會重複掛
  async function attach(retriesLeft = 5) {
    const { draggable, dropTargetForElements, combine, reorder } = await loadDnd()
    if (unmounted) return
    cleanup?.()
    if (options.readonly()) return
    const headerCells = options.headerCells()
    if (headerCells.length !== options.columns.value.length && retriesLeft > 0) {
      requestAnimationFrame(() => void attach(retriesLeft - 1))
      return
    }
    cleanup = combine(
      ...headerCells.flatMap((th, index) => {
        const field = options.columns.value[index]?.field
        if (!field) return []
        return [
          draggable({
            element: th,
            canDrag: () => options.canDrag?.() ?? true,
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
              dropInsertIndex.value = resolveInsertIndex(th, location.current.input, index)
            },
            onDrag: ({ location }) => {
              dropInsertIndex.value = resolveInsertIndex(th, location.current.input, index)
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
              options.onReorder(reorder({ list: options.columns.value, startIndex, finishIndex }), startIndex, finishIndex)
            }
          })
        ]
      })
    )
  }

  onMounted(() => void attach())
  watch(options.columns, () => nextTick(() => void attach()))
  onUnmounted(() => {
    unmounted = true
    cleanup?.()
  })

  return { headerClassFor }
}
