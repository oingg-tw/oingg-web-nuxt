<script setup lang="ts">
import { InfoFilled, WarningFilled } from '@element-plus/icons-vue'
import type { TableInstance } from 'element-plus'
import Sortable from 'sortablejs'
import type { PresetFolderItem } from '~/components/shared/PresetFolder.vue'
import type { ColumnId } from '~/composables/preferred/usePreferredStocksColumnPreferences'

// Rebuilt 2026-09-06 into screener.vue's own two-layer PresetFolder pattern, per direct
// request ("我想像的是一個presetFolder給出篩選條件。下面的presetFolder呈現預設") — top folder
// picks which ROWS show (filter preset), bottom folder picks which COLUMNS show (column
// preset), matching screener.vue's filter-preset/column-preset split exactly, not the single
// topic-tab folder this page had right before. Wired to bff-ts's real GET
// /stocks/preferred-stocks (see usePreferredStockList.ts's own comment for exactly which
// fields are real vs. still null/"尚未提供").
//
// Both folders are fixed, developer-defined tabs (`editable: false` + `hideAdd`), same as
// etf-zone.vue's own topic/view switchers — there's no per-user filter-condition builder or
// column customization UI yet, just the same two-tier visual/structural shape. Filter-preset
// folder filters by 股息累積性 (real field, see usePreferredStockList.ts) per direct request
// ("篩選條件可以包含 累積型 非累積型"); a stock with dividendType null (shouldn't happen with
// today's real data) matches neither non-"全部" filter. The column-preset folder's default
// ("全部欄位") shows every available field in one
// wide table per explicit request ("目前這個預設欄位要包含所有數值"); 契約條款/估值指標 stay
// as narrower alternative views, not the default.
//
// No novice/pro split on this page (per direct request "這個頁面把專家模式與簡易模式的差異拿
// 掉") — every column shows regardless of mode, unlike preferred-stocks/[code].vue's detail
// view, which still gates 清算優先倍數/清算優先權/投資人賣回權/償債能力 to 專家模式.
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

type ColumnGroup = 'dividend' | 'liquidation' | 'issue' | 'redemption' | 'price' | 'yield' | 'convexity'

const COLUMN_PRESET_ITEMS: PresetFolderItem[] = [
  { id: 'ALL', name: '全部欄位', editable: false },
  { id: 'CONTRACT_TERMS', name: '契約條款', editable: false },
  { id: 'VALUATION', name: '估值指標', editable: false },
  { id: 'CALL_RISK', name: '贖回風險', editable: false }
]
// activeColumnPresetId + columnOrder both live in usePreferredStocksColumnPreferences.ts
// (useState, not page-local refs) so usePreferredStocksPreferencesSync.ts can reach them.
const { activeColumnPresetId, columnOrder } = usePreferredStocksColumnPreferences()

// Backend-synced as of 2026-09-07 (bff-ts's GET/PUT /users/me/preferred-stocks-preferences —
// see usePreferredStocksPreferencesSync.ts's own comment). Called once here, the one call site
// that already has usePreferredStocksColumnPreferences() in scope — same reasoning as
// useStockDetailPreferencesSync.ts's own call site in stock/[code].vue.
usePreferredStocksPreferencesSync()

// Per direct request ("比較結果presetFolder加一個贖回風險") — a fourth column preset cutting
// across the other two's groupings: 發行價/現價/溢價率/贖回日期/贖回條款/負凸性警示, the
// specific subset relevant to "will this get called away from me at a loss" risk, not the full
// 契約條款 or 估值指標 view.
const COLUMN_GROUPS: Record<ColumnPresetId, ColumnGroup[]> = {
  ALL: ['dividend', 'liquidation', 'issue', 'redemption', 'price', 'yield', 'convexity'],
  CONTRACT_TERMS: ['dividend', 'liquidation', 'issue', 'redemption'],
  VALUATION: ['price', 'yield', 'convexity'],
  CALL_RISK: ['issue', 'redemption', 'price', 'convexity']
}

function showsGroup(group: ColumnGroup): boolean {
  return COLUMN_GROUPS[activeColumnPresetId.value].includes(group)
}

function goToDetail(row: { code: string }) {
  router.push(`/preferred-stocks/${row.code}`)
}

function formatPercent(value: number | null): string {
  return value != null ? `${value.toFixed(2)}%` : '－'
}

// Drag-to-reorder columns, per direct request ("table欄位要讓用戶可以拖曳排序") — same
// SortableJS-on-the-header-row approach as StockTable.vue (that file's own comment explains
// the tableKey remount trick; not the heavier Pragmatic Drag and Drop version
// OrganismResultTable.vue uses, since that one's extra machinery — book-shelf insert-point
// highlighting — was built for screener's server-driven sortable="custom" columns, which this
// table doesn't have). Unlike those two, this table's columns each have genuinely different
// cell markup (tags, tooltips, warning icons) rather than one shared formatter over a plain
// column-def list, so columnOrder holds column IDENTIFIERS (not full column defs) and the
// template still keeps each column's own bespoke <el-table-column>, just switched on by id
// inside a v-for over columnOrder instead of being statically laid out. columnOrder itself
// (and activeColumnPresetId above) live in usePreferredStocksColumnPreferences.ts, not as a
// local ref here — see that composable's own comment on why (pending bff-ts persistence).
const COLUMN_TO_GROUP: Record<ColumnId, ColumnGroup> = {
  'dividend-type': 'dividend',
  participation: 'dividend',
  liquidation: 'liquidation',
  'issue-price': 'issue',
  'issue-date': 'issue',
  'redemption-terms': 'redemption',
  price: 'price',
  'dividend-rate': 'yield',
  'current-yield': 'yield',
  ytw: 'yield',
  'redemption-date': 'convexity',
  'redemption-risk': 'convexity',
  'premium-rate': 'convexity',
  'convexity-warning': 'convexity'
}

function isColumnVisible(id: ColumnId): boolean {
  return showsGroup(COLUMN_TO_GROUP[id])
}

// What Sortable's oldIndex/newIndex actually index into — only the currently-visible <th>s
// exist in the DOM at all, so a drag can only ever reorder within this subset. Hidden columns
// (filtered out by the active column preset) keep whatever slot they already hold in
// columnOrder untouched; they're not draggable targets since there's no <th> for them to drag.
const visibleColumnOrder = computed(() => columnOrder.value.filter(isColumnVisible))

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
  // draggable-array index 3 reported oldIndex 4). Left uncorrected, position 0 in the
  // draggable-only array was literally unreachable, which is exactly the bug reported ("我沒有
  // 辦法把發行價拉到第一個欄位") — fixed by measuring how many leading non-draggable siblings
  // exist and subtracting that count before touching visibleColumnOrder's own 0-based indices.
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

      const visible = [...visibleColumnOrder.value]
      const [moved] = visible.splice(draggableOldIndex, 1)
      visible.splice(draggableNewIndex, 0, moved!)

      // Rebuild the full order by walking the original array and substituting the newly
      // reordered visible items back into their (visible-only) slots, leaving every hidden
      // column exactly where it already was.
      let nextVisibleIndex = 0
      columnOrder.value = columnOrder.value.map(id => (isColumnVisible(id) ? visible[nextVisibleIndex++]! : id))
      tableKey.value++
    }
  })
}

onMounted(attachSortable)
// Re-attach after every remount (tableKey bump above) and whenever the visible column set
// itself changes (switching column presets swaps which <th>s exist at all).
watch([tableKey, activeColumnPresetId], () => nextTick(attachSortable))
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

    <SharedPresetFolder fill-height :items="COLUMN_PRESET_ITEMS" v-model:active-id="activeColumnPresetId" hide-add>
      <div class="preferred-stocks-page__table-wrap">
        <el-table :key="tableKey" ref="tableRef" v-loading="pending" :data="filteredStocks" row-key="code" height="100%" @row-click="goToDetail">
          <el-table-column label="代號／名稱" min-width="140" fixed>
            <template #default="{ row }">
              <NuxtLink :to="`/preferred-stocks/${row.code}`" class="preferred-stocks-page__name-link" @click.stop>
                <span class="preferred-stocks-page__code">{{ row.code }}</span>{{ row.name }}
              </NuxtLink>
            </template>
          </el-table-column>

          <!-- Drag-reorderable — each column's own bespoke markup stays exactly as it was,
               just switched on by id inside a loop over columnOrder instead of being laid out
               statically. See columnOrder's own comment for why (per-column custom rendering,
               not a shared formatter). label-class-name marks every draggable header so
               attachSortable's selector picks them all up uniformly. -->
          <template v-for="colId in columnOrder" :key="colId">
            <el-table-column v-if="colId === 'dividend-type' && showsGroup('dividend')" label="股息累積性" min-width="110" label-class-name="preferred-stocks-page__draggable-header">
              <template #default="{ row }">
                <el-tag v-if="row.dividendType" size="small" effect="plain">{{ row.dividendType === 'cumulative' ? '累積型' : '非累積型' }}</el-tag>
                <span v-else class="preferred-stocks-page__placeholder">－</span>
              </template>
            </el-table-column>
            <el-table-column v-else-if="colId === 'participation' && showsGroup('dividend')" label="股息參與權" min-width="110" label-class-name="preferred-stocks-page__draggable-header">
              <template #default="{ row }">
                <el-tag v-if="row.participation" size="small" effect="plain">{{ row.participation === 'participating' ? '參與型' : '非參與型' }}</el-tag>
                <span v-else class="preferred-stocks-page__placeholder">－</span>
              </template>
            </el-table-column>
            <el-table-column v-else-if="colId === 'liquidation' && showsGroup('liquidation')" label="清算優先權" min-width="110" label-class-name="preferred-stocks-page__draggable-header">
              <template #default="{ row }">
                <el-tag v-if="row.hasLiquidationPreference !== null" size="small" effect="plain">
                  {{ row.hasLiquidationPreference ? '具優先權' : '無優先權' }}
                </el-tag>
                <span v-else class="preferred-stocks-page__placeholder">－</span>
              </template>
            </el-table-column>
            <el-table-column v-else-if="colId === 'issue-price' && showsGroup('issue')" label="發行價" align="right" min-width="90" label-class-name="preferred-stocks-page__draggable-header">
              <template #default="{ row }">
                <span v-if="row.issuePrice != null">${{ row.issuePrice.toFixed(2) }}</span>
                <span v-else class="preferred-stocks-page__placeholder">－</span>
              </template>
            </el-table-column>
            <el-table-column v-else-if="colId === 'issue-date' && showsGroup('issue')" label="發行日" min-width="110" label-class-name="preferred-stocks-page__draggable-header">
              <template #default="{ row }">
                <span v-if="row.issueDate">{{ row.issueDate }}</span>
                <span v-else class="preferred-stocks-page__placeholder">－</span>
              </template>
            </el-table-column>
            <el-table-column v-else-if="colId === 'redemption-terms' && showsGroup('redemption')" label="贖回條款" min-width="240" label-class-name="preferred-stocks-page__draggable-header">
              <template #default="{ row }">
                <span v-if="row.redemptionConditions">{{ row.redemptionConditions }}</span>
                <el-tooltip v-else :content="REDEMPTION_UNCONFIRMED_NOTE" placement="top" :popper-style="{ maxWidth: '320px' }">
                  <span class="preferred-stocks-page__warning"><el-icon><WarningFilled /></el-icon>待查證</span>
                </el-tooltip>
              </template>
            </el-table-column>
            <el-table-column v-else-if="colId === 'price' && showsGroup('price')" label="現價" align="right" min-width="90" label-class-name="preferred-stocks-page__draggable-header">
              <template #default="{ row }">{{ row.price != null ? row.price.toFixed(2) : '－' }}</template>
            </el-table-column>
            <el-table-column v-else-if="colId === 'dividend-rate' && showsGroup('yield')" label="股息率" align="right" min-width="90" label-class-name="preferred-stocks-page__draggable-header">
              <template #default="{ row }">{{ formatPercent(row.dividendRate) }}</template>
            </el-table-column>
            <el-table-column v-else-if="colId === 'current-yield' && showsGroup('yield')" label="參考殖利率" align="right" min-width="100" label-class-name="preferred-stocks-page__draggable-header">
              <template #default="{ row }">{{ formatPercent(row.currentYield) }}</template>
            </el-table-column>
            <el-table-column v-else-if="colId === 'ytw' && showsGroup('yield')" label="最差殖利率 (YTW)" align="right" min-width="120" label-class-name="preferred-stocks-page__draggable-header">
              <template #default="{ row }">
                <span :class="{ 'preferred-stocks-page__placeholder': row.ytw === null }">{{ formatPercent(row.ytw) }}</span>
              </template>
            </el-table-column>
            <el-table-column v-else-if="colId === 'redemption-date' && showsGroup('convexity')" label="贖回日期" min-width="120" label-class-name="preferred-stocks-page__draggable-header">
              <template #default="{ row }">
                <span v-if="row.redemptionDate">{{ row.redemptionDate }}</span>
                <el-tooltip v-else :content="REDEMPTION_UNCONFIRMED_NOTE" placement="top" :popper-style="{ maxWidth: '320px' }">
                  <span class="preferred-stocks-page__warning"><el-icon><WarningFilled /></el-icon>待查證</span>
                </el-tooltip>
              </template>
            </el-table-column>
            <!-- 贖回機會(風險) = 現價－發行價 (priceMinusIssuePrice). 負值 (現價低於發行價) 用
                 is-down／綠色 per direct request — 現價已跌破發行價視為風險端；正值用
                 is-up／紅色。 A null redemptionDate used to render this whole field as "－"
                 (asserting "no redemption possible, so no risk to speak of") — per the same
                 REDEMPTION_UNCONFIRMED_NOTE reasoning as the 贖回日期/贖回條款 columns, that's
                 an unverified absence, not a confirmed one, so this shows the same 待查證
                 warning instead of a confident "－". -->
            <el-table-column v-else-if="colId === 'redemption-risk' && showsGroup('convexity')" label="贖回機會(風險)" align="right" min-width="130" label-class-name="preferred-stocks-page__draggable-header">
              <template #default="{ row }">
                <el-tooltip v-if="!row.redemptionDate" :content="REDEMPTION_UNCONFIRMED_NOTE" placement="top" :popper-style="{ maxWidth: '320px' }">
                  <span class="preferred-stocks-page__warning"><el-icon><WarningFilled /></el-icon>待查證</span>
                </el-tooltip>
                <span
                  v-else-if="row.priceMinusIssuePrice != null"
                  :class="row.priceMinusIssuePrice < 0 ? 'is-down' : row.priceMinusIssuePrice > 0 ? 'is-up' : ''"
                >
                  {{ row.priceMinusIssuePrice > 0 ? '+' : '' }}{{ row.priceMinusIssuePrice.toFixed(2) }}
                </span>
                <span v-else class="preferred-stocks-page__placeholder">尚未提供</span>
              </template>
            </el-table-column>
            <el-table-column v-else-if="colId === 'premium-rate' && showsGroup('convexity')" label="溢價率" align="right" min-width="90" label-class-name="preferred-stocks-page__draggable-header">
              <template #default="{ row }">
                <span :class="{ 'preferred-stocks-page__placeholder': premiumRate(row) === null }">
                  {{ premiumRate(row) != null ? `${premiumRate(row)!.toFixed(2)}%` : '－' }}
                </span>
              </template>
            </el-table-column>
            <el-table-column v-else-if="colId === 'convexity-warning' && showsGroup('convexity')" label="負凸性警示" min-width="140" label-class-name="preferred-stocks-page__draggable-header">
              <template #default="{ row }">
                <span v-if="hasNegativeConvexityWarning(row)" class="preferred-stocks-page__warning">
                  <el-icon><WarningFilled /></el-icon>溢價 {{ premiumRate(row)?.toFixed(2) }}%
                </span>
                <span v-else class="preferred-stocks-page__placeholder">－</span>
              </template>
            </el-table-column>
          </template>
        </el-table>
      </div>
    </SharedPresetFolder>

    <p class="preferred-stocks-page__legend">
      <el-icon class="preferred-stocks-page__legend-icon"><WarningFilled /></el-icon>
      待查證：{{ REDEMPTION_UNCONFIRMED_NOTE }}
    </p>
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

.is-up {
  color: var(--price-up-color);
}

.is-down {
  color: var(--price-down-color);
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

.preferred-stocks-page__legend {
  flex-shrink: 0;
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin: 0;
  font-size: 16px;
  color: var(--el-text-color-secondary);
}

.preferred-stocks-page__legend-icon {
  flex-shrink: 0;
  margin-top: 2px;
  color: var(--el-color-warning-dark-2);
}

:deep(.el-table__row) {
  cursor: pointer;
}
</style>
