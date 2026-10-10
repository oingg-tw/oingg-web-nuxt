<script setup lang="ts">
import type { PerformanceOutcome } from '~/composables/holdings/holdings-model'

// 績效統計（2026-10-07 從「交易績效」拆出來，使用者：「performance 這一頁太亂了，請把指標拆去別的畫面」）。
// 捕獲率、Beta、α、Sharpe 這些名詞門檻高、少數人看，所以自成一頁，不擠在報酬頁。全部用真實帳本算
// （GET /holdings/performance，跟「報酬與大盤」共用快取），只陳述數字與定義、不評價、不分付費。
// null 的原因分開命名，邏輯與檢查在 utils/holdings-metrics.ts。
//
// Personal page: out of the index and the sitemap (/holdings/**).
useSeoMeta({ title: '績效統計', robots: 'noindex, nofollow' })

const currentUser = useCurrentUser()
const authResolved = useAuthResolved()
const { fetchPerformance } = useHoldings()

const range = useHoldingsRange()
const performance = ref<PerformanceOutcome | null>(null)
const pending = ref(false)

async function loadPerformance() {
  pending.value = true
  performance.value = await fetchPerformance(range.value[0], range.value[1])
  pending.value = false
}

watch([authResolved, () => currentUser.value?.uid, range], ([resolved, uid]) => {
  if (!resolved) return
  if (uid) loadPerformance()
  else performance.value = null
}, { immediate: true })

const report = computed(() => (performance.value?.ok && performance.value.result.twr !== null ? performance.value.result : null))

const comparisonRows = computed(() => {
  const result = report.value
  if (!result) return []
  const bc = result.benchmarkComparison
  const ra = result.riskAdjusted
  const captureMissing = firstReason(sampleShortfall(bc.sampleDays, COVARIANCE_MIN_DAYS))
  const adjustedMissing = firstReason(!result.riskFree && NO_RISK_FREE, sampleShortfall(ra.sampleDays, COVARIANCE_MIN_DAYS))
  return [
    { name: '上漲捕獲率', value: holdingsMetricText(bc.upCapture, 'pct', captureMissing), meaning: '大盤上漲的那些天，持股平均漲了大盤漲幅的幾成' },
    { name: '下跌捕獲率', value: holdingsMetricText(bc.downCapture, 'pct', captureMissing), meaning: '大盤下跌的那些天，持股平均跌了大盤跌幅的幾成' },
    { name: 'Omega', value: holdingsMetricText(bc.omega, 'ratio', captureMissing), meaning: '賺錢那些天的報酬總和 ÷ 賠錢那些天的報酬總和' },
    { name: 'Beta（實際）', value: holdingsMetricText(ra.beta, 'ratio', adjustedMissing), meaning: '用實際每日報酬算：大盤漲跌 1% 時，持股平均跟著漲跌幾 %。跟「風險」頁用現在持股回推的 Beta 不同' },
    { name: 'Jensen α（年化）', value: holdingsMetricText(ra.jensenAlpha, 'signedPct', adjustedMissing), meaning: '扣掉 Beta 與無風險利率能解釋的部分之後，每年多出或少掉的報酬' },
    { name: '追蹤誤差（年化）', value: holdingsMetricText(ra.trackingError, 'pct', adjustedMissing), meaning: '持股與大盤每天報酬差距的波動，換算成一年' },
    { name: '資訊比率', value: holdingsMetricText(ra.informationRatio, 'ratio', adjustedMissing), meaning: '每年相對大盤的超額報酬 ÷ 追蹤誤差' },
    { name: 'M²（年化）', value: holdingsMetricText(ra.m2, 'signedPct', adjustedMissing), meaning: '把持股的波動調成跟大盤一樣時的年化報酬，跟大盤的年化報酬是同一個尺度' }
  ]
})

const adjustedRows = computed(() => {
  const result = report.value
  if (!result) return []
  const ra = result.riskAdjusted
  const missing = firstReason(!result.riskFree && NO_RISK_FREE, sampleShortfall(ra.sampleDays, COVARIANCE_MIN_DAYS))
  const calmarMissing = firstReason(!result.riskFree && NO_RISK_FREE, sampleShortfall(ra.sampleDays, COVARIANCE_MIN_DAYS), periodUnderYear(result.from, result.to) && UNDER_A_YEAR)
  return [
    { name: 'Sharpe', value: holdingsMetricText(ra.sharpe, 'ratio', missing), meaning: '（年化報酬 − 無風險利率）÷ 年化波動度' },
    { name: 'Sortino', value: holdingsMetricText(ra.sortino, 'ratio', missing), meaning: '跟 Sharpe 一樣，但分母只算下跌那一側的波動' },
    { name: 'Calmar', value: holdingsMetricText(ra.calmar, 'ratio', calmarMissing), meaning: '年化報酬 ÷ 期間內實際的最大跌幅' }
  ]
})
</script>

<template>
  <HoldingsPageShell title="績效統計" subtitle="進階的統計數字：跟大盤的連動、經風險調整的報酬。不看也不影響使用其他功能" guest-title="登入後查看你的績效統計" guest-text="持股與交易資料存在你的帳號裡，只有你看得到。">

      <HoldingsRangePicker :pending="pending" />

      <div v-loading="pending" class="statistics-page__body">
        <el-alert v-if="performance && !performance.ok" type="error" :closable="false" show-icon :title="performance.message">
          <el-button @click="loadPerformance">重新載入</el-button>
        </el-alert>

        <p v-else-if="performance?.ok && !report" class="statistics-page__note">這段期間沒有持股。</p>

        <template v-else-if="report">
          <section aria-labelledby="statistics-relative-title">
            <h2 id="statistics-relative-title" class="statistics-page__section-title">相對大盤的統計</h2>
            <p class="statistics-page__note">用實際的每日報酬跟加權指數逐日比對，依 {{ report.benchmarkComparison.sampleDays }} 個交易日計算。</p>
            <HoldingsMetricTable caption="持股相對加權指數的統計" :rows="comparisonRows" value-label="數值" />
          </section>

          <section aria-labelledby="statistics-adjusted-title">
            <h2 id="statistics-adjusted-title" class="statistics-page__section-title">風險調整後報酬</h2>
            <p class="statistics-page__note">
              依 {{ report.riskAdjusted.sampleDays }} 個交易日計算，全部年化。<template v-if="riskFreeLine(report.riskFree)">{{ riskFreeLine(report.riskFree) }}。</template>
            </p>
            <HoldingsMetricTable caption="持股的風險調整後報酬" :rows="adjustedRows" value-label="數值" />
          </section>

        </template>
      </div>
  </HoldingsPageShell>
</template>

<style scoped>
.statistics-page__body {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.statistics-page__section-title {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0 0 12px;
}

.statistics-page__note {
  margin: 0 0 12px;
  color: var(--el-text-color-regular);
}
</style>
