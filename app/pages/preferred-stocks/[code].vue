<script setup lang="ts">
import { WarningFilled } from '@element-plus/icons-vue'

// Individual preferred-stock detail page — per direct request ("也要建立特別股清單以外，特別股
// 個別瀏覽畫面"), wired 2026-09-06 to bff-ts's real GET /stocks/preferred-stocks via the same
// usePreferredStockList() the list page uses (see that composable's own comment for exactly
// which fields are real vs. still null/"尚未提供"). Was previously unreachable in practice even
// as a fixture — the old card's click handler pointed at /stock/[code] (the COMMON-stock page),
// and a preferred-stock code like "2002A" was never in that page's universe, so it 404'd into
// "找不到這檔股票" — fixed alongside this page's own creation.
const route = useRoute()
const router = useRouter()

const code = computed(() => String(route.params.code))
const { data: list } = usePreferredStockList()
const stock = computed(() => getPreferredStockFromList(list.value, code.value))

const { mode: experienceMode } = useDashboardExperienceMode()

const PARTICIPATION_LABELS: Record<NonNullable<PreferredStock['participation']>, string> = {
  'non-participating': '非參與型（不參與普通股超額盈餘分配）',
  participating: '參與型（可與普通股共享超額盈餘分配）'
}

const callCountdownText = computed(() => (stock.value ? callCountdown(stock.value) : ''))
const premium = computed(() => (stock.value ? premiumRate(stock.value) : null))
const showNegativeConvexityWarning = computed(() => (stock.value ? hasNegativeConvexityWarning(stock.value) : false))
</script>

<template>
  <div class="preferred-stock-detail-page">
    <el-result v-if="!stock" icon="warning" title="找不到這檔特別股" sub-title="請確認股票代號是否正確">
      <template #extra>
        <el-button type="primary" @click="router.push('/preferred-stocks')">回特別股專區</el-button>
      </template>
    </el-result>

    <template v-else>
      <div class="preferred-stock-detail-page__disclaimer" role="alert">
        提示：股價與部分契約條款為即時資料，惟最差殖利率 (YTW)、清算優先倍數、投資人賣回權與償債能力指標目前無資料來源，頁面上會標示「尚未提供」，並非省略或估算為零。
      </div>

      <el-card class="preferred-stock-detail-page__summary" shadow="never">
        <div class="preferred-stock-detail-page__header">
          <div>
            <h1 class="preferred-stock-detail-page__name">
              {{ stock.name }}
              <span class="preferred-stock-detail-page__code">{{ stock.code }}</span>
            </h1>
            <NuxtLink to="/preferred-stocks" class="preferred-stock-detail-page__back">← 回特別股專區</NuxtLink>
          </div>
          <div class="preferred-stock-detail-page__actions">
            <el-radio-group v-model="experienceMode" size="small">
              <el-radio-button value="novice">簡易模式</el-radio-button>
              <el-radio-button value="pro">專家模式</el-radio-button>
            </el-radio-group>
            <div class="preferred-stock-detail-page__price">
              <span>{{ stock.price != null ? stock.price.toFixed(2) : '尚未提供' }}</span>
              <span v-if="stock.priceDate" class="preferred-stock-detail-page__price-date">{{ stock.priceDate }}</span>
            </div>
          </div>
        </div>
      </el-card>

      <section class="preferred-stock-detail-page__section">
        <h2 class="preferred-stock-detail-page__section-title">核心估值與風險指標</h2>
        <el-card shadow="never">
          <div class="preferred-stock-detail-page__yield">
            <div class="preferred-stock-detail-page__yield-item">
              <span class="preferred-stock-detail-page__label">最差殖利率 (YTW)</span>
              <span class="preferred-stock-detail-page__yield-value" :class="{ 'is-placeholder': stock.ytw === null }">
                {{ stock.ytw != null ? `${stock.ytw.toFixed(2)}%` : '尚未提供' }}
              </span>
            </div>
            <div v-if="stock.currentYield !== null" class="preferred-stock-detail-page__yield-item">
              <span class="preferred-stock-detail-page__label">參考殖利率</span>
              <span class="preferred-stock-detail-page__yield-value">{{ stock.currentYield.toFixed(2) }}%</span>
            </div>
            <div v-if="stock.dividendRate !== null" class="preferred-stock-detail-page__yield-item">
              <span class="preferred-stock-detail-page__label">股息率</span>
              <span class="preferred-stock-detail-page__yield-value">{{ stock.dividendRate.toFixed(2) }}%</span>
            </div>
            <div class="preferred-stock-detail-page__yield-item">
              <span class="preferred-stock-detail-page__label">距贖回日</span>
              <span class="preferred-stock-detail-page__yield-value preferred-stock-detail-page__yield-value--small">{{ callCountdownText }}</span>
            </div>
            <div v-if="premium !== null" class="preferred-stock-detail-page__yield-item">
              <span class="preferred-stock-detail-page__label">溢價率</span>
              <span
                class="preferred-stock-detail-page__yield-value preferred-stock-detail-page__yield-value--small"
                :class="premium > 0 ? 'is-up' : premium < 0 ? 'is-down' : ''"
              >
                {{ premium > 0 ? '+' : '' }}{{ premium.toFixed(2) }}%
              </span>
            </div>
          </div>

          <div v-if="showNegativeConvexityWarning" class="preferred-stock-detail-page__warning">
            <el-icon><WarningFilled /></el-icon>
            <span>負凸性警示：市價高於發行人贖回價，一旦發行人行使買回權，投資人將承擔溢價虧損，資本利得空間受限。</span>
          </div>
        </el-card>
      </section>

      <section class="preferred-stock-detail-page__section">
        <h2 class="preferred-stock-detail-page__section-title">契約條款解構</h2>
        <el-card shadow="never">
          <dl class="preferred-stock-detail-page__terms">
            <div class="preferred-stock-detail-page__term">
              <dt>股息累積性</dt>
              <dd>
                <template v-if="stock.dividendType">
                  <el-tag effect="plain">{{ stock.dividendType === 'cumulative' ? '累積型' : '非累積型' }}</el-tag>
                  <span class="preferred-stock-detail-page__term-note">
                    {{ stock.dividendType === 'cumulative' ? '當期未發放之股息將於未來累積補發。' : '當期未發放，未來不補發，虧損年份停發股息時需特別留意。' }}
                  </span>
                </template>
                <span v-else class="preferred-stock-detail-page__term-note">尚未提供</span>
              </dd>
            </div>
            <div class="preferred-stock-detail-page__term">
              <dt>股息參與權</dt>
              <dd>
                <el-tag v-if="stock.participation" effect="plain">{{ PARTICIPATION_LABELS[stock.participation] }}</el-tag>
                <span v-else class="preferred-stock-detail-page__term-note">尚未提供</span>
              </dd>
            </div>
            <!-- 清算優先倍數/清算優先權/投資人賣回權 收斂至專家軌 — per 特別股個股瀏覽.md §1
                 表格，簡易軌的「核心契約摘要」只到 股息累積性/參與權/贖回權/YTW/負凸性警示，這三項
                 是專家軌才「額外開放」的內容，跟列表頁卡片（不分模式全部顯示）不同。 -->
            <template v-if="experienceMode === 'pro'">
              <div class="preferred-stock-detail-page__term">
                <dt>清算優先倍數</dt>
                <dd>
                  <template v-if="stock.liquidationPreferenceMultiple !== null">
                    <el-tag :type="stock.liquidationPreferenceMultiple !== 1 ? 'warning' : 'info'" effect="plain">{{ stock.liquidationPreferenceMultiple }}x</el-tag>
                    <span class="preferred-stock-detail-page__term-note">
                      清算時優先於普通股收回 {{ stock.liquidationPreferenceMultiple }} 倍本金＋累積股息{{ stock.liquidationPreferenceMultiple !== 1 ? '（非常見的 1x，請留意條款差異）' : '' }}。
                    </span>
                  </template>
                  <template v-else-if="stock.hasLiquidationPreference !== null">
                    <el-tag effect="plain">{{ stock.hasLiquidationPreference ? '具清算優先權' : '無清算優先權' }}</el-tag>
                    <span class="preferred-stock-detail-page__term-note">實際倍數尚未提供。</span>
                  </template>
                  <span v-else class="preferred-stock-detail-page__term-note">尚未提供</span>
                </dd>
              </div>
              <div class="preferred-stock-detail-page__term">
                <dt>清算優先權</dt>
                <dd>{{ stock.liquidationPriority ?? '尚未提供' }}</dd>
              </div>
            </template>
            <div class="preferred-stock-detail-page__term">
              <dt>發行人贖回權</dt>
              <dd>
                <span v-if="stock.callDate && stock.redemptionConditions">{{ stock.redemptionConditions }}（{{ callCountdownText }}）</span>
                <span v-else-if="stock.callDate">首個贖回日 {{ stock.callDate }}（{{ callCountdownText }}）。</span>
                <span v-else>本檔查無贖回條款。</span>
              </dd>
            </div>
            <div v-if="experienceMode === 'pro'" class="preferred-stock-detail-page__term">
              <dt>投資人賣回權</dt>
              <dd>
                <template v-if="stock.putable !== null">
                  <el-tag :type="stock.putable ? 'warning' : 'info'" effect="plain">{{ stock.putable ? '有賣回權' : '無賣回權' }}</el-tag>
                  <span class="preferred-stock-detail-page__term-note">
                    {{ stock.putable ? '持有人有權要求發行人買回，風險屬性更接近固定收益債券而非股權。' : '本檔未賦予持有人要求買回之權利。' }}
                  </span>
                </template>
                <span v-else class="preferred-stock-detail-page__term-note">尚未提供——目前資料來源無投資人賣回權欄位。</span>
              </dd>
            </div>
          </dl>
        </el-card>
      </section>

      <section v-if="experienceMode === 'pro'" class="preferred-stock-detail-page__section">
        <h2 class="preferred-stock-detail-page__section-title">償債能力</h2>
        <el-card shadow="never">
          <p v-if="stock.interestCoverage === null" class="preferred-stock-detail-page__note">尚未提供——需搭配財報資料，規劃中。</p>
          <div v-else class="preferred-stock-detail-page__grid">
            <div class="preferred-stock-detail-page__field">
              <span class="preferred-stock-detail-page__label">利息保障倍數</span>
              <span>{{ stock.interestCoverage.toFixed(1) }}x</span>
            </div>
            <div class="preferred-stock-detail-page__field">
              <span class="preferred-stock-detail-page__label">資產負債率</span>
              <span>{{ stock.debtRatio.toFixed(1) }}%</span>
            </div>
            <div class="preferred-stock-detail-page__field">
              <span class="preferred-stock-detail-page__label">流動比率</span>
              <span>{{ stock.currentRatio.toFixed(1) }}%</span>
            </div>
            <div class="preferred-stock-detail-page__field">
              <span class="preferred-stock-detail-page__label">淨負債／EBITDA</span>
              <span>{{ stock.netDebtToEbitda.toFixed(1) }}x</span>
            </div>
          </div>
        </el-card>
      </section>
    </template>
  </div>
</template>

<style scoped>
.preferred-stock-detail-page {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.preferred-stock-detail-page__disclaimer {
  padding: 10px 16px;
  border-radius: 8px;
  background: var(--el-color-warning-light-9);
  color: var(--el-color-warning-dark-2);
  font-size: 16px;
}

.preferred-stock-detail-page__summary {
  border-radius: 12px;
}

.preferred-stock-detail-page__header {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.preferred-stock-detail-page__name {
  margin: 0 0 8px;
  font-size: 20px;
  font-weight: 600;
}

.preferred-stock-detail-page__code {
  margin-left: 8px;
  font-size: 16px;
  font-weight: 400;
  color: var(--el-text-color-secondary);
}

.preferred-stock-detail-page__back {
  font-size: 16px;
  color: var(--el-text-color-secondary);
  text-decoration: none;
}

.preferred-stock-detail-page__back:hover {
  color: var(--el-color-primary);
}

.preferred-stock-detail-page__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px;
}

.preferred-stock-detail-page__price {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  font-size: 24px;
  font-weight: 600;
}

.preferred-stock-detail-page__price span:last-child {
  font-size: 16px;
  font-weight: 400;
}

.is-up {
  color: var(--price-up-color);
}

.is-down {
  color: var(--price-down-color);
}

.is-placeholder {
  color: var(--el-text-color-placeholder) !important;
}

.preferred-stock-detail-page__note {
  margin: 0;
  font-size: 16px;
  color: var(--el-text-color-placeholder);
}

.preferred-stock-detail-page__section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.preferred-stock-detail-page__section-title {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
}

.preferred-stock-detail-page__yield {
  display: flex;
  flex-wrap: wrap;
  gap: 20px 32px;
}

.preferred-stock-detail-page__yield-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.preferred-stock-detail-page__yield-value {
  font-size: 24px;
  font-weight: 600;
  color: var(--el-color-primary);
}

.preferred-stock-detail-page__yield-value--small {
  font-size: 18px;
}

.preferred-stock-detail-page__warning {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-top: 16px;
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--el-color-warning-light-9);
  color: var(--el-color-warning-dark-2);
  font-size: 16px;
}

.preferred-stock-detail-page__warning .el-icon {
  flex-shrink: 0;
  margin-top: 2px;
}

.preferred-stock-detail-page__label {
  color: var(--el-text-color-secondary);
}

.preferred-stock-detail-page__terms {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin: 0;
}

.preferred-stock-detail-page__term {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.preferred-stock-detail-page__term dt {
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-secondary);
}

.preferred-stock-detail-page__term dd {
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  font-size: 16px;
}

.preferred-stock-detail-page__term-note {
  color: var(--el-text-color-secondary);
}

.preferred-stock-detail-page__grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
}

.preferred-stock-detail-page__field {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 16px;
}

@media (min-width: 640px) {
  .preferred-stock-detail-page__grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
