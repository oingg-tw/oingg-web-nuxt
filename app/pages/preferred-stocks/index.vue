<script setup lang="ts">
import { WarningFilled } from '@element-plus/icons-vue'
import type { PresetFolderItem } from '~/components/shared/PresetFolder.vue'

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
// today's real data, but fixture fallback also always populates it) matches neither non-"全部"
// filter. The column-preset folder's default ("全部欄位") shows every available field in one
// wide table per explicit request ("目前這個預設欄位要包含所有數值"); 契約條款/估值指標 stay
// as narrower alternative views, not the default.
//
// No novice/pro split on this page (per direct request "這個頁面把專家模式與簡易模式的差異拿
// 掉") — every column shows regardless of mode, unlike preferred-stocks/[code].vue's detail
// view, which still gates 清算優先倍數/清算優先權/投資人賣回權/償債能力 to 專家模式.
const { data: stocks } = usePreferredStockList()
const router = useRouter()

type FilterId = 'all' | 'cumulative' | 'non-cumulative'

const FILTER_ITEMS: PresetFolderItem[] = [
  { id: 'all', name: '全部', editable: false },
  { id: 'cumulative', name: '累積型', editable: false },
  { id: 'non-cumulative', name: '非累積型', editable: false }
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

type ColumnPresetId = 'all' | 'contract-terms' | 'valuation' | 'call-risk'
type ColumnGroup = 'dividend' | 'liquidation' | 'issue' | 'redemption' | 'price' | 'yield' | 'convexity'

const COLUMN_PRESET_ITEMS: PresetFolderItem[] = [
  { id: 'all', name: '全部欄位', editable: false },
  { id: 'contract-terms', name: '契約條款', editable: false },
  { id: 'valuation', name: '估值指標', editable: false },
  { id: 'call-risk', name: '買回風險', editable: false }
]
const activeColumnPresetId = ref<ColumnPresetId>('all')

// Per direct request ("比較結果presetFolder加一個買回風險") — a fourth column preset cutting
// across the other two's groupings: 發行價/現價/溢價率/距贖回日/發行人贖回權/負凸性警示, the
// specific subset relevant to "will this get called away from me at a loss" risk, not the full
// 契約條款 or 估值指標 view.
const COLUMN_GROUPS: Record<ColumnPresetId, ColumnGroup[]> = {
  all: ['dividend', 'liquidation', 'issue', 'redemption', 'price', 'yield', 'convexity'],
  'contract-terms': ['dividend', 'liquidation', 'issue', 'redemption'],
  valuation: ['price', 'yield', 'convexity'],
  'call-risk': ['issue', 'redemption', 'price', 'convexity']
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
</script>

<template>
  <div class="preferred-stocks-page">
    <div class="preferred-stocks-page__header">
      <h1 class="preferred-stocks-page__title">特別股專區</h1>
      <p class="preferred-stocks-page__subtitle">
        特別股比較——契約條款解構與估值指標，協助評估相對於普通股與債券的風險報酬定位
      </p>
    </div>

    <div class="preferred-stocks-page__disclaimer" role="alert">
      提示：股價與部分契約條款為即時資料，惟最差殖利率 (YTW)、清算優先倍數與投資人賣回權目前無資料來源，表格中會標示「－」，並非該檔實際數值為零或不適用。
    </div>

    <SharedPresetFolder :items="FILTER_ITEMS" v-model:active-id="activeFilterId" hide-add>
      <p class="preferred-stocks-page__filter-note">{{ FILTER_EXPLANATIONS[activeFilterId] }}</p>
    </SharedPresetFolder>

    <!-- Distinct heading between the two folders, not just CSS spacing — matches
         screener.vue's own "搜尋結果" divider between its filter-preset and column-preset
         folders, per direct request that the two stay visibly separate. -->
    <h2 class="preferred-stocks-page__result-heading">比較結果</h2>

    <SharedPresetFolder :items="COLUMN_PRESET_ITEMS" v-model:active-id="activeColumnPresetId" hide-add>
      <div class="preferred-stocks-page__table-wrap">
        <el-table :data="filteredStocks" row-key="code" @row-click="goToDetail">
          <el-table-column label="名稱／代號" min-width="140" fixed>
            <template #default="{ row }">
              <NuxtLink :to="`/preferred-stocks/${row.code}`" class="preferred-stocks-page__name-link" @click.stop>
                {{ row.name }}<span class="preferred-stocks-page__code">{{ row.code }}</span>
              </NuxtLink>
            </template>
          </el-table-column>

          <template v-if="showsGroup('dividend')">
            <el-table-column label="股息累積性" min-width="110">
              <template #default="{ row }">
                <el-tag v-if="row.dividendType" size="small" effect="plain">{{ row.dividendType === 'cumulative' ? '累積型' : '非累積型' }}</el-tag>
                <span v-else class="preferred-stocks-page__placeholder">－</span>
              </template>
            </el-table-column>
            <el-table-column label="股息參與權" min-width="110">
              <template #default="{ row }">
                <el-tag v-if="row.participation" size="small" effect="plain">{{ row.participation === 'participating' ? '參與型' : '非參與型' }}</el-tag>
                <span v-else class="preferred-stocks-page__placeholder">－</span>
              </template>
            </el-table-column>
          </template>
          <el-table-column v-if="showsGroup('liquidation')" label="清算優先權" min-width="110">
            <template #default="{ row }">
              <el-tag v-if="row.hasLiquidationPreference !== null" size="small" effect="plain">
                {{ row.hasLiquidationPreference ? '具優先權' : '無優先權' }}
              </el-tag>
              <span v-else class="preferred-stocks-page__placeholder">－</span>
            </template>
          </el-table-column>
          <template v-if="showsGroup('issue')">
            <el-table-column label="發行價" align="right" min-width="90">
              <template #default="{ row }">
                <span v-if="row.issuePrice != null">${{ row.issuePrice.toFixed(2) }}</span>
                <span v-else class="preferred-stocks-page__placeholder">－</span>
              </template>
            </el-table-column>
            <el-table-column label="發行日" min-width="110">
              <template #default="{ row }">
                <span v-if="row.issueDate">{{ row.issueDate }}</span>
                <span v-else class="preferred-stocks-page__placeholder">－</span>
              </template>
            </el-table-column>
          </template>
          <el-table-column v-if="showsGroup('redemption')" label="發行人贖回權" min-width="240">
            <template #default="{ row }">
              <span v-if="row.redemptionConditions">{{ row.redemptionConditions }}</span>
              <span v-else class="preferred-stocks-page__placeholder">無贖回條款</span>
            </template>
          </el-table-column>
          <el-table-column v-if="showsGroup('price')" label="現價" align="right" min-width="90">
            <template #default="{ row }">{{ row.price != null ? row.price.toFixed(2) : '－' }}</template>
          </el-table-column>
          <template v-if="showsGroup('yield')">
            <el-table-column label="股息率" align="right" min-width="90">
              <template #default="{ row }">{{ formatPercent(row.dividendRate) }}</template>
            </el-table-column>
            <el-table-column label="參考殖利率" align="right" min-width="100">
              <template #default="{ row }">{{ formatPercent(row.currentYield) }}</template>
            </el-table-column>
            <el-table-column label="最差殖利率 (YTW)" align="right" min-width="120">
              <template #default="{ row }">
                <span :class="{ 'preferred-stocks-page__placeholder': row.ytw === null }">{{ formatPercent(row.ytw) }}</span>
              </template>
            </el-table-column>
          </template>
          <template v-if="showsGroup('convexity')">
            <el-table-column label="距贖回日" min-width="120">
              <template #default="{ row }">{{ callCountdown(row) }}</template>
            </el-table-column>
            <el-table-column label="溢價率" align="right" min-width="90">
              <template #default="{ row }">
                <span :class="{ 'preferred-stocks-page__placeholder': premiumRate(row) === null }">
                  {{ premiumRate(row) != null ? `${premiumRate(row)!.toFixed(2)}%` : '－' }}
                </span>
              </template>
            </el-table-column>
            <el-table-column label="負凸性警示" min-width="140">
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
  </div>
</template>

<style scoped>
.preferred-stocks-page {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.preferred-stocks-page__header {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.preferred-stocks-page__title {
  font-size: 20px;
  font-weight: 600;
  margin: 0;
}

.preferred-stocks-page__subtitle {
  font-size: 16px;
  color: var(--el-text-color-secondary);
  margin: 0;
}

.preferred-stocks-page__disclaimer {
  padding: 10px 16px;
  border-radius: 8px;
  background: var(--el-color-warning-light-9);
  color: var(--el-color-warning-dark-2);
  font-size: 16px;
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

.preferred-stocks-page__table-wrap {
  overflow-x: auto;
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

:deep(.el-table__row) {
  cursor: pointer;
}
</style>
