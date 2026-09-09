<script setup lang="ts">
import { Loading } from '@element-plus/icons-vue'
import type { TableInstance } from 'element-plus'
import type { useEtfScreener } from '~/composables/etf/useEtfScreener'
import { ETF_UNRELIABLE_FIELDS } from '~/composables/etf/useEtfScreener'

// Bottom PresetFolder's own slot content (etf-zone.vue) — column picker for the currently
// active column preset, plus the one shared results table every filter/column preset
// combination renders into. `screener` is the single `useEtfScreener()` instance the page
// creates once and passes down here — this component's own local state is only about WHICH
// columns to request, not the request/response/pagination mechanics themselves (those live in
// the composable, shared with EtfFilterEditor.vue's own sibling folder).
const columns = defineModel<string[]>('columns', { required: true })

const props = defineProps<{
  screener: ReturnType<typeof useEtfScreener>
}>()

const filterSchema = useEtfFilterSchema()

const usableFields = computed(() => (filterSchema.fields.value ?? []).filter(field => !ETF_UNRELIABLE_FIELDS.includes(field.field)))

const hasMore = computed(() => props.screener.page.value < props.screener.totalPages.value)

// Infinite scroll — copied verbatim from screener.vue's own OrganismResultTable.vue (per direct
// request "照抄個股篩選"), not the page-level-scroll version this file had before. el-table
// wraps its body in its own <ElScrollbar>, and the actual `overflow: auto` element with a real
// scrollHeight is nested two levels deeper than `.el-table__body-wrapper` itself —
// `.el-table__body-wrapper .el-scrollbar__wrap` inside it (confirmed live by OrganismResultTable
// .vue's own comment; targeting body-wrapper directly silently no-ops, stuck at
// scrollHeight === clientHeight). The sentinel lives inside el-table's own #append slot (part of
// that same internal scroll container), not as a sibling in normal page flow — that only works
// once the table itself is given `height="100%"` inside a flex:1/min-height:0 ancestor chain
// (etf-zone.vue's own page-bounded-to-viewport CSS), same recipe preferred-stocks/index.vue's
// own comment describes copying from screener.vue.
const tableRef = ref<TableInstance>()
const sentinelRef = ref<HTMLElement>()
let observer: IntersectionObserver | null = null

function attachLoadMoreObserver() {
  observer?.disconnect()
  const rootEl = tableRef.value?.$el as HTMLElement | undefined
  // Fixed columns (symbol/name, see the fixed prop below) give el-table more than one
  // .el-table__body-wrapper — one per fixed-column group, same exclusion the header-drag
  // reach-in on the stock/preferred-stock tables already needs for their own header-wrapper.
  const bodyWrapper = Array.from(rootEl?.querySelectorAll<HTMLElement>('.el-table__body-wrapper') ?? []).find(
    wrapper => !wrapper.closest('.el-table__fixed, .el-table__fixed-right')
  )
  const scrollRoot = bodyWrapper?.querySelector<HTMLElement>('.el-scrollbar__wrap')
  if (!scrollRoot || !sentinelRef.value) return
  observer = new IntersectionObserver(
    entries => {
      if (entries[0]?.isIntersecting) props.screener.loadMore()
    },
    // Triggers a little before the sentinel is actually fully in view — loading only once the
    // user has scrolled all the way to the literal bottom reads as a stall.
    { root: scrollRoot, rootMargin: '200px' }
  )
  observer.observe(sentinelRef.value)
}

// `IntersectionObserver` doesn't exist during SSR — attachLoadMoreObserver only ever runs from
// onMounted/watch (both client-only lifecycle hooks), never at plain setup() time, so this never
// executes server-side. The table (and its #append sentinel) only exists once
// `screener.searched` is true, later than this component's own mount on a fresh page load —
// re-attach whenever that flips, and whenever `hasMore` toggles (the #append slot's v-if/v-else
// branch swap recreates the sentinel element each time).
onMounted(() => nextTick(attachLoadMoreObserver))
watch([() => props.screener.searched.value, hasMore], () => nextTick(attachLoadMoreObserver))
onBeforeUnmount(() => observer?.disconnect())

function onSortChange({ prop, order }: { prop: string; order: 'ascending' | 'descending' | null }) {
  if (!order) {
    props.screener.setSort(null, 'desc')
    return
  }
  props.screener.setSort(prop, order === 'ascending' ? 'asc' : 'desc')
}

// Per direct request ("當選擇費用歷史時，表頭就不用顯示 總費用率 (2026) 顯示 2026 就好，避免無效
// 資訊") — the schema's own label ("總費用率 (2026)") is fine as a one-off column but redundant
// across all 26 expenseRatioYYYY columns sitting side by side, where the "總費用率" part is
// already obvious from context and just eats space. Field-name pattern match only (no backend
// change needed) since useEtfColumnPresets.ts's own EXPENSE_RATIO_HISTORY_COLUMNS already
// guarantees the `expenseRatio${year}` shape.
function columnLabel(field: string): string {
  const year = /^expenseRatio(\d{4})$/.exec(field)?.[1]
  return year ?? filterSchema.fieldLabel(field)
}

function formatCellValue(field: string, value: string | number | boolean | null): string {
  if (value === null) return '－'
  const schemaField = filterSchema.fields.value?.find(item => item.field === field)
  if (schemaField?.kind === 'categorical') return String(value)
  if (typeof value !== 'number') return String(value)
  if (field === 'aum' || field === 'nav' || field === 'dcaAmount' || field === 'statutoryAumThreshold') {
    return value.toLocaleString('zh-TW')
  }
  // expenseRatio is excluded entirely (never reaches this formatter — see
  // ETF_UNRELIABLE_FIELDS); every remaining numeric field here (return* periods, and
  // premiumDiscountPct added 2026-09-10 — confirmed live via POST /etf-screener, no frontend
  // change needed since this is a generic field-passthrough design) is a plain percentage,
  // shown with a % suffix per the schema's own label wording ("近1年報酬率"/"折溢價率" etc).
  return `${value}%`
}
</script>

<template>
  <div class="etf-result-table">
    <div class="etf-result-table__columns">
      <span class="etf-result-table__columns-label">顯示欄位</span>
      <el-select v-model="columns" multiple collapse-tags size="small" class="etf-result-table__column-select">
        <el-option v-for="field in usableFields" :key="field.field" :label="field.label" :value="field.field" />
      </el-select>
    </div>

    <p v-if="screener.errorMessage.value" class="etf-result-table__error">
      查詢失敗：{{ screener.errorMessage.value }}
    </p>

    <template v-else-if="screener.searched.value">
      <p class="etf-result-table__count">共 {{ screener.count.value }} 檔符合條件</p>
      <div class="etf-result-table__table-wrap">
        <!-- Loading overlay for any non-append fetch (initial search, sort click, filter/preset
             switch) — per direct request that a sort/load delay show a loader, not just the
             very first fetch. Infinite-scroll appends are excluded (screener.appending) since
             rows already on screen shouldn't be covered by a full-table spinner; the #append
             footer below covers that case instead, same split OrganismResultTable.vue's own
             loadingMore prop makes. -->
        <el-table
          ref="tableRef"
          v-loading="screener.pending.value && !screener.appending.value"
          :data="screener.rows.value"
          height="100%"
          size="small"
          @sort-change="onSortChange"
        >
          <!-- Combined per direct request ("ETF 代號與名稱要同一欄位呈現") — was two separate
               fixed columns (代號/名稱), now one cell stacking symbol (bold) over shortName
               (secondary color), same "one identity cell" pattern common fintech ETF/stock
               listings use once both fields are always shown together anyway. -->
          <el-table-column label="ETF" prop="symbol" min-width="160" fixed sortable="custom">
            <template #default="{ row }">
              <NuxtLink :to="`/stock/${row.symbol}`" class="etf-result-table__identity" @click.stop>
                <span class="etf-result-table__identity-symbol">{{ row.symbol }}</span>
                <span class="etf-result-table__identity-name">{{ row.shortName }}</span>
              </NuxtLink>
            </template>
          </el-table-column>
          <el-table-column
            v-for="field in columns"
            :key="field"
            :label="columnLabel(field)"
            :prop="field"
            align="right"
            min-width="120"
            sortable="custom"
          >
            <template #default="{ row }">{{ formatCellValue(field, row.values[field] ?? null) }}</template>
          </el-table-column>

          <!-- Renders INSIDE el-table's own scrollable body, after the last data row — not a
               sibling outside the table — so attachLoadMoreObserver's IntersectionObserver can
               watch it scrolling into view within that same internal scroll container. -->
          <template v-if="screener.rows.value.length > 0" #append>
            <div v-if="hasMore" ref="sentinelRef" class="etf-result-table__load-more">
              <el-icon v-if="screener.appending.value" class="etf-result-table__load-more-spinner"><Loading /></el-icon>
              <span>{{ screener.appending.value ? '載入更多…' : '' }}</span>
            </div>
            <p v-else class="etf-result-table__load-more etf-result-table__load-more--end">已顯示全部符合條件的 ETF</p>
          </template>
        </el-table>
      </div>
    </template>
  </div>
</template>

<style scoped>
.etf-result-table {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  height: 100%;
  gap: 12px;
}

.etf-result-table__columns {
  display: flex;
  align-items: center;
  gap: 8px;
}

.etf-result-table__columns-label {
  font-size: 16px;
  color: var(--el-text-color-secondary);
  flex-shrink: 0;
}

.etf-result-table__column-select {
  flex: 1;
}

.etf-result-table__identity {
  display: flex;
  flex-direction: column;
  gap: 2px;
  text-decoration: none;
  color: inherit;
  line-height: 1.3;
}

.etf-result-table__identity-symbol {
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.etf-result-table__identity-name {
  color: var(--el-text-color-secondary);
}

.etf-result-table__error {
  color: var(--el-color-danger);
  font-size: 16px;
}

.etf-result-table__count {
  margin: 0;
  font-size: 16px;
  color: var(--el-text-color-secondary);
}

/* Same flex:1/min-height:0/height:100% recipe preferred-stocks/index.vue's own
   __table-wrap uses (copied from screener.vue) — takes whatever height the bottom
   PresetFolder's fillHeight body hands down so <el-table height="100%"> resolves against a
   real pixel value and turns on its native sticky-header/internal-scroll mode. */
.etf-result-table__table-wrap {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  height: 100%;
}

/* Sentinel/end-of-list row rendered via el-table's #append slot — inside the table's own
   scrollable body, so it needs to read as a row-like footer, not a floating block. 16px floor
   per this app's global font-size policy even though it's a secondary/status line. */
.etf-result-table__load-more {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 44px;
  font-size: 16px;
  color: var(--el-text-color-secondary);
}

.etf-result-table__load-more--end {
  margin: 0;
}

.etf-result-table__load-more-spinner {
  animation: etf-result-table-spin 1s linear infinite;
}

@keyframes etf-result-table-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
