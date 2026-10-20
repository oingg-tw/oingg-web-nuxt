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

// 讀取失敗交給全站彈窗（2026-10-11）；只有「開始日期早於歷史價格」這種可行動的失敗留在頁面上的提示框
watchLoadFailure('holdings-statistics', () => (performance.value && !performance.value.ok ? performance.value.error ?? null : null), () => loadPerformance())

async function loadPerformance() {
  pending.value = true
  performance.value = await fetchPerformance(range.value[0], range.value[1])
  pending.value = false
}

// 誰＋哪個帳戶（2026-10-19）：換帳戶就跟換人一樣重新載入
const { holdingsScope } = useHoldingsPortfolios()
watch([authResolved, holdingsScope, range], ([resolved, uid]) => {
  if (!resolved) return
  if (uid) loadPerformance()
  else performance.value = null
}, { immediate: true })

const report = computed(() => (performance.value?.ok && performance.value.result.twr !== null ? performance.value.result : null))

// 兩段都要 120 個交易日（業務中台 的門檻），都不夠時每一項都是 null：整頁只寫一句，不列兩張每格都是「樣本不足」的表
// （使用者 2026-10-19：「近三個月 全部 樣本不足」）。走到這裡的不只近三個月：上半年的今年以來、自訂的短區間、紀錄還不到
// 120 個交易日的帳戶（選近一年也一樣）。近三個月這個選項留著：期間四頁共用，它在報酬與大盤、已實現損益有用。
const sampleDays = computed(() => (report.value ? Math.max(report.value.benchmarkComparison.sampleDays, report.value.riskAdjusted.sampleDays) : 0))

// 讀的時候（report 還是 null）列照樣列出、數值留空：表格畫成骨架，名稱與意思先出現（2026-10-20）
const metricText = (...args: Parameters<typeof holdingsMetricText>) => (report.value ? holdingsMetricText(...args) : '')

const comparisonRows = computed(() => {
  const result = report.value
  const bc = result?.benchmarkComparison
  const ra = result?.riskAdjusted
  const captureMissing = bc && firstReason(sampleShortfall(bc.sampleDays, COVARIANCE_MIN_DAYS))
  const adjustedMissing = result && ra ? firstReason(!result.riskFree && NO_RISK_FREE, sampleShortfall(ra.sampleDays, COVARIANCE_MIN_DAYS)) : undefined
  return [
    { name: '上漲捕獲率', value: metricText(bc?.upCapture, 'pct', captureMissing), meaning: '大盤上漲的那些天，持股平均漲了大盤漲幅的幾成' },
    { name: '下跌捕獲率', value: metricText(bc?.downCapture, 'pct', captureMissing), meaning: '大盤下跌的那些天，持股平均跌了大盤跌幅的幾成' },
    { name: 'Omega', value: metricText(bc?.omega, 'ratio', captureMissing), meaning: '賺錢那些天的報酬總和 ÷ 賠錢那些天的報酬總和' },
    { name: 'Beta（實際）', value: metricText(ra?.beta, 'ratio', adjustedMissing), meaning: '用實際每日報酬算：大盤漲跌 1% 時，持股平均跟著漲跌幾 %。跟「風險」頁用現在持股回推的 Beta 不同' },
    { name: 'Jensen α（年化）', value: metricText(ra?.jensenAlpha, 'signedPct', adjustedMissing), meaning: '扣掉 Beta 與無風險利率能解釋的部分之後，每年多出或少掉的報酬' },
    { name: '追蹤誤差（年化）', value: metricText(ra?.trackingError, 'pct', adjustedMissing), meaning: '持股與大盤每天報酬差距的波動，換算成一年' },
    { name: '資訊比率', value: metricText(ra?.informationRatio, 'ratio', adjustedMissing), meaning: '每年相對大盤的超額報酬 ÷ 追蹤誤差' },
    { name: 'M²（年化）', value: metricText(ra?.m2, 'signedPct', adjustedMissing), meaning: '把持股的波動調成跟大盤一樣時的年化報酬，跟大盤的年化報酬是同一個尺度' }
  ]
})

const adjustedRows = computed(() => {
  const result = report.value
  const ra = result?.riskAdjusted
  const missing = result && ra ? firstReason(!result.riskFree && NO_RISK_FREE, sampleShortfall(ra.sampleDays, COVARIANCE_MIN_DAYS)) : undefined
  // 「未滿一年」照 業務中台 的判定（它從起始日前一個交易日量到最後一個有收盤的交易日；近一年在週日、週一收盤前會是 364 天），
  // 不自己用起訖日期重算——2026-10-19 兩邊對不上，Calmar 只顯示「－」不寫原因
  const calmarMissing = result && ra ? firstReason(!result.riskFree && NO_RISK_FREE, sampleShortfall(ra.sampleDays, COVARIANCE_MIN_DAYS), result.annualized.twr === null && UNDER_A_YEAR) : undefined
  return [
    { name: 'Sharpe', value: metricText(ra?.sharpe, 'ratio', missing), meaning: '（年化報酬 − 無風險利率）÷ 年化波動度' },
    { name: 'Sortino', value: metricText(ra?.sortino, 'ratio', missing), meaning: '跟 Sharpe 一樣，但分母只算下跌那一側的波動' },
    { name: 'Calmar', value: metricText(ra?.calmar, 'ratio', calmarMissing), meaning: '年化報酬 ÷ 期間內實際的最大跌幅' }
  ]
})
</script>

<template>
  <HoldingsPageShell title="績效統計" subtitle="進階的統計數字：跟大盤的連動、經風險調整的報酬。不看也不影響使用其他功能" guest-title="登入後查看你的績效統計" guest-text="持股與交易資料存在你的帳號裡，只有你看得到。" :pending="pending && !performance">
    <template #default="{ loading }">

      <HoldingsRangePicker :pending="pending" />

      <!-- 遮罩只給換期間（內容已經在畫面上）；第一次讀的時候是骨架（2026-10-20） -->
      <div v-loading="pending && !loading" class="statistics-page__body">
        <el-alert v-if="performance && !performance.ok && !performance.error" type="error" :closable="false" show-icon :title="performance.message">
          <el-button @click="loadPerformance">重新載入</el-button>
        </el-alert>

        <p v-else-if="performance?.ok && !report" class="statistics-page__note">這段期間沒有持股。</p>

        <p v-else-if="report && sampleDays < COVARIANCE_MIN_DAYS" class="statistics-page__note">
          這段期間只有 {{ sampleDays }} 個交易日的報酬可以跟大盤逐日比對，這頁的統計至少要 {{ COVARIANCE_MIN_DAYS }} 個交易日。
        </p>

        <!-- 讀的時候兩段照畫：問句、指標名稱與意思是字，天數與數值是骨架（2026-10-20） -->
        <template v-else-if="loading || report">
          <section aria-labelledby="statistics-relative-title" :aria-busy="loading">
            <h2 id="statistics-relative-title" class="statistics-page__section-title">相對大盤的統計</h2>
            <p class="statistics-page__note">
              用實際的每日報酬跟加權指數逐日比對，依 <span v-if="loading" class="app-skeleton app-skeleton--flow" aria-hidden="true">240</span><template v-else>{{ report!.benchmarkComparison.sampleDays }}</template> 個交易日計算。
            </p>
            <HoldingsMetricTable caption="持股相對加權指數的統計" :rows="comparisonRows" value-label="數值" :loading="loading" />
          </section>

          <section aria-labelledby="statistics-adjusted-title" :aria-busy="loading">
            <h2 id="statistics-adjusted-title" class="statistics-page__section-title">風險調整後報酬</h2>
            <p class="statistics-page__note">
              依 <span v-if="loading" class="app-skeleton app-skeleton--flow" aria-hidden="true">240</span><template v-else>{{ report!.riskAdjusted.sampleDays }}</template> 個交易日計算，全部年化。<template v-if="!loading && riskFreeLine(report!.riskFree)">{{ riskFreeLine(report!.riskFree) }}。</template>
            </p>
            <HoldingsMetricTable caption="持股的風險調整後報酬" :rows="adjustedRows" value-label="數值" :loading="loading" />
          </section>

        </template>
      </div>
    </template>
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
