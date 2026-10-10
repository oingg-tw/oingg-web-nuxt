<script setup lang="ts">
import { Loading } from '@element-plus/icons-vue'
import type { TableInstance } from 'element-plus'
import type { useEtfScreener } from '~/composables/etf/useEtfScreener'

// 下面那個 PresetFolder 的內容（etf-zone.vue）：目前欄位組的欄位挑選，加上每個條件組×欄位組都畫進去的同一張結果表。
// `screener` 是頁面建立一次、傳下來的同一個 useEtfScreener 實例——這裡只管「要哪些欄」，請求／分頁都在 composable。
const columns = defineModel<string[]>('columns', { required: true })

const props = defineProps<{
  screener: ReturnType<typeof useEtfScreener>
}>()

const filterSchema = useEtfFilterSchema()

const usableFields = computed(() => filterSchema.fields.value ?? [])

const hasMore = computed(() => props.screener.page.value < props.screener.totalPages.value)

// 無限捲動照抄 SharedMetricTable：哨兵放在 el-table 的 #append（同一個內部捲動容器）。表格只在 `searched` 之後才存在，
// 比本元件的 mount 晚，所以 searched 也列進重掛條件；hasMore 翻轉時 #append 的 v-if/v-else 會換掉哨兵元素。其餘見 useElTableLoadMore。
const tableRef = ref<TableInstance>()
const sentinelRef = ref<HTMLElement>()

useElTableLoadMore({
  table: tableRef,
  sentinel: sentinelRef,
  loadMore: () => props.screener.loadMore(),
  reattachOn: [() => props.screener.searched.value, hasMore]
})
useFocusableTableScroll(tableRef, 'ETF 篩選結果，可左右捲動', () => [props.screener.searched.value, props.screener.rows.value])

// @sort-change 的 prop 可以是 null（第三次點清掉排序）
function onSortChange({ prop, order }: { prop: string | null; order: 'ascending' | 'descending' | null }) {
  if (!order || !prop) {
    props.screener.setSort(null, 'desc')
    return
  }
  props.screener.setSort(prop, order === 'ascending' ? 'asc' : 'desc')
}

// 費用歷史的 26 欄並排時表頭只顯示年份（使用者要求「顯示 2026 就好」）；欄位名型態由 useEtfColumnPresets 保證
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
  // 其餘數值欄（報酬率、費用率、折溢價率）都是百分比
  return `${value}%`
}
</script>

<template>
  <div class="etf-result-table">
    <div class="etf-result-table__columns">
      <span class="etf-result-table__columns-label">顯示欄位</span>
      <el-select v-model="columns" multiple collapse-tags class="etf-result-table__column-select" aria-label="顯示欄位">
        <el-option v-for="field in usableFields" :key="field.field" :label="field.label" :value="field.field" />
      </el-select>
    </div>

    <!-- 查詢失敗不在這裡顯示，交給全站讀取失敗彈窗（etf-zone.vue 的 watchLoadFailure，2026-10-10） -->
    <template v-if="screener.searched.value">
      <p class="etf-result-table__count" role="status">共 {{ screener.count.value }} 檔符合條件</p>
      <div class="etf-result-table__table-wrap">
        <!-- 非續載的抓取（初次搜尋、排序、切換條件／欄位組）都蓋 loading；無限捲動的續載不蓋（screener.appending），
             畫面上已有的列不該被整表 spinner 蓋住，下面的 #append 頁尾負責那種情況——同 SharedMetricTable 的 loadingMore。 -->
        <el-table
          ref="tableRef"
          v-loading="screener.pending.value && !screener.appending.value"
          :data="screener.rows.value"
          height="100%"
          @sort-change="onSortChange"
        >
          <!-- 代號與名稱同一欄（使用者要求），代號粗體在上、簡稱次要色在下 -->
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

          <!-- 畫在 el-table 自己的捲動表身裡、最後一列之後（不是表格外的兄弟），useElTableLoadMore 的 observer 才看得到它進入視窗 -->
          <template v-if="screener.rows.value.length > 0" #append>
            <div v-if="hasMore" ref="sentinelRef" class="etf-result-table__load-more" role="status">
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
  font-size: 1rem;
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

.etf-result-table__count {
  margin: 0;
  font-size: 1rem;
  color: var(--el-text-color-secondary);
}

/* 手機：頁面不綁視窗高度（etf-zone.vue），表格自己限高 70dvh——<el-table height="100%"> 要有確定的高度才會開內部捲動，
   而無限捲動的 observer 以那個內部捲動容器為 root；表格不捲的話哨兵永遠在視窗內，會一頁接一頁連鎖載入。
   桌機（768px 起）：flex:1／min-height:0／height:100% 接住下面資料夾 fill-height 給的高度（同篩選器的結果表）。 */
.etf-result-table__table-wrap {
  display: flex;
  flex-direction: column;
  flex: none;
  height: 70vh;
  height: 70dvh;
}

@media (min-width: 768px) {
  .etf-result-table__table-wrap {
    flex: 1;
    min-height: 0;
    height: 100%;
  }
}

/* #append 裡的哨兵／結尾列：在表格自己的捲動表身裡，要像一列頁尾而不是浮著的區塊 */
.etf-result-table__load-more {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 44px;
  font-size: 1rem;
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
