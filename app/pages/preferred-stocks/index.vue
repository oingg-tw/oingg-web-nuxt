<script setup lang="ts">
import { InfoFilled, WarningFilled } from '@element-plus/icons-vue'
import type { TableInstance } from 'element-plus'
import Sortable from 'sortablejs'
import type { PresetFolderItem } from '~/components/shared/PresetFolder.vue'
import { COLUMN_PRESET_TEMPLATES, type ColumnId } from '~/composables/preferred/usePreferredStocksColumnPresets'

// Rebuilt 2026-09-06 into screener.vue's own two-layer PresetFolder pattern, per direct
// request ("我想像的是一個presetFolder給出篩選條件。下面的presetFolder呈現預設") — top folder
// picks which ROWS show (filter preset), bottom folder picks which COLUMNS show (column
// preset), matching screener.vue's filter-preset/column-preset split exactly, not the single
// topic-tab folder this page had right before. Wired to bff-ts's real GET
// /stocks/preferred-stocks (see usePreferredStockList.ts's own comment for exactly which
// fields are real vs. still null/"尚未提供").
//
// The filter-preset folder (top) stays fixed/developer-defined (`editable: false` + `hideAdd`)
// — filters by 股息累積性 (real field, see usePreferredStockList.ts) per direct request
// ("篩選條件可以包含 累積型 非累積型"); the user hasn't asked for custom row-filter presets.
//
// The column-preset folder (bottom) is now fully user-customizable, per direct request
// ("特別股 比較結果 欄位 要可以自定義preset跟screener一樣") — see
// usePreferredStocksColumnPresets.ts's own comment for how closely this mirrors (and where it
// deliberately diverges from) screener.vue's own column-preset architecture. The previous fixed
// 4-tab version (全部欄位/契約條款/估值指標/贖回風險) is now just this feature's starting seed
// data — same names/column sets, but freely renameable/deletable/editable now, not locked.
//
// No novice/pro split on this page (per direct request "這個頁面把專家模式與簡易模式的差異拿
// 掉") — every column in the active preset shows regardless of mode, unlike
// preferred-stocks/[code].vue's detail view, which still gates 清算優先倍數/清算優先權/投資人
// 賣回權/償債能力 to 專家模式.
//
// Height/scroll behavior copies screener.vue's own result-table recipe verbatim (per direct
// request "要加上infinite scroll 高度參考 Screener那邊的preset table"): page bounded to the
// viewport, bottom PresetFolder given `fill-height`, table wrap flex:1/min-height:0/height:100%
// so <el-table height="100%"> turns on its native sticky-header/internal-scroll mode instead of
// the whole page growing taller than the viewport. NOT real infinite scroll in the network-
// pagination sense, though — usePreferredStockList() has no server-side pagination, every row
// is already in `stocks` up front, so there's nothing left to lazily fetch as the user scrolls;
// only the height/internal-scroll half of screener's pattern applies here.
const { data: stocks, pending } = usePreferredStockList()
const router = useRouter()

// TEMPORARY shim (2026-09-08, per direct request) — mops-ts confirmed via cross-session message
// that these two codes have been manually verified: they DO carry a redemption right, but the
// company has never set a specific redemption date, so redemptionDate staying null is a
// confirmed fact, not an open question. mops-ts has already added a real `redemption_verified`
// field to their own view for exactly this distinction, but bff-ts hasn't wired it through to
// GET /stocks/preferred-stocks yet — asked them to. Once that field reaches `PreferredStock`,
// replace this hardcoded list with `stock.redemptionVerified` and delete this comment. Scoped
// ONLY to the 贖回日期 column (the one field mops-ts explicitly confirmed) — 贖回條款 still keys
// off redemptionConditions, whose status for these two codes hasn't been confirmed live (bff-ts
// was unreachable, 502, when checking), so that column's own 待查證 logic is untouched.
const VERIFIED_NO_REDEMPTION_DATE_CODES = ['1312A', '2002A']

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

// Per direct request ("上面presetFolder內容可以放說明，說明甚麼是累積型 或是非累積型") — same
// "explain the currently selected tab" pattern etf-zone.vue's own topic folders already use.
const FILTER_EXPLANATIONS: Record<FilterId, string> = {
  all: '顯示全部特別股，不篩選股息累積性。',
  cumulative: '累積型：若當期因故未發放股息，未發放的金額會累積，公司仍須於未來年度補發給股東。',
  'non-cumulative': '非累積型：若當期未發放股息，未來不會補發——虧損年份停發股息時，退休族需特別留意。'
}

// Column presets are now fully user-owned resources (create/rename/delete/reorder tabs/edit
// which columns show) — see usePreferredStocksColumnPresets.ts's own comment for the full
// architecture and how it maps to screener.vue's equivalent.
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

// --- New-preset dialog ---------------------------------------------------------------------
// Simpler than screener.vue's own two-step "自訂 vs 官方範本" dialog (ScreenerOrganismNew
// ColumnPresetDialog) — that one exists because screener's metric catalog is large/dynamic and
// warrants a real backend-driven template resource. preferred-stocks only has 15 known
// columns, so a single small dialog (name + a plain radio choice of starting point) covers the
// same "start from a template, start from what I'm looking at now, or start blank" needs
// without the extra machinery.
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

// --- Drag-to-reorder table columns, per direct request ("table欄位要讓用戶可以拖曳排序") ---
// Same SortableJS-on-the-header-row approach as StockTable.vue (that file's own comment
// explains the tableKey remount trick; not the heavier Pragmatic Drag and Drop version
// OrganismResultTable.vue uses, since that one's extra machinery — book-shelf insert-point
// highlighting — was built for screener's server-driven sortable="custom" columns, which this
// table doesn't have). Mutates the ACTIVE PRESET's own `columns` array directly now (via
// setPresetColumns) — simpler than the old separate-global-columnOrder-plus-group-visibility
// design this replaced, since a preset's columns list IS exactly the visible+ordered set, no
// separate visibility filter needed anymore.
const tableRef = ref<TableInstance>()
let sortable: Sortable | undefined
// See StockTable.vue's own comment: el-table's body rendering reads column order from an
// internal store that a keyed v-for reorder alone never re-registers, so the table needs a
// full remount (via this key) after every reorder for the body to actually follow the header.
const tableKey = ref(0)

function attachSortable() {
  sortable?.destroy()
  const rootEl = tableRef.value?.$el as HTMLElement | undefined
  if (!rootEl) return

  const headerWrapper = Array.from(rootEl.querySelectorAll<HTMLElement>('.el-table__header-wrapper')).find(
    wrapper => !wrapper.closest('.el-table__fixed, .el-table__fixed-right')
  )
  const headerRow = headerWrapper?.querySelector<HTMLElement>('thead tr')
  if (!headerRow) return

  // The fixed 代號／名稱 column is NOT actually removed from this row — Element Plus renders
  // every column (fixed included) in the one real header row here, and only visually pins the
  // fixed one via a separate absolutely-positioned overlay elsewhere in the DOM. So it's still
  // a sibling at raw index 0, and since it has no `preferred-stocks-page__draggable-header`
  // class, SortableJS never lets a dragged column swap past it — but its oldIndex/newIndex are
  // still counted in that same raw-children space (confirmed live: dragging what should be
  // array index 3 reported oldIndex 4). Left uncorrected, position 0 in the draggable-only
  // array was literally unreachable, which is exactly the bug reported ("我沒有辦法把發行價拉到
  // 第一個欄位") — fixed by measuring how many leading non-draggable siblings exist and
  // subtracting that count before touching the columns array's own 0-based indices.
  const leadingOffset = Array.from(headerRow.children).findIndex(el => el.matches('th.preferred-stocks-page__draggable-header'))

  sortable = Sortable.create(headerRow, {
    animation: 150,
    draggable: 'th.preferred-stocks-page__draggable-header',
    onEnd(evt) {
      const { oldIndex, newIndex, item, from } = evt
      if (oldIndex === undefined || newIndex === undefined || oldIndex === newIndex || leadingOffset === -1) return

      // Sortable already moved `item` in the real DOM; put it back so Vue's next render
      // starts from a consistent state, then apply the same move to the reactive array.
      from.removeChild(item)
      from.insertBefore(item, from.children[oldIndex] ?? null)

      const draggableOldIndex = oldIndex - leadingOffset
      const draggableNewIndex = newIndex - leadingOffset

      const columns = [...activePreset.value.columns]
      const [moved] = columns.splice(draggableOldIndex, 1)
      columns.splice(draggableNewIndex, 0, moved!)
      setPresetColumns(activePreset.value.id, columns)
      tableKey.value++
    }
  })
}

onMounted(attachSortable)
// Re-attach after every remount (tableKey bump above) and whenever the active preset itself
// changes (switching presets swaps which <th>s exist at all).
watch([tableKey, activePresetId], () => nextTick(attachSortable))
onUnmounted(() => sortable?.destroy())
</script>

<template>
  <div class="preferred-stocks-page">
    <h1 class="preferred-stocks-page__title">
      特別股專區
      <el-tooltip
        content="閱讀特別股入門文章"
        placement="bottom"
        trigger="hover"
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

    <SharedPresetFolder :items="FILTER_ITEMS" v-model:active-id="activeFilterId" hide-add>
      <p class="preferred-stocks-page__filter-note">{{ FILTER_EXPLANATIONS[activeFilterId] }}</p>
    </SharedPresetFolder>

    <!-- Distinct heading between the two folders, not just CSS spacing — matches
         screener.vue's own "搜尋結果" divider between its filter-preset and column-preset
         folders, per direct request that the two stay visibly separate. -->
    <h2 class="preferred-stocks-page__result-heading">比較結果</h2>

    <SharedPresetFolder
      fill-height
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

          <!-- Drag-reorderable — each column's own bespoke markup stays exactly as it was,
               just switched on by id inside a loop over the active preset's own `columns`
               instead of being laid out statically. label-class-name marks every draggable
               header so attachSortable's selector picks them all up uniformly. -->
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
            <el-table-column v-else-if="colId === 'issue-date'" label="發行日" min-width="110" label-class-name="preferred-stocks-page__draggable-header" sortable sort-by="issueDate">
              <template #default="{ row }">
                <span v-if="row.issueDate">{{ row.issueDate }}</span>
                <span v-else class="preferred-stocks-page__placeholder">－</span>
              </template>
            </el-table-column>
            <el-table-column v-else-if="colId === 'redemption-terms'" label="贖回條款" min-width="240" label-class-name="preferred-stocks-page__draggable-header" sortable sort-by="redemptionConditions">
              <template #default="{ row }">
                <span v-if="row.redemptionConditions">{{ row.redemptionConditions }}</span>
                <el-tooltip v-else :content="REDEMPTION_UNCONFIRMED_NOTE" placement="top" :popper-style="{ maxWidth: '320px' }">
                  <span class="preferred-stocks-page__warning"><el-icon><WarningFilled /></el-icon>待查證</span>
                </el-tooltip>
              </template>
            </el-table-column>
            <el-table-column v-else-if="colId === 'price'" label="現價" align="right" min-width="90" label-class-name="preferred-stocks-page__draggable-header" sortable sort-by="price">
              <template #default="{ row }">{{ row.price != null ? row.price.toFixed(2) : '－' }}</template>
            </el-table-column>
            <el-table-column v-else-if="colId === 'dividend-rate'" label="股息率" align="right" min-width="90" label-class-name="preferred-stocks-page__draggable-header" sortable sort-by="dividendRate">
              <template #default="{ row }">{{ formatPercent(row.dividendRate) }}</template>
            </el-table-column>
            <el-table-column v-else-if="colId === 'current-yield'" label="參考殖利率" align="right" min-width="100" label-class-name="preferred-stocks-page__draggable-header" sortable sort-by="currentYield">
              <template #default="{ row }">{{ formatPercent(row.currentYield) }}</template>
            </el-table-column>
            <el-table-column v-else-if="colId === 'ytw'" label="最差殖利率 (YTW)" align="right" min-width="120" label-class-name="preferred-stocks-page__draggable-header" sortable sort-by="ytw">
              <template #default="{ row }">
                <span :class="{ 'preferred-stocks-page__placeholder': row.ytw === null }">{{ formatPercent(row.ytw) }}</span>
              </template>
            </el-table-column>
            <!-- ytc/ytcAssumption only have a value when the stock is redeemable (confirmed
                 live 2026-09-07 with bff-ts) — null here means "not applicable" (no call right
                 to assume against), not a data gap, so it renders the same placeholder as any
                 other null. 'past_redemption_date_assumed_next_period' means the actual
                 redemption date has already passed with the issuer not yet acting on it
                 (analysis-ts found this true for 14/26, 54%, of redeemable issues) — ytc there
                 is a simplified "called at next coupon" scenario, not a real scheduled date.
                 'no_scheduled_redemption_date_assumed_next_period' (added 2026-09-08) is a
                 DIFFERENT premise that happens to use the same simplified scenario — the
                 contract never had a scheduled date to begin with (e.g. 1312A/2002A, see
                 VERIFIED_NO_REDEMPTION_DATE_CODES above), not one that's merely passed — so it
                 gets its own tooltip wording rather than reusing the "已過" one, which would
                 misstate the actual situation. -->
            <el-table-column v-else-if="colId === 'ytc'" label="贖回殖利率 (YTC)" align="right" min-width="150" label-class-name="preferred-stocks-page__draggable-header" sortable sort-by="ytc">
              <template #default="{ row }">
                <span v-if="row.ytc === null" class="preferred-stocks-page__placeholder">{{ formatPercent(row.ytc) }}</span>
                <el-tooltip
                  v-else-if="row.ytcAssumption === 'past_redemption_date_assumed_next_period'"
                  content="贖回日已過，發行人尚未動作，此為假設下一次配息後即被贖回之簡化試算，非實際排定的贖回時間"
                  placement="top"
                  :popper-style="{ maxWidth: '280px' }"
                >
                  <span class="preferred-stocks-page__warning">{{ formatPercent(row.ytc) }}<el-icon><WarningFilled /></el-icon></span>
                </el-tooltip>
                <el-tooltip
                  v-else-if="row.ytcAssumption === 'no_scheduled_redemption_date_assumed_next_period'"
                  content="條款具備贖回權利，但未訂定具體收回日期，此為假設下一次配息後即被贖回之簡化試算，非實際排定的贖回時間"
                  placement="top"
                  :popper-style="{ maxWidth: '280px' }"
                >
                  <span class="preferred-stocks-page__warning">{{ formatPercent(row.ytc) }}<el-icon><WarningFilled /></el-icon></span>
                </el-tooltip>
                <span v-else>{{ formatPercent(row.ytc) }}</span>
              </template>
            </el-table-column>
            <el-table-column v-else-if="colId === 'redemption-date'" label="贖回日期" min-width="120" label-class-name="preferred-stocks-page__draggable-header" sortable sort-by="redemptionDate">
              <template #default="{ row }">
                <span v-if="row.redemptionDate">{{ row.redemptionDate }}</span>
                <span v-else-if="VERIFIED_NO_REDEMPTION_DATE_CODES.includes(row.code)" class="preferred-stocks-page__placeholder">未訂定日期</span>
                <el-tooltip v-else :content="REDEMPTION_UNCONFIRMED_NOTE" placement="top" :popper-style="{ maxWidth: '320px' }">
                  <span class="preferred-stocks-page__warning"><el-icon><WarningFilled /></el-icon>待查證</span>
                </el-tooltip>
              </template>
            </el-table-column>
            <!-- 負凸性提示 used to be its own column, merged into 溢價率 itself per direct
                 request ("info icon 改放到 溢價率 那邊") — one column now carries both the
                 number and (when it crosses the threshold) the same tooltip explanation that
                 column used to show on its own. -->
            <el-table-column v-else-if="colId === 'premium-rate'" label="溢價率" align="right" min-width="110" label-class-name="preferred-stocks-page__draggable-header" sortable sort-by="premiumRatePct">
              <template #default="{ row }">
                <el-tooltip
                  v-if="hasNegativeConvexityWarning(row)"
                  content="負凸性提示：市價已高於贖回價，一旦條款觸發收回，投資人將承擔溢價虧損，資本利得空間受限。"
                  placement="top"
                  :popper-style="{ maxWidth: '280px' }"
                >
                  <span class="preferred-stocks-page__warning">{{ premiumRate(row)!.toFixed(2) }}%<el-icon><WarningFilled /></el-icon></span>
                </el-tooltip>
                <span v-else :class="{ 'preferred-stocks-page__placeholder': premiumRate(row) === null }">
                  {{ premiumRate(row) != null ? `${premiumRate(row)!.toFixed(2)}%` : '－' }}
                </span>
              </template>
            </el-table-column>
          </template>
        </el-table>
      </div>
    </SharedPresetFolder>

    <el-dialog v-model="newPresetDialogVisible" title="新增比較結果預設" width="420px" append-to-body>
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
/* Bounded to the viewport, same recipe as screener.vue's own .screener-page (copied verbatim,
   see that file's own comment for why these exact numbers) — so the bottom PresetFolder
   (fill-height, below) can be the one flex child that takes whatever's left and scrolls
   internally instead of the whole page growing taller than the viewport. */
.preferred-stocks-page {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: calc(100vh - var(--app-header-height) - var(--app-banner-height) - 16px - 88px - env(safe-area-inset-bottom));
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
  font-size: 20px;
  font-weight: 600;
  margin: 0;
}

.preferred-stocks-page__title-info {
  display: inline-flex;
  font-size: 16px;
  color: var(--el-text-color-placeholder);
  transition: color 0.2s;
}

.preferred-stocks-page__title-info:hover,
.preferred-stocks-page__title-info:focus-visible {
  color: var(--el-color-primary);
}

.preferred-stocks-page__result-heading {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
}

.preferred-stocks-page__filter-note {
  margin: 0;
  font-size: 16px;
  color: var(--el-text-color-secondary);
  line-height: 1.6;
}

/* Only call site is inside SharedPresetFolder's fillHeight body — flex:1/min-height:0 takes
   whatever height that hands down, and height:100% gives <el-table height="100%"> something
   concrete to resolve its own percentage height against, turning on its native sticky-header/
   internal-scroll mode (same recipe as screener's own .screener-result-table-wrap). No
   overflow-x:auto here anymore — el-table handles horizontal scroll internally too once
   height="100%" is set. */
.preferred-stocks-page__table-wrap {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  height: 100%;
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
  font-size: 16px;
  font-weight: 400;
  color: var(--el-text-color-secondary);
}

.preferred-stocks-page__placeholder {
  color: var(--el-text-color-placeholder);
}

.preferred-stocks-page__warning {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--el-color-warning-dark-2);
}

.preferred-stocks-page :deep(th.preferred-stocks-page__draggable-header) {
  cursor: grab;
}

:deep(.el-table__row) {
  cursor: pointer;
}
</style>
