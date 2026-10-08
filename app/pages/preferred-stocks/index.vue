<script setup lang="ts">
import { InfoFilled } from '@element-plus/icons-vue'
import type { TableInstance } from 'element-plus'
import Sortable from 'sortablejs'
import type { PresetFolderItem } from '~/components/shared/PresetFolder.vue'
import type { ColumnId } from '~/composables/preferred/usePreferredStocksColumnPresets'
// 特別股專區：上面的資料夾選列（依股息累積性，固定三項、不給自訂），下面的資料夾選欄（使用者自建的欄位組，
// usePreferredStocksColumnPresets），跟篩選器的「條件資料夾／欄位資料夾」同一個形狀（2026-09-06 使用者指定）。資料來自
// GET /stocks/preferred-stocks（usePreferredStockList 說明哪些欄位是真值、哪些永遠 null）。這一頁不分簡易／專家模式（使用者
// 指定），詳情頁才分。贖回條款／YTC／贖回日期三欄 2026-09-14 整個拿掉：mops-ts 停抓非官方的贖回表，那些欄位之後永遠 null。
// 桌機版頁面高度綁住視窗、表格內部捲動（同篩選器的結果表，沒有分頁——所有列一次到齊，只借它的高度配方）；手機版 2026-10-08 起
// 頁面自然長高，表格不再是整頁高的內嵌捲動區。
useSeoMeta({ title: '特別股專區' })

const { data: stocks, pending } = usePreferredStockList()
const router = useRouter()

// 每個值都要可以溯源（使用者要求）：欄位型錄（useFieldCatalog）的公式放進表頭的資訊按鈕，跟原本的說明合併成同一個 icon
const fieldCatalog = useFieldCatalog()

function fieldFormulaTooltip(field: string): string {
  return fieldCatalog.fieldFormula(field) ?? '公式載入中…'
}

type FilterId = 'all' | 'cumulative' | 'non-cumulative'

const FILTER_ITEMS: PresetFolderItem[] = [
  { id: 'all', name: '全部', editable: false },
  { id: 'non-cumulative', name: '非累積型', editable: false },
  { id: 'cumulative', name: '累積型', editable: false }
]
const activeFilterId = ref<FilterId>('all')

const filteredStocks = computed(() => {
  if (activeFilterId.value === 'all') return stocks.value
  return stocks.value.filter(stock => stock.dividendType === activeFilterId.value)
})

// 「資料日期」：每一檔的股價與殖利率都是同一個交易日的快照，取整份清單最新的 priceDate 就夠，不用逐列一欄日期
const dataAsOfDate = computed(() => {
  const dates = stocks.value.map(stock => stock.priceDate).filter((date): date is string => date !== null)
  if (!dates.length) return null
  return dates.reduce((latest, date) => (date > latest ? date : latest))
})

// 上面資料夾裡說明目前選的類型（使用者要求）；2026-09-08 精簡、不重複類型名稱——分頁標籤已經說了
const FILTER_EXPLANATIONS: Record<FilterId, string> = {
  all: '顯示全部特別股。',
  cumulative: '當期未發股息會累積，未來補發。',
  'non-cumulative': '當期未發股息不補發，虧損年份停發時需留意。'
}

const COLUMN_LABELS: Record<ColumnId, string> = {
  'dividend-type': '股息累積性',
  participation: '股息參與權',
  liquidation: '清算優先權',
  'issue-price': '發行價',
  'issue-date': '發行日',
  price: '現價',
  'dividend-rate': '票面利率',
  'current-yield': '殖利率',
  ytw: '最差殖利率 (YTW)',
  'premium-rate': '溢價率'
}

const {
  presets,
  activePresetId,
  activePreset,
  addPreset,
  renamePreset,
  removePreset,
  reorderPresets,
  setPresetColumns
} = usePreferredStocksColumnPresets()

const columnFolderItems = computed<PresetFolderItem[]>(() => presets.value.map(preset => ({ id: preset.id, name: preset.name })))

function goToDetail(row: { code: string }) {
  router.push(`/preferred-stocks/${row.code}`)
}

function formatPercent(value: number | null): string {
  return value != null ? `${value.toFixed(2)}%` : '－'
}

// --- 新增欄位組對話框：名稱＋起始欄位（範本／複製目前／空白）。比篩選器的兩步驟對話框簡單——這裡只有 10 個固定欄位，
// 沒有後端範本資源。
const newPresetDialogVisible = ref(false)
const newPresetName = ref('')
const newPresetSource = ref<string>(COLUMN_PRESET_TEMPLATES[0]!.key)

const NEW_PRESET_SOURCE_OPTIONS = computed(() => [
  ...COLUMN_PRESET_TEMPLATES.map(template => ({ value: template.key, label: template.name })),
  { value: 'copy-active', label: `複製「${activePreset.value.name}」目前的欄位` },
  { value: 'blank', label: '空白（不勾選任何欄位）' }
])

function openNewPresetDialog() {
  newPresetName.value = ''
  newPresetSource.value = COLUMN_PRESET_TEMPLATES[0]!.key
  newPresetDialogVisible.value = true
}

function confirmNewPreset() {
  const name = newPresetName.value.trim() || '新的預設'
  const template = COLUMN_PRESET_TEMPLATES.find(t => t.key === newPresetSource.value)
  const columns: ColumnId[] =
    newPresetSource.value === 'blank'
      ? []
      : newPresetSource.value === 'copy-active'
        ? [...activePreset.value.columns]
        : template
          ? [...template.columns]
          : []
  addPreset(name, columns)
  newPresetDialogVisible.value = false
}

// --- 欄位順序：表頭拖曳（SortableJS，同 PresetFolder；不用 SharedMetricTable 那套較重的 Pragmatic DnD），以及表格下方
// 「欄位順序」裡的上移／下移按鈕（2026-10-08 加的鍵盤與單指替代，WCAG 2.5.7／2.1.1）。兩條路都直接改目前欄位組的 `columns`
// （setPresetColumns）：一個欄位組的清單就是可見＋有序的集合。
const tableRef = ref<TableInstance>()
let sortable: Sortable | undefined
// el-table 的表身從內部欄位表讀順序，keyed v-for 重排不會重新登記，所以每次重排後用這個 key 整表重掛（同 SharedMetricTable 的 tableKey）
const tableKey = ref(0)

function moveColumn(index: number, offset: -1 | 1) {
  const columns = [...activePreset.value.columns]
  const [moved] = columns.splice(index, 1)
  columns.splice(index + offset, 0, moved!)
  setPresetColumns(activePreset.value.id, columns)
  tableKey.value++
}

function attachSortable() {
  sortable?.destroy()
  const rootEl = tableRef.value?.$el as HTMLElement | undefined
  if (!rootEl) return

  const headerWrapper = Array.from(rootEl.querySelectorAll<HTMLElement>('.el-table__header-wrapper')).find(
    wrapper => !wrapper.closest('.el-table__fixed, .el-table__fixed-right')
  )
  const headerRow = headerWrapper?.querySelector<HTMLElement>('thead tr')
  if (!headerRow) return

  // 固定的 代號／名稱 欄仍在同一列（Element Plus 只是另外疊一層把它釘住），SortableJS 的 oldIndex／newIndex 把它算進去，
  // 但它不可拖、也不在 columns 陣列裡：減掉前面不可拖的欄數才對得上陣列索引（實測少減時發行價永遠拉不到第一欄）
  const leadingOffset = Array.from(headerRow.children).findIndex(el => el.matches('th.preferred-stocks-page__draggable-header'))

  sortable = Sortable.create(headerRow, {
    animation: matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 150,
    draggable: 'th.preferred-stocks-page__draggable-header',
    onEnd(evt) {
      const { oldIndex, newIndex, item, from } = evt
      if (oldIndex === undefined || newIndex === undefined || oldIndex === newIndex || leadingOffset === -1) return

      // Sortable 已經動了真的 DOM；先放回去，讓 Vue 下一次渲染從一致的狀態開始，再對響應式陣列做同一個移動
      from.removeChild(item)
      from.insertBefore(item, from.children[oldIndex] ?? null)

      const columns = [...activePreset.value.columns]
      const [moved] = columns.splice(oldIndex - leadingOffset, 1)
      columns.splice(newIndex - leadingOffset, 0, moved!)
      setPresetColumns(activePreset.value.id, columns)
      tableKey.value++
    }
  })
}

onMounted(attachSortable)
// 整表重掛（tableKey）與換欄位組（<th> 整組換掉）之後重掛；資料載完也要再掛一次：第一次掛載時還在載入、沒有可拖的 <th>，
// leadingOffset 會算成 -1 而且之後每次拖曳都靜默無效（2026-09-08 實測「表頭拖曳後欄位數值沒有跟著變」）
watch([tableKey, activePresetId], () => nextTick(attachSortable))
watch(pending, isPending => {
  if (!isPending) nextTick(attachSortable)
})
onUnmounted(() => sortable?.destroy())

useFocusableTableScroll(tableRef, '特別股列表，可左右捲動', () => [tableKey.value, activePresetId.value, filteredStocks.value])
</script>

<template>
  <div class="app-page app-page--compact preferred-stocks-page">
    <h1 class="app-page__title app-page__title--app preferred-stocks-page__title">
      特別股專區
      <el-tooltip
        content="閱讀特別股入門文章"
        placement="bottom"
        :trigger="['hover', 'focus']"
        :popper-style="{ maxWidth: '280px' }"
      >
        <NuxtLink
          to="/blog/what-is-preferred-stock"
          target="_blank"
          rel="noopener"
          class="preferred-stocks-page__title-info"
          aria-label="閱讀特別股入門文章（另開新分頁）"
        >
          <el-icon><InfoFilled /></el-icon>
        </NuxtLink>
      </el-tooltip>
    </h1>

    <SharedPresetFolder label="特別股類型" :items="FILTER_ITEMS" v-model:active-id="activeFilterId" hide-add>
      <p class="preferred-stocks-page__filter-note">{{ FILTER_EXPLANATIONS[activeFilterId] }}</p>
    </SharedPresetFolder>

    <!-- 兩個資料夾之間放真的標題，不只靠間距（同篩選器的「搜尋結果」，使用者要求兩者明顯分開） -->
    <div class="preferred-stocks-page__result-header">
      <h2 class="app-page__h2 preferred-stocks-page__result-heading">比較結果</h2>
      <span v-if="dataAsOfDate" class="preferred-stocks-page__result-date">資料日期：{{ dataAsOfDate }}</span>
    </div>

    <SharedPresetFolder
      fill-height
      label="欄位組合"
      add-label="新增欄位組合"
      :items="columnFolderItems"
      v-model:active-id="activePresetId"
      @add="openNewPresetDialog"
      @rename="renamePreset"
      @remove="removePreset"
      @reorder="reorderPresets"
    >
      <div class="preferred-stocks-page__table-wrap">
        <el-table :key="tableKey" ref="tableRef" v-loading="pending" :data="filteredStocks" row-key="code" height="100%" @row-click="goToDetail">
          <el-table-column label="代號／名稱" min-width="140" fixed sortable sort-by="code">
            <template #default="{ row }">
              <NuxtLink :to="`/preferred-stocks/${row.code}`" class="preferred-stocks-page__name-link" @click.stop>
                <span class="preferred-stocks-page__code">{{ row.code }}</span>{{ row.name }}
              </NuxtLink>
            </template>
          </el-table-column>

          <!-- 依目前欄位組的 columns 順序逐一開關；label-class-name 標出每個可拖的表頭給 attachSortable 的選擇器 -->
          <template v-for="colId in activePreset.columns" :key="colId">
            <el-table-column v-if="colId === 'dividend-type'" label="股息累積性" min-width="110" label-class-name="preferred-stocks-page__draggable-header" sortable sort-by="dividendType">
              <template #default="{ row }">
                <span v-if="row.dividendType">{{ row.dividendType === 'cumulative' ? '累積型' : '非累積型' }}</span>
                <span v-else class="preferred-stocks-page__placeholder">－</span>
              </template>
            </el-table-column>
            <el-table-column v-else-if="colId === 'participation'" label="股息參與權" min-width="110" label-class-name="preferred-stocks-page__draggable-header" sortable sort-by="participation">
              <template #default="{ row }">
                <span v-if="row.participation">{{ row.participation === 'participating' ? '參與型' : '非參與型' }}</span>
                <span v-else class="preferred-stocks-page__placeholder">－</span>
              </template>
            </el-table-column>
            <el-table-column v-else-if="colId === 'liquidation'" label="清算優先權" min-width="110" label-class-name="preferred-stocks-page__draggable-header" sortable sort-by="hasLiquidationPreference">
              <template #default="{ row }">
                <span v-if="row.hasLiquidationPreference !== null">{{ row.hasLiquidationPreference ? '具優先權' : '無優先權' }}</span>
                <span v-else class="preferred-stocks-page__placeholder">－</span>
              </template>
            </el-table-column>
            <el-table-column v-else-if="colId === 'issue-price'" label="發行價" align="right" min-width="90" label-class-name="preferred-stocks-page__draggable-header" sortable sort-by="issuePrice">
              <template #default="{ row }">
                <span v-if="row.issuePrice != null">${{ row.issuePrice.toFixed(2) }}</span>
                <span v-else class="preferred-stocks-page__placeholder">－</span>
              </template>
            </el-table-column>
            <el-table-column v-else-if="colId === 'issue-date'" label="發行日" width="110" label-class-name="preferred-stocks-page__draggable-header" sortable sort-by="issueDate">
              <template #default="{ row }">
                <span v-if="row.issueDate">{{ row.issueDate }}</span>
                <span v-else class="preferred-stocks-page__placeholder">－</span>
              </template>
            </el-table-column>
            <el-table-column v-else-if="colId === 'price'" label="現價" align="right" min-width="90" label-class-name="preferred-stocks-page__draggable-header" sortable sort-by="price">
              <template #default="{ row }">{{ row.price != null ? row.price.toFixed(2) : '－' }}</template>
            </el-table-column>
            <!-- 表頭的公式說明是真的按鈕（滑鼠 hover 與鍵盤 focus 都會開，2026-10-08）；@click.stop 免得點它也觸發排序 -->
            <el-table-column v-else-if="colId === 'dividend-rate'" align="right" min-width="120" label-class-name="preferred-stocks-page__draggable-header" sortable sort-by="dividendRate">
              <template #header>
                <el-tooltip :content="fieldFormulaTooltip('nominalDividendRatePct')" placement="top" :trigger="['hover', 'focus']" :popper-style="{ maxWidth: '280px' }">
                  <button type="button" class="preferred-stocks-page__header-info" aria-label="票面利率的計算方式" @click.stop><el-icon><InfoFilled /></el-icon></button>
                </el-tooltip>
                票面利率
              </template>
              <template #default="{ row }">{{ formatPercent(row.dividendRate) }}</template>
            </el-table-column>
            <el-table-column v-else-if="colId === 'current-yield'" align="right" min-width="130" label-class-name="preferred-stocks-page__draggable-header" sortable sort-by="currentYield">
              <template #header>
                <el-tooltip :content="fieldFormulaTooltip('currentYieldPct')" placement="top" :trigger="['hover', 'focus']" :popper-style="{ maxWidth: '280px' }">
                  <button type="button" class="preferred-stocks-page__header-info" aria-label="殖利率的計算方式" @click.stop><el-icon><InfoFilled /></el-icon></button>
                </el-tooltip>
                殖利率
              </template>
              <template #default="{ row }">{{ formatPercent(row.currentYield) }}</template>
            </el-table-column>
            <el-table-column v-else-if="colId === 'ytw'" align="right" min-width="180" label-class-name="preferred-stocks-page__draggable-header" sortable sort-by="ytw">
              <template #header>
                <el-tooltip :content="fieldFormulaTooltip('ytwPct')" placement="top" :trigger="['hover', 'focus']" :popper-style="{ maxWidth: '280px' }">
                  <button type="button" class="preferred-stocks-page__header-info" aria-label="最差殖利率的計算方式" @click.stop><el-icon><InfoFilled /></el-icon></button>
                </el-tooltip>
                最差殖利率 (YTW)
              </template>
              <template #default="{ row }">
                <span :class="{ 'preferred-stocks-page__placeholder': row.ytw === null }">{{ formatPercent(row.ytw) }}</span>
              </template>
            </el-table-column>
            <!-- 負凸性提示併進溢價率的表頭說明（使用者指定「info icon 改放到溢價率那邊」，每列的值不帶 icon） -->
            <el-table-column v-else-if="colId === 'premium-rate'" align="right" width="140" label-class-name="preferred-stocks-page__draggable-header" sortable sort-by="premiumRatePct">
              <template #header>
                <el-tooltip
                  :content="`${fieldFormulaTooltip('premiumRatePct')}。負凸性提示：市價已高於贖回價時，一旦條款觸發收回，投資人將承擔溢價虧損，資本利得空間受限。`"
                  placement="top"
                  :trigger="['hover', 'focus']"
                  :popper-style="{ maxWidth: '280px' }"
                >
                  <button type="button" class="preferred-stocks-page__header-info" aria-label="溢價率的計算方式與負凸性提示" @click.stop><el-icon><InfoFilled /></el-icon></button>
                </el-tooltip>
                溢價率
              </template>
              <template #default="{ row }">
                <span :class="{ 'preferred-stocks-page__placeholder': row.premiumRatePct === null }">
                  {{ row.premiumRatePct != null ? `${row.premiumRatePct!.toFixed(2)}%` : '－' }}
                </span>
              </template>
            </el-table-column>
          </template>
        </el-table>
      </div>

      <details class="hub-details preferred-stocks-page__order">
        <summary>欄位順序</summary>
        <ol class="preferred-stocks-page__order-list">
          <li v-for="(colId, index) in activePreset.columns" :key="colId">
            <span class="preferred-stocks-page__order-label">{{ COLUMN_LABELS[colId] }}</span>
            <el-button :disabled="index === 0" @click="moveColumn(index, -1)">上移<span class="visually-hidden">：{{ COLUMN_LABELS[colId] }}</span></el-button>
            <el-button :disabled="index === activePreset.columns.length - 1" @click="moveColumn(index, 1)">下移<span class="visually-hidden">：{{ COLUMN_LABELS[colId] }}</span></el-button>
          </li>
        </ol>
      </details>
    </SharedPresetFolder>

    <el-dialog v-model="newPresetDialogVisible" title="新增比較結果預設" width="min(420px, calc(100vw - 32px))" append-to-body>
      <el-form label-position="top" @submit.prevent="confirmNewPreset">
        <el-form-item label="名稱">
          <el-input v-model="newPresetName" placeholder="新的預設" maxlength="20" show-word-limit @keyup.enter="confirmNewPreset" />
        </el-form-item>
        <el-form-item label="起始欄位">
          <el-radio-group v-model="newPresetSource" class="preferred-stocks-page__preset-source">
            <el-radio v-for="option in NEW_PRESET_SOURCE_OPTIONS" :key="option.value" :value="option.value">{{ option.label }}</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="newPresetDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmNewPreset">建立</el-button>
      </template>
    </el-dialog>

  </div>
</template>

<style scoped>
/* 桌機版才把頁面綁在視窗高度（同篩選器 .screener-page 的配方）：下面的資料夾 fill-height 吃掉剩下的高度、表格內部捲動。
   手機版不綁：頁面自然長高、表格全部列出，整頁一起捲，底部也不保留 AppFeatureMenu 浮動按鈕的 88px（它蓋在上面就好） */
@media (min-width: 768px) {
  .preferred-stocks-page {
    height: calc(100vh - var(--app-header-height) - var(--app-banner-height) - 16px - env(safe-area-inset-bottom));
  }
}

@media (min-width: 1280px) {
  .preferred-stocks-page {
    height: calc(100vh - var(--app-header-height) - var(--app-banner-height) - 16px - 20px);
  }
}

.preferred-stocks-page__title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.preferred-stocks-page__title-info {
  display: inline-flex;
  font-size: 1rem;
  color: var(--el-text-color-placeholder);
  transition: color 0.2s;
}

.preferred-stocks-page__title-info:hover,
.preferred-stocks-page__title-info:focus-visible {
  color: var(--el-color-primary);
}

.preferred-stocks-page__result-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.preferred-stocks-page__result-date {
  font-size: 1rem;
  color: var(--el-text-color-secondary);
}

/* SharedPresetFolder 的內容區在手機沒有內距（表格要貼齊邊），純文字自己補；768px 起資料夾自己有內距，這裡歸零免得疊兩層 */
.preferred-stocks-page__filter-note {
  margin: 0;
  padding: 16px;
  font-size: 1rem;
  color: var(--el-text-color-secondary);
  line-height: 1.6;
}

@media (min-width: 768px) {
  .preferred-stocks-page__filter-note {
    padding: 0;
  }
}

/* flex:1／min-height:0 接住資料夾給的高度，height:100% 讓 <el-table height="100%"> 有東西可以算，開啟它的固定表頭＋內部捲動；
   橫向捲動也由 el-table 自己處理 */
.preferred-stocks-page__table-wrap {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  height: 100%;
}

.preferred-stocks-page__order {
  margin-top: 12px;
}

.preferred-stocks-page__order-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0 0 0 20px;
}

.preferred-stocks-page__order-list li {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.preferred-stocks-page__order-label {
  min-width: 8em;
}

.preferred-stocks-page__preset-source {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.preferred-stocks-page__name-link {
  display: flex;
  flex-direction: column;
  gap: 2px;
  color: var(--el-text-color-primary);
  font-weight: 600;
  text-decoration: none;
}

.preferred-stocks-page__name-link:hover {
  color: var(--el-color-primary);
}

.preferred-stocks-page__code {
  font-size: 1rem;
  font-weight: 400;
  color: var(--el-text-color-secondary);
}

.preferred-stocks-page__placeholder {
  color: var(--el-text-color-placeholder);
}

.preferred-stocks-page__header-info {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  min-height: 24px;
  margin-right: 4px;
  padding: 0;
  border: 0;
  background: none;
  color: var(--el-text-color-placeholder);
  font: inherit;
  vertical-align: middle;
  cursor: help;
}

.preferred-stocks-page__header-info:hover,
.preferred-stocks-page__header-info:focus-visible {
  color: var(--el-color-primary);
}

.preferred-stocks-page :deep(th.preferred-stocks-page__draggable-header) {
  cursor: grab;
}

/* 表頭不換行：最差殖利率 (YTW) 換成兩行看起來像壞掉，欄寬之外再加一道保險 */
.preferred-stocks-page :deep(.el-table__header .cell) {
  white-space: nowrap;
}

:deep(.el-table__row) {
  cursor: pointer;
}
</style>
