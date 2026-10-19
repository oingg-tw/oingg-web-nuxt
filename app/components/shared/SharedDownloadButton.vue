<script lang="ts">
// 下載一張表要的欄位描述。SharedSheetGrid 的 SheetColumn 與 HoldingsSymbolTable 的欄位都長這樣（多出來的屬性不影響），直接傳進來
export interface DownloadColumn<Row> {
  key: string
  label: string
  // 畫面上的字；沒給 value 時下載這個
  text: (row: Row) => string
  // 下載的值：數字給數字、百分比給比例（同複製到 Excel），Excel 打開是真的數字
  value?: (row: Row) => string | number | null
  // 會透露部位大小的欄（股數、金額）：預設不勾，讀者自己勾回來才下載
  sensitive?: boolean
  // false：不能下載（操作按鈕那種欄）
  copyable?: boolean
}
</script>

<script setup lang="ts" generic="Row">
// 表格下載成 CSV（2026-10-18，使用者：「holdings 或是 watchlist 希望可以下載，但是下載要有選項 比如 預設不顯示持有股數」，選了
// 持股總覽＋自訂欄位＋觀察清單、CSV、「所有會透露部位大小的」預設不下載）。按鈕打開對話框逐欄勾選，下載的是畫面上這張表目前的列與
// 排序。檔案在瀏覽器裡產生（Blob），持股是個資，不經過任何伺服器。CSV 的格式（BOM、跳脫、公式注入）在 app/utils/sheet-grid.ts 的 toCsv
const props = defineProps<{
  rows: Row[]
  columns: DownloadColumn<Row>[]
  // 檔名的前半段，例如「持股明細」；後面接台北日期與 .csv
  filename: string
}>()

// 先不畫（2026-10-19 使用者：「下載按鈕先隱藏，我想做成分享連結」）。程式留著，分享連結做好時再決定這顆按鈕要改成什麼或拿掉
const SHOWN = false

const open = ref(false)
const downloadable = computed(() => props.columns.filter(column => column.copyable !== false))
const hasSensitive = computed(() => downloadable.value.some(column => column.sensitive))
const chosen = ref<string[]>([])

function openDialog() {
  chosen.value = downloadable.value.filter(column => !column.sensitive).map(column => column.key)
  open.value = true
}

function download() {
  const columns = downloadable.value.filter(column => chosen.value.includes(column.key))
  const matrix = [
    columns.map(column => column.label),
    ...props.rows.map(row => columns.map(column => (column.value ? column.value(row) : column.text(row))))
  ]
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei' }).format(new Date())
  const url = URL.createObjectURL(new Blob([toCsv(matrix)], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `${props.filename}-${date}.csv`
  link.click()
  URL.revokeObjectURL(url)
  open.value = false
}
</script>

<template>
  <!-- 包一層：呼叫端的 class（靠右之類）才套得上；對話框本身 teleport 到 body，不佔這裡的版面 -->
  <span v-if="SHOWN" class="shared-download">
  <el-button class="shared-download__button" :disabled="!rows.length" @click="openDialog">下載</el-button>
  <el-dialog v-model="open" title="下載成 CSV" width="min(480px, 92vw)" align-center>
    <p class="download-dialog__note">
      勾選要下載的欄位。<template v-if="hasSensitive">下半部的股數與金額會透露部位大小，預設不下載，需要時自己勾回來。</template>檔案在你的瀏覽器裡產生，不會上傳。
    </p>
    <SharedColumnChecklist v-model="chosen" :columns="downloadable" label="要下載的欄位" sensitive-heading="部位大小（預設不下載）" />
    <template #footer>
      <el-button @click="open = false">取消</el-button>
      <el-button type="primary" :disabled="!chosen.length" @click="download">下載 {{ rows.length }} 列</el-button>
    </template>
  </el-dialog>
  </span>
</template>

<style scoped>
/* 跟工具列上其他按鈕同高（本站觸控下限 44px） */
.shared-download__button {
  min-height: 44px;
}

.download-dialog__note {
  margin: 0 0 12px;
  color: var(--el-text-color-regular);
  line-height: 1.7;
}

</style>
