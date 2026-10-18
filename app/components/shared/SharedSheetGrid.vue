<script lang="ts">
export interface SheetColumn<Row> {
  key: string
  label: string
  // 畫面上的字；自動欄寬、### 與預設的複製值都讀它
  text: (row: Row) => string
  // 複製到剪貼簿的值：數字給數字、百分比給比例（0.487），貼進 Excel 才是真的數字。不給就複製 text
  value?: (row: Row) => string | number | null
  // 貼到 Excel 的數字格式（HTML 版本的 mso-number-format），例如 '0.00%'
  excelFormat?: string
  // 數字欄：靠右、等寬數字、放不下整格顯示 ###（不截斷）
  numeric?: boolean
  // 有給才能排序；null 一律排最後
  sortValue?: (row: Row) => number | string | null
  // 第一下排序的方向；預設數字欄從大到小、其他從小到大
  sortFirst?: 'ascending' | 'descending'
  // 凍結在左邊（只看最前面連續的幾欄）
  frozen?: boolean
  // 這一列的名稱：螢幕報讀念每一格時會帶上它
  rowHeader?: boolean
  // false：不複製這一欄（操作按鈕）；也不能下載（SharedDownloadButton）
  copyable?: boolean
  // 會透露部位大小（股數、金額）：下載時預設不勾（SharedDownloadButton，2026-10-18）
  sensitive?: boolean
  width?: number
  minWidth?: number
}
</script>

<script setup lang="ts" generic="R">
import type { SheetCell, SheetDirection } from '~/utils/sheet-grid'
// 試算表手感的表格（2026-10-17）。使用者：照 conductor 的研究文件「將 Excel 桌面級操作手感遷移至 Web 端」做一個元件，先套在
// /holdings/columns 與 /watchlist；選了框選與複製、鍵盤導航、欄寬調整、公式參照上色，點格子是選取。RevoGrid 試驗沒過（axe 嚴重違規、
// Tab 進來沒有格子得到焦點、框選跨不過凍結欄、免費版有署名）之後使用者選了自己做。兩頁都在兩百列以內，原生 <table> 就夠，
// 不需要 Canvas 或虛擬捲動。純邏輯（範圍、Ctrl 跳邊界、複製格式、###）在 app/utils/sheet-grid.ts，scripts/check-sheet-grid.mjs 驗。
//
// 焦點：整張表是一個 Tab 停點（roving tabindex），方向鍵在格子間移動、↑ 從第一列進到表頭。Tab／Shift+Tab 照 Excel 往右／左，
// 到最右（最左）欄就照瀏覽器預設離開表格——不能讓人困在表格裡（WCAG 2.1.2）。
// 格子裡的按鈕（觀察清單的備註／移除）不在 Tab 順序裡：Enter 進到格子裡、Tab 在格子內輪流、Esc 回到格子（APG 的 grid 模式）。
// 連結不用進去：Enter 交給 activate（觀察清單開個股頁，就是那個連結的目的地）。
const props = withDefaults(defineProps<{
  rows: R[]
  columns: SheetColumn<R>[]
  rowKey: (row: R) => string
  label: string
  // 欄寬存在這個瀏覽器（localStorage），不同表格用不同的 key
  storageKey?: string
  // Enter：move＝照 Excel 往下（含 Tab 換行記憶）；activate＝開啟這一列（觀察清單）
  enterAction?: 'move' | 'activate'
  // 拖表頭換欄位順序（凍結欄不動）
  movable?: boolean
  // 選點模式（自訂欄位編輯公式時）：按格子或表頭不改選取，送 pick，焦點留在公式列
  pointing?: boolean
  // 要框起來的欄：欄位 key → 顏色（公式參照上色）
  highlights?: Record<string, string>
  // 給螢幕報讀的操作說明（表格的 aria-describedby）；頁面的表頭不是排序時要換掉
  hint?: string
}>(), {
  storageKey: undefined,
  enterAction: 'move',
  movable: false,
  pointing: false,
  highlights: () => ({}),
  hint: '方向鍵移動、Shift＋方向鍵框選、Ctrl+C 複製；表頭上按 Enter 排序，按加號、減號調整欄寬，按 0 自動貼合。'
})

const emit = defineEmits<{
  activate: [row: R, column: SheetColumn<R>]
  edit: [row: R, column: SheetColumn<R>]
  pick: [column: SheetColumn<R>]
  headerActivate: [column: SheetColumn<R>]
  reorder: [keys: string[]]
}>()

defineSlots<{
  header?: (props: { column: SheetColumn<R>; index: number }) => unknown
  cell?: (props: { row: R; column: SheetColumn<R>; text: string }) => unknown
}>()

const root = ref<HTMLElement>()
const scroller = ref<HTMLElement>()
const hintId = useId()

// ---- 排序 ----
const sort = ref<{ key: string; order: 'ascending' | 'descending' } | null>(null)
const viewRows = computed(() => {
  const current = sort.value
  const column = current && props.columns.find(item => item.key === current.key)
  if (!current || !column?.sortValue) return props.rows
  const direction = current.order === 'ascending' ? 1 : -1
  return props.rows
    .map((row, index) => ({ row, index, value: column.sortValue!(row) }))
    .sort((a, b) => {
      if (a.value === null || b.value === null) return a.value === b.value ? a.index - b.index : a.value === null ? 1 : -1
      const diff = typeof a.value === 'number' && typeof b.value === 'number' ? a.value - b.value : String(a.value).localeCompare(String(b.value), 'zh-Hant')
      return diff === 0 ? a.index - b.index : diff * direction
    })
    .map(item => item.row)
})
const firstOrder = (column: SheetColumn<R>) => column.sortFirst ?? (column.numeric ? 'descending' : 'ascending')
function toggleSort(column: SheetColumn<R>) {
  const first = firstOrder(column)
  const current = sort.value?.key === column.key ? sort.value.order : null
  sort.value = current === null ? { key: column.key, order: first } : current === first ? { key: column.key, order: first === 'ascending' ? 'descending' : 'ascending' } : null
  copied.value = null
  announce(sort.value ? `依${column.label}${sort.value.order === 'ascending' ? '由小到大' : '由大到小'}排序` : `取消${column.label}的排序`)
}
const ariaSort = (column: SheetColumn<R>) => (sort.value?.key === column.key ? sort.value.order : column.sortValue ? 'none' : undefined)
const sortGlyph = (column: SheetColumn<R>) => (sort.value?.key !== column.key ? '↕' : sort.value.order === 'ascending' ? '▲' : '▼')

// ---- 欄寬 ----
// 預設照內容估（伺服器與瀏覽器算出同一個數）；拖過或自動貼合過的存在這個瀏覽器
const PADDING = 24
const MAX_WIDTH = 480
const widths = reactive<Record<string, number>>({})
const minWidthOf = (column: SheetColumn<R>) => column.minWidth ?? 56
const estimated = computed(() => Object.fromEntries(props.columns.map((column) => {
  const header = estimateTextWidth(column.label) + (column.sortValue ? 20 : 0)
  const cells = props.rows.reduce((max, row) => Math.max(max, estimateTextWidth(column.text(row))), 0)
  return [column.key, Math.min(MAX_WIDTH, Math.max(minWidthOf(column), Math.max(header, cells) + PADDING))]
})))
const widthOf = (column: SheetColumn<R>) => widths[column.key] ?? column.width ?? estimated.value[column.key]!
const tableWidth = computed(() => props.columns.reduce((sum, column) => sum + widthOf(column), 0))
const STORAGE_PREFIX = 'sheet-widths:'
onMounted(() => {
  if (!props.storageKey) return
  try {
    Object.assign(widths, JSON.parse(localStorage.getItem(STORAGE_PREFIX + props.storageKey) ?? '{}'))
  } catch {}
})
function saveWidths() {
  if (!props.storageKey) return
  try {
    localStorage.setItem(STORAGE_PREFIX + props.storageKey, JSON.stringify(widths))
  } catch {}
}

// 拖表頭右邊的把手調欄寬；拖的當下就生效（不另畫導引線）。按在把手上時不能開始拖欄（useColumnDrag 的 canDrag 看這個旗標）
let resizing: { key: string; startX: number; startWidth: number } | null = null
let resizeHandlePressed = false
function startResize(event: PointerEvent, column: SheetColumn<R>) {
  resizeHandlePressed = true
  if (event.button !== 0) return
  event.preventDefault()
  event.stopPropagation()
  ;(event.currentTarget as Element).setPointerCapture(event.pointerId)
  resizing = { key: column.key, startX: event.clientX, startWidth: widthOf(column) }
}
function moveResize(event: PointerEvent, column: SheetColumn<R>) {
  if (resizing?.key !== column.key) return
  widths[column.key] = Math.min(MAX_WIDTH, Math.max(minWidthOf(column), Math.round(resizing.startWidth + event.clientX - resizing.startX)))
}
function endResize() {
  resizeHandlePressed = false
  if (!resizing) return
  resizing = null
  saveWidths()
}
// 自動貼合（雙擊把手、或表頭上按 0）：數字欄用畫布量真正的字（畫面上可能是 ###），其他欄量格子裡實際排出來的內容（連結、標籤都算）
function autofit(c: number) {
  const column = props.columns[c]!
  const cells = Array.from(root.value?.querySelectorAll<HTMLElement>(`tbody [data-c="${c}"]`) ?? [])
  const font = cells[0] ? fontOf(cells[0]) : ''
  const contentWidth = (el: Element) => {
    const range = document.createRange()
    range.selectNodeContents(el)
    return range.getBoundingClientRect().width
  }
  const head = root.value?.querySelector<HTMLElement>(`thead [data-c="${c}"] .sheet__head`)
  let max = head ? contentWidth(head) : 0
  viewRows.value.forEach((row, r) => {
    max = Math.max(max, column.numeric ? measureText(column.text(row), font) : cells[r] ? contentWidth(cells[r]!) : 0)
  })
  widths[column.key] = Math.min(MAX_WIDTH, Math.max(minWidthOf(column), Math.ceil(max) + PADDING + 2))
  saveWidths()
  announce(`${column.label}欄寬已自動貼合`)
}
function nudgeWidth(column: SheetColumn<R>, delta: number) {
  widths[column.key] = Math.min(MAX_WIDTH, Math.max(minWidthOf(column), widthOf(column) + delta))
  saveWidths()
  announce(`${column.label}欄寬 ${widths[column.key]} 像素`)
}

// ---- 凍結欄 ----
const frozenCount = computed(() => {
  let count = 0
  while (count < props.columns.length && props.columns[count]!.frozen) count++
  return count
})
const frozenLeft = computed(() => {
  const lefts: number[] = []
  let x = 0
  for (let c = 0; c < frozenCount.value; c++) {
    lefts.push(x)
    x += widthOf(props.columns[c]!)
  }
  return lefts
})
const frozenWidth = computed(() => props.columns.slice(0, frozenCount.value).reduce((sum, column) => sum + widthOf(column), 0))

// ---- 量字（### 與自動貼合）：只在瀏覽器，掛載後才算 ----
const mounted = ref(false)
onMounted(() => { mounted.value = true })
let canvas: CanvasRenderingContext2D | null = null
const textWidthCache = new Map<string, number>()
const fontOf = (el: Element) => {
  const style = getComputedStyle(el)
  return `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
}
function measureText(text: string, font: string): number {
  const key = `${font}|${text}`
  const cached = textWidthCache.get(key)
  if (cached !== undefined) return cached
  canvas ??= document.createElement('canvas').getContext('2d')
  if (!canvas) return 0
  canvas.font = font
  const width = canvas.measureText(text).width
  textWidthCache.set(key, width)
  return width
}
const masks = computed(() => {
  const map = new Map<string, string>()
  if (!mounted.value) return map
  const sample = root.value?.querySelector('tbody td')
  if (!sample) return map
  const font = fontOf(sample)
  const hash = measureText('#', font)
  props.columns.forEach((column, c) => {
    if (!column.numeric) return
    const available = widthOf(column) - PADDING - 2
    viewRows.value.forEach((row, r) => {
      const masked = maskedText(measureText(column.text(row), font), available, hash)
      if (masked) map.set(`${r}:${c}`, masked)
    })
  })
  return map
})
const displayText = (row: R, column: SheetColumn<R>, r: number, c: number) => masks.value.get(`${r}:${c}`) ?? column.text(row)

// ---- 選取：active 是作用中的格子，anchor 與 extent 是範圍的兩角（Shift 只動 extent）；r = -1 是表頭 ----
const active = ref<SheetCell>({ r: 0, c: 0 })
const anchor = ref<SheetCell>({ r: 0, c: 0 })
const extent = ref<SheetCell>({ r: 0, c: 0 })
const range = computed(() => rangeOf(anchor.value, extent.value))
const copied = ref<ReturnType<typeof rangeOf> | null>(null)
const interacting = ref(false)
// Tab 換行記憶（研究文件的打字機換行）：連續按 Tab 往右之後按 Enter，回到起點那一欄的下一列；其他移動一律清掉
let tabStartColumn: number | null = null
const rowCount = computed(() => viewRows.value.length)
const lastRow = computed(() => rowCount.value - 1)
const lastCol = computed(() => props.columns.length - 1)

const cellEl = (cell: SheetCell) => root.value?.querySelector<HTMLElement>(`[data-r="${cell.r}"][data-c="${cell.c}"]`) ?? null

// 凍結欄蓋住的格子要捲出來：瀏覽器的 scrollIntoView 不知道 sticky 欄的存在
function reveal(el: HTMLElement, c: number) {
  const box = scroller.value
  if (!box || c < frozenCount.value) return
  const left = el.offsetLeft - frozenWidth.value
  const right = el.offsetLeft + el.offsetWidth - box.clientWidth
  if (box.scrollLeft > left) box.scrollLeft = left
  else if (box.scrollLeft < right) box.scrollLeft = right
}
function focusCell(cell: SheetCell) {
  nextTick(() => {
    const el = cellEl(cell)
    if (!el) return
    el.focus({ preventScroll: true })
    el.scrollIntoView({ block: 'nearest' })
    reveal(el, cell.c)
  })
}
function setActive(cell: SheetCell, focus = true) {
  active.value = cell
  anchor.value = cell
  extent.value = cell
  interacting.value = false
  if (focus) focusCell(cell)
}
function selectRange(from: SheetCell, to: SheetCell) {
  anchor.value = from
  extent.value = to
}

// 列數或欄數變少（刪除、篩選）時把選取收回範圍內
watch([rowCount, () => props.columns.length], () => {
  const clamp = (cell: SheetCell) => ({ r: Math.min(cell.r, Math.max(lastRow.value, -1)), c: Math.min(cell.c, Math.max(lastCol.value, 0)) })
  active.value = clamp(active.value)
  anchor.value = clamp(anchor.value)
  extent.value = clamp(extent.value)
  copied.value = null
})

const isEmpty = (cell: SheetCell) => {
  const row = viewRows.value[cell.r]
  const column = props.columns[cell.c]
  if (!row || !column) return true
  const value = column.value ? column.value(row) : column.text(row)
  return value === null || value === '' || value === '－' || value === '—'
}

// ---- 朗讀（框選、複製、排序、欄寬）：連續拖曳時只念最後一次 ----
const announcement = ref('')
let announceTimer: ReturnType<typeof setTimeout> | undefined
function announce(text: string) {
  clearTimeout(announceTimer)
  announceTimer = setTimeout(() => { announcement.value = text }, 250)
}
watch(range, (next) => {
  const rows = next.bottom - next.top + 1
  const cols = next.right - next.left + 1
  if (rows * cols > 1 && active.value.r >= 0) announce(`已選取 ${rows} 列 × ${cols} 欄`)
})

// ---- 鍵盤 ----
const ARROWS: Record<string, SheetDirection> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' }
const WIDGETS = 'a[href], button, input, select, textarea'
const cellWidgets = (el: HTMLElement | null) => Array.from(el?.querySelectorAll<HTMLElement>('button, input, select, textarea') ?? []).filter(widget => !widget.hasAttribute('disabled'))

function onKeydown(event: KeyboardEvent) {
  // 輸入法選字時的 Enter、方向鍵是給輸入法的（研究文件的「IME 屏障」）
  if (event.isComposing) return
  if (interacting.value) return onInteractionKey(event)
  if (!(event.target as HTMLElement).matches('[data-r]')) return
  const ctrl = event.ctrlKey || event.metaKey
  const handled = active.value.r === -1 ? onHeaderKey(event, ctrl) : onCellKey(event, ctrl)
  if (handled) event.preventDefault()
}

function onHeaderKey(event: KeyboardEvent, ctrl: boolean): boolean {
  const { c } = active.value
  const column = props.columns[c]!
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    setActive({ r: -1, c: Math.min(lastCol.value, Math.max(0, c + (event.key === 'ArrowLeft' ? -1 : 1))) })
    return true
  }
  if (event.key === 'ArrowDown' && rowCount.value) {
    setActive({ r: 0, c })
    return true
  }
  if (event.key === 'Home' || event.key === 'End') {
    setActive({ r: -1, c: event.key === 'Home' ? 0 : lastCol.value })
    return true
  }
  if (event.key === 'Enter' || event.key === ' ') {
    headerAction(column)
    return true
  }
  // 鍵盤調欄寬（拖曳的替代，WCAG 2.5.7）：+／− 每次 16 像素，0 自動貼合
  if (!ctrl && (event.key === '+' || event.key === '=')) {
    nudgeWidth(column, 16)
    return true
  }
  if (!ctrl && event.key === '-') {
    nudgeWidth(column, -16)
    return true
  }
  if (!ctrl && event.key === '0') {
    autofit(c)
    return true
  }
  return false
}

function onCellKey(event: KeyboardEvent, ctrl: boolean): boolean {
  const { r, c } = active.value
  const direction = ARROWS[event.key]
  if (direction) {
    tabStartColumn = null
    if (direction === 'up' && r === 0 && !event.shiftKey && !ctrl) {
      setActive({ r: -1, c })
      return true
    }
    if (event.shiftKey) {
      extent.value = moveCell(extent.value, direction, rowCount.value, props.columns.length, ctrl, isEmpty)
      focusCell(active.value)
      const el = cellEl(extent.value)
      if (el) reveal(el, extent.value.c)
    } else {
      setActive(moveCell(active.value, direction, rowCount.value, props.columns.length, ctrl, isEmpty))
    }
    return true
  }
  switch (event.key) {
    case 'Home':
    case 'End': {
      tabStartColumn = null
      const target = ctrl ? (event.key === 'Home' ? { r: 0, c: 0 } : { r: lastRow.value, c: lastCol.value }) : { r, c: event.key === 'Home' ? 0 : lastCol.value }
      if (event.shiftKey) selectRange(active.value, target)
      else setActive(target)
      return true
    }
    case 'PageUp':
    case 'PageDown':
      tabStartColumn = null
      setActive({ r: Math.min(lastRow.value, Math.max(0, r + (event.key === 'PageUp' ? -10 : 10))), c })
      return true
    case 'Tab':
      // 到最右（最左）欄就讓瀏覽器把焦點移出表格
      if (event.shiftKey ? c === 0 : c === lastCol.value) {
        tabStartColumn = null
        return false
      }
      if (!event.shiftKey) tabStartColumn ??= c
      else tabStartColumn = null
      setActive({ r, c: c + (event.shiftKey ? -1 : 1) })
      return true
    case 'Enter': {
      const row = viewRows.value[r]!
      const column = props.columns[c]!
      const widgets = cellWidgets(cellEl(active.value))
      if (widgets.length) {
        interacting.value = true
        widgets[0]!.focus()
      } else if (props.enterAction === 'activate') {
        emit('activate', row, column)
      } else {
        const target = { r: Math.min(lastRow.value, Math.max(0, r + (event.shiftKey ? -1 : 1))), c: event.shiftKey ? c : (tabStartColumn ?? c) }
        tabStartColumn = null
        setActive(target)
      }
      return true
    }
    case 'F2':
      emit('edit', viewRows.value[r]!, props.columns[c]!)
      return true
    case 'Escape':
      if (copied.value) copied.value = null
      else selectRange(active.value, active.value)
      return true
  }
  if (ctrl && (event.key === 'a' || event.key === 'A')) {
    selectRange({ r: 0, c: 0 }, { r: lastRow.value, c: lastCol.value })
    return true
  }
  if (event.key === ' ' && (ctrl || event.shiftKey)) {
    if (ctrl) selectRange({ r: 0, c }, { r: lastRow.value, c })
    else selectRange({ r, c: 0 }, { r, c: lastCol.value })
    return true
  }
  return false
}

// 格子裡的按鈕：Tab 在格子內輪流，Esc 回到格子
function onInteractionKey(event: KeyboardEvent) {
  const cell = cellEl(active.value)
  if (event.key === 'Escape') {
    event.preventDefault()
    interacting.value = false
    cell?.focus()
    return
  }
  if (event.key === 'Tab') {
    const widgets = cellWidgets(cell)
    const index = widgets.indexOf(document.activeElement as HTMLElement)
    event.preventDefault()
    widgets[(index + (event.shiftKey ? -1 : 1) + widgets.length) % widgets.length]?.focus()
  }
}
function onFocusout(event: FocusEvent) {
  if (interacting.value && !cellEl(active.value)?.contains(event.relatedTarget as Node | null)) interacting.value = false
}
// 頁面自己把焦點放到某一格（例如套用公式後回到那一欄的表頭）：作用中的格子跟著焦點走，方向鍵才從那裡開始
function onFocusin(event: FocusEvent) {
  const target = event.target as HTMLElement
  if (!target.matches('[data-r]')) return
  const cell = cellOf(target)!
  if (cell.r !== active.value.r || cell.c !== active.value.c) setActive(cell, false)
}

// 格子裡的連結與按鈕不在 Tab 順序裡（整張表一個停點）；每次重畫都補，slot 內容會換
function retireWidgets() {
  root.value?.querySelectorAll<HTMLElement>(`tbody ${WIDGETS}`).forEach(widget => widget.setAttribute('tabindex', '-1'))
}
onMounted(retireWidgets)
onUpdated(retireWidgets)

// ---- 滑鼠：點選、拖曳框選、Shift＋點擊延伸 ----
let dragging = false
function cellOf(target: EventTarget | null): SheetCell | null {
  const el = (target as HTMLElement | null)?.closest<HTMLElement>('[data-r]')
  return el ? { r: Number(el.dataset.r), c: Number(el.dataset.c) } : null
}
function onPointerdown(event: PointerEvent) {
  const target = event.target as HTMLElement
  const cell = cellOf(target)
  if (!cell || event.button !== 0 || target.closest('.sheet__resize')) return
  if (props.pointing) {
    // 選點模式：焦點留在公式列（不讓格子搶走），由頁面插入參照
    event.preventDefault()
    emit('pick', props.columns[cell.c]!)
    return
  }
  if (cell.r === -1) {
    setActive(cell)
    return
  }
  // 按在連結或按鈕上：讓它照常運作，只記住是哪一格
  if (target.closest(WIDGETS)) {
    setActive(cell, false)
    return
  }
  event.preventDefault()
  tabStartColumn = null
  if (event.shiftKey) {
    extent.value = cell
    focusCell(active.value)
  } else {
    setActive(cell)
  }
  dragging = event.pointerType !== 'touch'
}
function onPointerover(event: PointerEvent) {
  if (!dragging) return
  const cell = cellOf(event.target)
  if (cell && cell.r >= 0) extent.value = cell
}
const stopDragging = () => { dragging = false }
onMounted(() => {
  document.addEventListener('pointerup', stopDragging)
  document.addEventListener('copy', onCopy)
})
onUnmounted(() => {
  document.removeEventListener('pointerup', stopDragging)
  document.removeEventListener('copy', onCopy)
  clearTimeout(announceTimer)
})

function headerAction(column: SheetColumn<R>) {
  if (column.sortValue) toggleSort(column)
  else emit('headerActivate', column)
}
function onClick(event: MouseEvent) {
  if (props.pointing) return
  const target = event.target as HTMLElement
  const cell = cellOf(target)
  if (cell?.r === -1 && !target.closest('.sheet__resize')) headerAction(props.columns[cell.c]!)
}
function onDblclick(event: MouseEvent) {
  const target = event.target as HTMLElement
  const cell = cellOf(target)
  if (!cell || cell.r < 0 || props.pointing || target.closest(WIDGETS)) return
  const row = viewRows.value[cell.r]!
  const column = props.columns[cell.c]!
  if (props.enterAction === 'activate') emit('activate', row, column)
  else emit('edit', row, column)
}

// ---- 複製：Tab 分隔＋HTML 兩種格式，整欄（Ctrl+A、Ctrl+空白鍵、從表頭複製）時連表頭一起 ----
// 聽 document 而不是表格：沒有反白文字時，瀏覽器把 copy 事件送給 <body>，不是有焦點的格子
function onCopy(event: ClipboardEvent) {
  if (interacting.value || !event.clipboardData || !root.value?.contains(document.activeElement)) return
  const area = active.value.r === -1 ? { top: 0, bottom: lastRow.value, left: active.value.c, right: active.value.c } : range.value
  const columns = props.columns.slice(area.left, area.right + 1).filter(column => column.copyable !== false)
  if (!columns.length || !rowCount.value) return
  const rows = viewRows.value.slice(area.top, area.bottom + 1)
  const matrix = rows.map(row => columns.map(column => (column.value ? column.value(row) : column.text(row))))
  const withHeader = area.top === 0 && area.bottom === lastRow.value && rowCount.value > 1
  const header = columns.map(column => column.label)
  event.clipboardData.setData('text/plain', toTsv(withHeader ? [header, ...matrix] : matrix))
  event.clipboardData.setData('text/html', toHtmlTable(matrix, columns.map(column => column.excelFormat), withHeader ? header : undefined))
  event.preventDefault()
  copied.value = area
  announce(`已複製 ${rows.length} 列 × ${columns.length} 欄${withHeader ? '，含表頭' : ''}`)
}

// ---- 拖表頭換欄（凍結欄不動）：useColumnDrag，跟 SharedMetricTable 同一份 ----
const headerCells = ref<HTMLElement[]>([])
const movableColumns = computed(() => (props.movable ? props.columns.slice(frozenCount.value).map(column => ({ field: column.key })) : []))
const { headerClassFor } = useColumnDrag({
  headerCells: () => headerCells.value.slice(frozenCount.value),
  columns: movableColumns,
  readonly: () => !props.movable,
  headerClass: 'sheet__draggable',
  canDrag: () => !resizeHandlePressed,
  onReorder: updated => emit('reorder', [...props.columns.slice(0, frozenCount.value).map(column => column.key), ...updated.map(item => item.field)])
})
const dragClass = (c: number) => (props.movable && c >= frozenCount.value ? headerClassFor(movableColumns.value[c - frozenCount.value]!, c - frozenCount.value) : '')

// ---- 每一格的樣式：框選、作用中、複製虛線、凍結、參照外框 ----
function cellClasses(r: number, c: number, column: SheetColumn<R>) {
  const area = range.value
  const multi = area.top !== area.bottom || area.left !== area.right
  // 單格時外框就是作用中那一格的框：表格沒有焦點時也看得出停在哪一格（Excel 一直都有那個框）
  const inside = r >= 0 && inRange(area, r, c)
  const ants = copied.value && r >= 0 && inRange(copied.value, r, c) ? copied.value : null
  const highlighted = !!props.highlights[column.key]
  return {
    'is-numeric': column.numeric,
    'is-frozen': c < frozenCount.value,
    'is-frozen-last': c === frozenCount.value - 1,
    'is-active': active.value.r === r && active.value.c === c,
    'is-in-range': inside && multi,
    'is-sel-top': inside && r === area.top,
    'is-sel-bottom': inside && r === area.bottom,
    'is-sel-left': inside && c === area.left,
    'is-sel-right': inside && c === area.right,
    'is-ants': !!ants,
    'is-ants-top': !!ants && r === ants.top,
    'is-ants-bottom': !!ants && r === ants.bottom,
    'is-ants-left': !!ants && c === ants.left,
    'is-ants-right': !!ants && c === ants.right,
    'is-ref': highlighted,
    'is-ref-top': highlighted && r === -1,
    'is-ref-bottom': highlighted && r === lastRow.value
  }
}
const cellStyle = (c: number, column: SheetColumn<R>) => ({
  ...(c < frozenCount.value ? { left: `${frozenLeft.value[c]}px` } : {}),
  ...(props.highlights[column.key] ? { '--sheet-ref-color': props.highlights[column.key] } : {})
})
</script>

<template>
  <div ref="root" class="sheet" @keydown="onKeydown" @pointerdown="onPointerdown" @pointerover="onPointerover" @click="onClick" @dblclick="onDblclick" @focusin="onFocusin" @focusout="onFocusout">
    <div ref="scroller" class="sheet__scroll">
      <table class="sheet__table" role="grid" aria-multiselectable="true" :aria-label="label" :aria-describedby="hintId" :style="{ width: `${tableWidth}px` }">
        <colgroup>
          <col v-for="column in columns" :key="column.key" :style="{ width: `${widthOf(column)}px` }">
        </colgroup>
        <thead>
          <tr role="row">
            <th
              v-for="(column, c) in columns"
              :key="column.key"
              :ref="el => { if (el) headerCells[c] = el as HTMLElement }"
              scope="col"
              role="columnheader"
              :aria-sort="ariaSort(column)"
              :tabindex="active.r === -1 && active.c === c ? 0 : -1"
              :data-r="-1"
              :data-c="c"
              class="sheet__cell sheet__header-cell"
              :class="[cellClasses(-1, c, column), dragClass(c), { 'is-sortable': !!column.sortValue }]"
              :style="cellStyle(c, column)"
            >
              <span class="sheet__head">
                <slot name="header" :column="column" :index="c">{{ column.label }}</slot>
                <span v-if="column.sortValue" class="sheet__sort" aria-hidden="true">{{ sortGlyph(column) }}</span>
              </span>
              <!-- 滑鼠用的把手；鍵盤在表頭上按 +／−／0（見 onHeaderKey），所以把手本身不給輔助科技 -->
              <span
                class="sheet__resize"
                aria-hidden="true"
                @pointerdown="event => startResize(event, column)"
                @pointermove="event => moveResize(event, column)"
                @pointerup="endResize"
                @pointercancel="endResize"
                @dblclick.stop="autofit(c)"
              />
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, r) in viewRows" :key="rowKey(row)" role="row">
            <component
              :is="column.rowHeader ? 'th' : 'td'"
              v-for="(column, c) in columns"
              :key="column.key"
              :role="column.rowHeader ? 'rowheader' : 'gridcell'"
              :scope="column.rowHeader ? 'row' : undefined"
              :tabindex="active.r === r && active.c === c ? 0 : -1"
              :aria-selected="String(inRange(range, r, c))"
              :data-r="r"
              :data-c="c"
              class="sheet__cell"
              :class="cellClasses(r, c, column)"
              :style="cellStyle(c, column)"
            >
              <slot name="cell" :row="row" :column="column" :text="displayText(row, column, r, c)">{{ displayText(row, column, r, c) }}</slot>
            </component>
          </tr>
        </tbody>
      </table>
    </div>
    <p :id="hintId" class="visually-hidden">{{ hint }}</p>
    <p class="visually-hidden" aria-live="polite">{{ announcement }}</p>
  </div>
</template>

<style scoped>
.sheet__scroll {
  overflow-x: auto;
}

/* 欄寬由 <col> 決定（table-layout: fixed）；格線用 separate＋右／下框線，凍結欄的 sticky 才不會跟框線錯位 */
.sheet__table {
  table-layout: fixed;
  border-collapse: separate;
  border-spacing: 0;
  font-variant-numeric: tabular-nums;
}

.sheet__cell {
  position: relative;
  padding: 8px 12px;
  overflow: hidden;
  border-right: 1px solid var(--el-border-color-lighter);
  border-bottom: 1px solid var(--el-border-color-lighter);
  background: var(--el-bg-color);
  color: var(--el-text-color-primary);
  font-weight: 400;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
  user-select: none;
  /* 框選的四邊與參照外框各是一層內陰影，class 只設變數，層層疊起來不會互相蓋掉 */
  box-shadow:
    var(--sheet-sel-top, 0 0 #0000), var(--sheet-sel-right, 0 0 #0000), var(--sheet-sel-bottom, 0 0 #0000), var(--sheet-sel-left, 0 0 #0000),
    var(--sheet-ref-top, 0 0 #0000), var(--sheet-ref-right, 0 0 #0000), var(--sheet-ref-bottom, 0 0 #0000), var(--sheet-ref-left, 0 0 #0000);
}

.sheet__header-cell {
  background: var(--el-fill-color-light);
  font-weight: 600;
}

.sheet__header-cell.is-sortable {
  cursor: pointer;
}

.sheet__cell.is-numeric {
  text-align: right;
}

.sheet__head {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 100%;
}

.sheet__sort {
  color: var(--el-text-color-regular);
  font-size: 0.875em;
}

.sheet__cell:focus-visible {
  outline: 2px solid var(--el-color-primary);
  outline-offset: -2px;
  border-radius: 0;
}

.sheet__cell.is-frozen {
  position: sticky;
  z-index: 1;
}

.sheet__header-cell.is-frozen {
  z-index: 2;
}

.sheet__cell.is-frozen-last {
  border-right: 2px solid var(--el-border-color);
}

/* 框選：淡底色＋2px 外框，作用中的那一格維持白底（研究文件：清楚指出按鍵會作用在哪一格） */
.sheet__cell.is-in-range {
  background: color-mix(in srgb, var(--el-color-primary) 10%, var(--el-bg-color));
}

.sheet__cell.is-in-range.is-active {
  background: var(--el-bg-color);
}

.is-sel-top { --sheet-sel-top: inset 0 2px 0 0 var(--el-color-primary); }
.is-sel-bottom { --sheet-sel-bottom: inset 0 -2px 0 0 var(--el-color-primary); }
.is-sel-left { --sheet-sel-left: inset 2px 0 0 0 var(--el-color-primary); }
.is-sel-right { --sheet-sel-right: inset -2px 0 0 0 var(--el-color-primary); }

/* 公式參照：整欄同色外框 */
.is-ref {
  --sheet-ref-left: inset 2px 0 0 0 var(--sheet-ref-color);
  --sheet-ref-right: inset -2px 0 0 0 var(--sheet-ref-color);
}

.is-ref-top { --sheet-ref-top: inset 0 2px 0 0 var(--sheet-ref-color); }
.is-ref-bottom { --sheet-ref-bottom: inset 0 -2px 0 0 var(--sheet-ref-color); }

/* 複製後的行進虛線（研究文件的 marching ants）：上下邊在 ::before、左右邊在 ::after，順時針跑；按 Esc 或重新排序才消失 */
.sheet__cell.is-ants::before,
.sheet__cell.is-ants::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.sheet__cell.is-ants::before {
  background:
    var(--sheet-ants-top, none) 0 0 / 8px 2px repeat-x,
    var(--sheet-ants-bottom, none) 0 100% / 8px 2px repeat-x;
  animation: sheet-ants-h 0.6s linear infinite;
}

.sheet__cell.is-ants::after {
  background:
    var(--sheet-ants-left, none) 0 0 / 2px 8px repeat-y,
    var(--sheet-ants-right, none) 100% 0 / 2px 8px repeat-y;
  animation: sheet-ants-v 0.6s linear infinite;
}

.is-ants-top { --sheet-ants-top: linear-gradient(90deg, var(--el-color-primary) 50%, transparent 0); }
.is-ants-bottom { --sheet-ants-bottom: linear-gradient(90deg, var(--el-color-primary) 50%, transparent 0); }
.is-ants-left { --sheet-ants-left: linear-gradient(0deg, var(--el-color-primary) 50%, transparent 0); }
.is-ants-right { --sheet-ants-right: linear-gradient(0deg, var(--el-color-primary) 50%, transparent 0); }

@keyframes sheet-ants-h {
  to { background-position: 8px 0, -8px 100%; }
}

@keyframes sheet-ants-v {
  to { background-position: 0 -8px, 100% 8px; }
}

@media (prefers-reduced-motion: reduce) {
  .sheet__cell.is-ants::before,
  .sheet__cell.is-ants::after {
    animation: none;
  }
}

/* 欄寬把手：表頭右緣內側 6px，滑鼠移上去是調欄寬的游標。不能伸出格子（right 給負值）：表頭格子是 overflow: hidden，伸出去的那半截
   被切掉之後，按到的其實是隔壁欄的表頭，變成拖整欄（2026-10-17 實測） */
.sheet__resize {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 1;
  width: 6px;
  cursor: col-resize;
  touch-action: none;
}

.sheet__resize:hover {
  background: var(--el-color-primary);
}

/* 拖表頭換欄：拖曳中的那一欄變淡，插入縫兩邊發亮（同 SharedMetricTable） */
.sheet__header-cell.is-dragging {
  opacity: 0.5;
}

.sheet__header-cell.is-insert-before {
  box-shadow: inset 3px 0 0 0 var(--el-color-primary);
}

.sheet__header-cell.is-insert-after {
  box-shadow: inset -3px 0 0 0 var(--el-color-primary);
}
</style>
