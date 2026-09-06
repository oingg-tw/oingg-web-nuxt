<script setup lang="ts">
import { WarningFilled } from '@element-plus/icons-vue'
import type { PresetFolderItem } from '~/components/shared/PresetFolder.vue'

// Rebuilt 2026-09-06 into the same PresetFolder + real-data-table format every other zone
// page already uses (ky-stocks.vue/emerging-market.vue/etf-zone.vue), per direct request
// ("preferred-stocks 改用 presetFolder + table 那樣的呈現方式") after this page's earlier
// per-stock-card layout drifted away from that established convention. Wired to bff-ts's real
// GET /stocks/preferred-stocks (see usePreferredStockList.ts's own comment for exactly which
// fields are real vs. still null/"尚未提供") — two topics, split along the same real-vs-not-yet
// line the data itself has: 契約條款 (real fields) and 估值指標 (price/dividendRate/
// currentYield real, YTW/溢價率 still placeholders pending analysis-ts's own YTW calc).
const { data: stocks } = usePreferredStockList()
const { mode: experienceMode } = useDashboardExperienceMode()
const router = useRouter()

type TopicId = 'contract-terms' | 'valuation'

const TOPIC_ITEMS: PresetFolderItem[] = [
  { id: 'contract-terms', name: '契約條款', editable: false },
  { id: 'valuation', name: '估值指標', editable: false }
]
const activeTopicId = ref<TopicId>('contract-terms')

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
      <div>
        <h1 class="preferred-stocks-page__title">特別股專區</h1>
        <p class="preferred-stocks-page__subtitle">
          特別股比較——契約條款解構與估值指標，協助評估相對於普通股與債券的風險報酬定位
        </p>
      </div>
      <el-radio-group v-model="experienceMode" size="small">
        <el-radio-button value="novice">簡易模式</el-radio-button>
        <el-radio-button value="pro">專家模式</el-radio-button>
      </el-radio-group>
    </div>

    <div class="preferred-stocks-page__disclaimer" role="alert">
      提示：股價與部分契約條款為即時資料，惟最差殖利率 (YTW)、清算優先倍數與投資人賣回權目前無資料來源，表格中會標示「－」，並非該檔實際數值為零或不適用。
    </div>

    <SharedPresetFolder :items="TOPIC_ITEMS" v-model:active-id="activeTopicId" hide-add>
      <el-table v-if="activeTopicId === 'contract-terms'" :data="stocks" row-key="code" @row-click="goToDetail">
        <el-table-column label="名稱／代號" min-width="140">
          <template #default="{ row }">
            <NuxtLink :to="`/preferred-stocks/${row.code}`" class="preferred-stocks-page__name-link" @click.stop>
              {{ row.name }}<span class="preferred-stocks-page__code">{{ row.code }}</span>
            </NuxtLink>
          </template>
        </el-table-column>
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
        <el-table-column v-if="experienceMode === 'pro'" label="清算優先權" min-width="110">
          <template #default="{ row }">
            <el-tag v-if="row.hasLiquidationPreference !== null" size="small" effect="plain">
              {{ row.hasLiquidationPreference ? '具優先權' : '無優先權' }}
            </el-tag>
            <span v-else class="preferred-stocks-page__placeholder">－</span>
          </template>
        </el-table-column>
        <el-table-column label="發行人贖回權" min-width="240">
          <template #default="{ row }">
            <span v-if="row.redemptionConditions">{{ row.redemptionConditions }}</span>
            <span v-else class="preferred-stocks-page__placeholder">無贖回條款</span>
          </template>
        </el-table-column>
      </el-table>

      <el-table v-else :data="stocks" row-key="code" @row-click="goToDetail">
        <el-table-column label="名稱／代號" min-width="140">
          <template #default="{ row }">
            <NuxtLink :to="`/preferred-stocks/${row.code}`" class="preferred-stocks-page__name-link" @click.stop>
              {{ row.name }}<span class="preferred-stocks-page__code">{{ row.code }}</span>
            </NuxtLink>
          </template>
        </el-table-column>
        <el-table-column label="現價" align="right" min-width="90">
          <template #default="{ row }">{{ row.price != null ? row.price.toFixed(2) : '－' }}</template>
        </el-table-column>
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
        <el-table-column v-if="experienceMode === 'pro'" label="負凸性警示" min-width="140">
          <template #default="{ row }">
            <span v-if="hasNegativeConvexityWarning(row)" class="preferred-stocks-page__warning">
              <el-icon><WarningFilled /></el-icon>溢價 {{ premiumRate(row)?.toFixed(2) }}%
            </span>
            <span v-else class="preferred-stocks-page__placeholder">－</span>
          </template>
        </el-table-column>
      </el-table>
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
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.preferred-stocks-page__title {
  font-size: 20px;
  font-weight: 600;
  margin: 0 0 8px;
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
