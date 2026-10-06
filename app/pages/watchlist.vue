<script setup lang="ts">
import type { WatchlistRow } from '~/composables/stock/useWatchlistStocks'

// Personal/settings page (2026-09-19): nothing here is content for a crawler — keep it out of the
// index, and out of the sitemap via nuxt.config's own sitemap.exclude.
useSeoMeta({ robots: 'noindex, nofollow' })

// 2026-10-06 重新設計（「設計觀察清單頁面」，參考 conductor docs/2_knowledge）。使用者在 AskUserQuestion
// 決定：當日漲跌維持預設顯示；這一輪做除權息欄、移除可復原、備註、自訂排序；ETF 與特別股也收。
// 表格與卡片都在這一頁裡（持股頁同一個做法），原本只給這頁用的 StockTable／StockCard 一起刪掉。
const { watchlistCodes, watchlistIds, watchlistNotes, addStock, removeStock, moveStock, saveNote } = useStocks()
const { rows, pending, quotesFailed, priceDate } = useWatchlistStocks(watchlistCodes)
const { keyword, fetchSuggestions, routeFor } = useStockSearch()

// 這一頁自己要能加股票（2026-09-28）。加在頁首而不是只放進空狀態，是因為連續加好幾檔是這一頁最常見的
// 動作，塞進空狀態的話第一檔加完它就消失了。三種都收（2026-10-06 起；之前只收普通股）。
function handleSelect(item: Record<string, unknown>) {
  const code = String(item.code ?? '')
  if (!code || code === '__no_match__') return
  addStock(code)
  keyword.value = ''
}

// 欄位：預設就是 2026-09 以來的那幾欄（股價、漲跌、本益比、股價淨值比），加上下次除權息。漲跌金額與幅度
// 合成一欄（同 summary 卡的寫法），讓預設維持 7 欄——1920 寬放大 200%（960px）還放得下（2026-10-05 持股頁
// 量到 7 欄是上限）。
const COLUMNS = [
  { key: 'price', label: '收盤價', default: true },
  { key: 'change', label: '漲跌', default: true },
  { key: 'peRatio', label: '本益比', default: true },
  { key: 'pbRatio', label: '股價淨值比', default: true },
  { key: 'exDividend', label: '下次除權息', default: true },
  { key: 'dividendYield', label: '殖利率', default: false }
] as const
type ColumnKey = (typeof COLUMNS)[number]['key']
const visibleKeys = useState<string[]>('watchlist-visible-columns', () => COLUMNS.filter(column => column.default).map(column => column.key))
const show = (key: ColumnKey) => visibleKeys.value.includes(key)

const KIND_TAG = { etf: 'ETF', preferred: '特別股', common: null } as const
const linkOf = (row: WatchlistRow) => routeFor({ code: row.code, name: row.name, kind: row.kind })

const fixed2 = (value: number | null) => (value === null ? '－' : groupThousands(value.toFixed(2)))
const changeText = (row: WatchlistRow) =>
  row.change === null || row.changePercent === null
    ? '－'
    : `${row.change > 0 ? '+' : ''}${row.change.toFixed(2)}（${row.changePercent > 0 ? '+' : ''}${row.changePercent.toFixed(2)}%）`
const EX_LABEL = { 息: '除息', 權: '除權', 權息: '除權息' } as const
// 上游只給未來的事件、沒有發放日（預告階段本來就還沒有，已向 bff-ts 要求補上已除息未發放的那段）。
// 所以這一格只寫得出「哪天除權息、現金多少」，不寫發放日，也不猜。
const exDividendText = (row: WatchlistRow) => {
  const notice = row.nextExDividend
  if (!notice) return '－'
  const date = notice.exDate.slice(5).replace('-', '/')
  return `${date} ${EX_LABEL[notice.exType] ?? notice.exType}${notice.cashDividend !== null ? `・現金 ${notice.cashDividend} 元` : ''}`
}
// 表頭排序：沒有值的列排在最小那一端（同持股頁的 sortBy）
function sortBy(pick: (row: WatchlistRow) => number | string | null) {
  return (a: WatchlistRow, b: WatchlistRow) => {
    const x = pick(a)
    const y = pick(b)
    if (typeof x === 'string' && typeof y === 'string') return x.localeCompare(y)
    if (x === null || y === null) return x === y ? 0 : x === null ? -1 : 1
    return (x as number) - (y as number)
  }
}
const priceLabel = computed(() => (priceDate.value ? `收盤價（${priceDate.value.slice(5).replace('-', '/')}）` : '收盤價'))

// ---- 調整順序 ----
// 上移／下移按鈕而不是拖曳（同 /stock/{code}/metrics 的釘選排序）：鍵盤與觸控不用另做一套。調整順序時
// 表頭排序關掉——表頭排過的畫面順序跟清單本身的順序不同，上下移會看起來移錯位置。
const ordering = ref(false)
const tableRef = ref<{ clearSort: () => void }>()
const orderAnnouncement = ref('')
function toggleOrdering() {
  ordering.value = !ordering.value
  if (ordering.value) tableRef.value?.clearSort()
}
async function moveRow(row: WatchlistRow, offset: -1 | 1, view: 'table' | 'card') {
  moveStock(row.code, offset)
  const position = watchlistCodes.value.indexOf(row.code)
  orderAnnouncement.value = `${row.name} 移到第 ${position + 1} 個`
  await nextTick()
  // 焦點留在同一顆鈕；移到頭／尾時那一顆會 disabled，改落到同一列的另一顆
  const atEdge = offset < 0 ? position === 0 : position === watchlistCodes.value.length - 1
  const moved = offset < 0 ? 'up' : 'down'
  const direction = atEdge ? (moved === 'up' ? 'down' : 'up') : moved
  document.getElementById(`${view}-move-${direction}-${row.code}`)?.focus()
}

// ---- 備註 ----
const noteTarget = ref<WatchlistRow | null>(null)
const noteDraft = ref('')
const noteSaving = ref(false)
// 200 是 bff-ts 的上限（f39f811，POST 與 PATCH 都是；zod 數 UTF-16 code unit，跟 maxlength 同一個單位）。
const NOTE_MAX = 200
function openNote(row: WatchlistRow) {
  noteTarget.value = row
  noteDraft.value = watchlistNotes.value[row.code] ?? ''
}
async function submitNote() {
  if (!noteTarget.value) return
  noteSaving.value = true
  const saved = await saveNote(noteTarget.value.code, noteDraft.value)
  noteSaving.value = false
  if (!saved) {
    ElMessage.error('備註沒有存到，請稍後再試；你打的字還在')
    return
  }
  noteTarget.value = null
}
</script>

<template>
  <div class="watchlist-page">
    <div class="watchlist-page__header">
      <h1 class="watchlist-page__title">
        觀察清單
        <!-- 檔數跟在標題後面：這一頁沒有其他地方說得出「我追蹤了幾檔」，而那是使用者回到這一頁時
             第一個想知道的事。沒有任何一檔時不顯示，免得空狀態旁邊掛一個「共 0 檔」。 -->
        <span v-if="watchlistCodes.length" class="watchlist-page__count">共 {{ watchlistCodes.length }} 檔</span>
      </h1>
      <div class="watchlist-page__actions">
        <el-button v-if="watchlistCodes.length > 1" :type="ordering ? 'primary' : 'default'" :aria-pressed="ordering" @click="toggleOrdering">
          {{ ordering ? '完成排序' : '調整順序' }}
        </el-button>
        <StockListActions v-model:visible-column-keys="visibleKeys" :columns="COLUMNS" />
      </div>
    </div>

    <el-autocomplete
      v-model="keyword"
      :fetch-suggestions="fetchSuggestions"
      class="watchlist-page__add"
      placeholder="加入股票、ETF 或特別股：輸入代號或名稱"
      aria-label="加入到觀察清單"
      clearable
      @select="handleSelect"
    >
      <template #default="{ item }">
        <span>{{ item.code }}</span>
        <span class="watchlist-page__add-name">{{ item.name }}</span>
      </template>
    </el-autocomplete>

    <el-alert v-if="quotesFailed" type="warning" :closable="false" show-icon title="報價暫時無法取得，數字欄先顯示「－」" class="watchlist-page__alert" />
    <p class="visually-hidden" aria-live="polite">{{ orderAnnouncement }}</p>

    <div v-loading="pending && !rows.length" class="watchlist-page__content">
      <el-empty v-if="!watchlistCodes.length" description="還沒有追蹤任何股票，用上面的搜尋框加入第一檔" :image-size="64" />
      <template v-else>
        <el-table ref="tableRef" class="view-table" :data="rows" row-key="code">
          <el-table-column label="名稱" min-width="190" :sortable="!ordering" :sort-method="(a: WatchlistRow, b: WatchlistRow) => a.code.localeCompare(b.code)">
            <template #default="{ row }">
              <div class="watchlist-name">
                <NuxtLink :to="linkOf(tableRow<WatchlistRow>(row))">{{ tableRow<WatchlistRow>(row).name }}</NuxtLink>
                <span class="watchlist-name__code">{{ tableRow<WatchlistRow>(row).code }}</span>
                <el-tag v-if="KIND_TAG[tableRow<WatchlistRow>(row).kind]" size="small" effect="plain">{{ KIND_TAG[tableRow<WatchlistRow>(row).kind] }}</el-tag>
              </div>
              <p v-if="watchlistNotes[tableRow<WatchlistRow>(row).code]" class="watchlist-note">{{ watchlistNotes[tableRow<WatchlistRow>(row).code] }}</p>
            </template>
          </el-table-column>
          <el-table-column v-if="show('price')" :label="priceLabel" align="right" min-width="110" :sortable="!ordering" :sort-method="sortBy(row => row.price)">
            <template #default="{ row }">{{ fixed2(tableRow<WatchlistRow>(row).price) }}</template>
          </el-table-column>
          <el-table-column v-if="show('change')" label="漲跌" align="right" min-width="160" :sortable="!ordering" :sort-method="sortBy(row => row.changePercent)">
            <template #default="{ row }">
              <span :class="priceDirectionClass(tableRow<WatchlistRow>(row).change)">{{ changeText(tableRow<WatchlistRow>(row)) }}</span>
            </template>
          </el-table-column>
          <el-table-column v-if="show('peRatio')" label="本益比" align="right" min-width="100" :sortable="!ordering" :sort-method="sortBy(row => row.peRatio)">
            <template #default="{ row }">{{ fixed2(tableRow<WatchlistRow>(row).peRatio) }}</template>
          </el-table-column>
          <el-table-column v-if="show('pbRatio')" label="股價淨值比" align="right" min-width="120" :sortable="!ordering" :sort-method="sortBy(row => row.pbRatio)">
            <template #default="{ row }">{{ fixed2(tableRow<WatchlistRow>(row).pbRatio) }}</template>
          </el-table-column>
          <el-table-column v-if="show('dividendYield')" label="殖利率（%）" align="right" min-width="120" :sortable="!ordering" :sort-method="sortBy(row => row.dividendYield)">
            <template #default="{ row }">{{ fixed2(tableRow<WatchlistRow>(row).dividendYield) }}</template>
          </el-table-column>
          <el-table-column v-if="show('exDividend')" label="下次除權息" min-width="170" :sortable="!ordering" :sort-method="sortBy(row => row.nextExDividend?.exDate ?? null)">
            <template #default="{ row }">{{ exDividendText(tableRow<WatchlistRow>(row)) }}</template>
          </el-table-column>
          <el-table-column :label="ordering ? '順序' : '操作'" min-width="150">
            <template #default="{ row }">
              <div v-if="ordering" class="watchlist-row-actions">
                <el-button :id="`table-move-up-${tableRow<WatchlistRow>(row).code}`" link type="primary" :disabled="watchlistCodes[0] === tableRow<WatchlistRow>(row).code" :aria-label="`${tableRow<WatchlistRow>(row).name} 上移`" @click="moveRow(tableRow<WatchlistRow>(row), -1, 'table')">上移</el-button>
                <el-button :id="`table-move-down-${tableRow<WatchlistRow>(row).code}`" link type="primary" :disabled="watchlistCodes.at(-1) === tableRow<WatchlistRow>(row).code" :aria-label="`${tableRow<WatchlistRow>(row).name} 下移`" @click="moveRow(tableRow<WatchlistRow>(row), 1, 'table')">下移</el-button>
              </div>
              <div v-else class="watchlist-row-actions">
                <el-button v-if="watchlistIds[tableRow<WatchlistRow>(row).code]" link type="primary" :aria-label="`${tableRow<WatchlistRow>(row).name} 的備註`" @click="openNote(tableRow<WatchlistRow>(row))">備註</el-button>
                <el-button link type="danger" :aria-label="`從觀察清單移除 ${tableRow<WatchlistRow>(row).name}`" @click="removeStock(tableRow<WatchlistRow>(row).code)">移除</el-button>
              </div>
            </template>
          </el-table-column>
        </el-table>

        <ul class="view-card watchlist-cards">
          <li v-for="(row, index) in rows" :key="row.code" class="watchlist-card">
            <div class="watchlist-name">
              <NuxtLink :to="linkOf(row)">{{ row.name }}</NuxtLink>
              <span class="watchlist-name__code">{{ row.code }}</span>
              <el-tag v-if="KIND_TAG[row.kind]" size="small" effect="plain">{{ KIND_TAG[row.kind] }}</el-tag>
            </div>
            <p v-if="watchlistNotes[row.code]" class="watchlist-note">{{ watchlistNotes[row.code] }}</p>
            <dl class="watchlist-card__figures">
              <div v-if="show('price')"><dt>{{ priceLabel }}</dt><dd>{{ fixed2(row.price) }}</dd></div>
              <div v-if="show('change')"><dt>漲跌</dt><dd :class="priceDirectionClass(row.change)">{{ changeText(row) }}</dd></div>
              <div v-if="show('peRatio')"><dt>本益比</dt><dd>{{ fixed2(row.peRatio) }}</dd></div>
              <div v-if="show('pbRatio')"><dt>股價淨值比</dt><dd>{{ fixed2(row.pbRatio) }}</dd></div>
              <div v-if="show('dividendYield')"><dt>殖利率（%）</dt><dd>{{ fixed2(row.dividendYield) }}</dd></div>
              <div v-if="show('exDividend')" class="watchlist-card__wide"><dt>下次除權息</dt><dd>{{ exDividendText(row) }}</dd></div>
            </dl>
            <div v-if="ordering" class="watchlist-row-actions">
              <el-button :id="`card-move-up-${row.code}`" :disabled="index === 0" :aria-label="`${row.name} 上移`" @click="moveRow(row, -1, 'card')">上移</el-button>
              <el-button :id="`card-move-down-${row.code}`" :disabled="index === rows.length - 1" :aria-label="`${row.name} 下移`" @click="moveRow(row, 1, 'card')">下移</el-button>
            </div>
            <div v-else class="watchlist-row-actions">
              <el-button v-if="watchlistIds[row.code]" :aria-label="`${row.name} 的備註`" @click="openNote(row)">備註</el-button>
              <el-button type="danger" plain :aria-label="`從觀察清單移除 ${row.name}`" @click="removeStock(row.code)">移除</el-button>
            </div>
          </li>
        </ul>
      </template>
    </div>

    <el-dialog :model-value="noteTarget !== null" :title="noteTarget ? `${noteTarget.name} 的備註` : '備註'" width="min(480px, 92vw)" @close="noteTarget = null">
      <label for="watchlist-note-input" class="watchlist-note-dialog__label">為什麼想追蹤這一檔？只有你自己看得到。</label>
      <el-input id="watchlist-note-input" v-model="noteDraft" type="textarea" :rows="4" :maxlength="NOTE_MAX" show-word-limit />
      <template #footer>
        <el-button @click="noteTarget = null">取消</el-button>
        <el-button type="primary" :loading="noteSaving" @click="submitNote">儲存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.watchlist-page__header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 16px;
  margin-bottom: 16px;
}

.watchlist-page__title {
  margin: 0;
  font-size: 1.5rem;
}

.watchlist-page__count {
  margin-left: 8px;
  font-size: 1rem;
  font-weight: 400;
  color: var(--el-text-color-regular);
}

.watchlist-page__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.watchlist-page__actions :deep(.el-button) {
  min-height: 44px;
  margin: 0;
}

/* :deep 從外層打進去：el-autocomplete 的根是 tooltip 觸發器，scoped 的 data-v 屬性落不到它身上，
   直接寫 .watchlist-page__add 的話 max-width 與高度都不生效（2026-10-06 量到寬 1145px、高 24px）。 */
.watchlist-page :deep(.watchlist-page__add) {
  display: block;
  width: 100%;
  max-width: 480px;
  margin-bottom: 16px;
}

.watchlist-page :deep(.watchlist-page__add .el-input__wrapper) {
  min-height: 44px;
}

.watchlist-page__add-name {
  margin-left: 8px;
  color: var(--el-text-color-regular);
}

.watchlist-page__alert {
  margin-bottom: 16px;
}

.watchlist-name {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.watchlist-name__code {
  color: var(--el-text-color-regular);
  font-variant-numeric: tabular-nums;
}

.watchlist-note {
  margin: 4px 0 0;
  color: var(--el-text-color-regular);
  white-space: pre-line;
  overflow-wrap: anywhere;
}

.watchlist-row-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
}

.watchlist-row-actions :deep(.el-button) {
  min-height: 44px;
  margin: 0;
}

.view-table :deep(td) {
  font-variant-numeric: tabular-nums;
}

.view-card {
  display: none;
}

.watchlist-cards {
  list-style: none;
  margin: 0;
  padding: 0;
  flex-direction: column;
  gap: 12px;
}

.watchlist-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  background: var(--el-bg-color);
}

.watchlist-card__figures {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 16px;
  margin: 0;
}

.watchlist-card__wide {
  grid-column: 1 / -1;
}

.watchlist-card__figures dt {
  color: var(--el-text-color-regular);
}

.watchlist-card__figures dd {
  margin: 0;
  font-variant-numeric: tabular-nums;
}

.watchlist-note-dialog__label {
  display: block;
  margin-bottom: 8px;
}

/* 表格／卡片切換點 1279px，跟持股頁同一個（2026-10-05「a11y 要求放大 200% 也不可以跑版」）：1280 寬的
   左側欄會吃掉表格的寬度，1024～1279 之間 7 欄放不下。 */
@media (max-width: 1279px) {
  .view-table {
    display: none;
  }

  .view-card {
    display: flex;
  }
}
</style>
