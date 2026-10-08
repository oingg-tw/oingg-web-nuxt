<script setup lang="ts">
// Personal/settings page (2026-09-19): nothing here is content for a crawler — keep it out of the
// index, and out of the sitemap via nuxt.config's own sitemap.exclude.
useSeoMeta({ robots: 'noindex, nofollow' })

import { SwitchButton } from '@element-plus/icons-vue'

const currentUser = useCurrentUser()
const compatAuth = useFirebaseCompatAuth()
const router = useRouter()

const displayLabel = computed(() => currentUser.value?.displayName || currentUser.value?.email || '')

// Guests have no profile to manage — bounce back rather than show an empty page. currentUser
// only ever settles after Firebase's async auth check resolves client-side, so this can't be
// a server-side redirect guard; watching it with immediate:true catches both "never logged
// in" and "just signed out from this page" in one place.
watch(
  currentUser,
  user => {
    if (!user) router.replace('/')
  },
  { immediate: true }
)

async function handleSignOut() {
  await compatAuth.signOut()
}

// ---- 方案與用量（2026-10-06「完善付費方案」）----
// 使用者決定：只有免費＋專業版、價格等定價研究、這一輪不收款。所以這裡誠實地呈現「現在是什麼方案、額度
// 多少、用了多少」，升級按鈕停用、不寫價格（原本寫死的 NT$399／3,990 拿掉了）。
const { entitlement, isTrial, trialDaysLeft } = useEntitlement()
const QUOTA_ROWS: { resource: QuotaResource; label: string; unit: string }[] = [
  { resource: 'watchlistItems', label: '觀察清單', unit: '檔' },
  { resource: 'watchlistColumns', label: '觀察清單欄位', unit: '欄' },
  { resource: 'customHoldingColumns', label: '持股欄位', unit: '欄' },
  { resource: 'screenerPresets', label: '篩選分頁', unit: '個' },
  { resource: 'columnPresets', label: '儲存的欄位組合', unit: '個' }
]
const limitText = (value: number | null | undefined, unit: string) =>
  value === undefined ? '－' : value === null ? '不限' : `${value} ${unit}`

// 用量：entitlement 的 usage（bff-ts 79b4d81）；舊版 bff 沒有這欄時只列上限
const usage = computed(() => entitlement.value?.usage)

// 免費 vs 專業版的對照數字來自 bff-ts（GET /billing/plans，79b4d81），不在前端寫死；
// 端點問不到的時候不顯示對照表，只顯示自己方案的額度。
interface PlanQuotas { tier: 'FREE' | 'PRO'; quotas: Partial<Record<QuotaResource, number | null>> }
const { data: plans } = useAsyncData('billing-plans', () =>
  $fetch<{ plans: PlanQuotas[] }>('/billing/plans', { baseURL: BFF_BASE, timeout: BFF_REQUEST_TIMEOUT_MS })
    .then(response => response.plans)
    .catch(() => null),
{ server: false, default: () => null })
const planOf = (tier: PlanQuotas['tier']) => plans.value?.find(plan => plan.tier === tier)

const dateText = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei' }) : '')
const planName = computed(() => {
  const current = entitlement.value
  if (!current) return null
  if (current.tier === 'FREE') return '免費版'
  return isTrial.value ? '專業版（試用中）' : '專業版'
})
</script>

<template>
  <div v-if="currentUser" class="profile-page">
    <h1 class="app-page__title app-page__title--app profile-page__title">個人資料設定</h1>
    <div class="profile-page__card">
      <el-avatar :size="72" :src="currentUser.photoURL ?? undefined" class="profile-page__avatar">
        {{ displayLabel.slice(0, 1).toUpperCase() }}
      </el-avatar>
      <p class="profile-page__name">{{ currentUser.displayName || '未設定名稱' }}</p>
      <p class="profile-page__email">{{ currentUser.email }}</p>
      <el-button :icon="SwitchButton" class="profile-page__signout" @click="handleSignOut">登出</el-button>
    </div>

    <section id="plan" class="profile-page__section">
      <h2 class="profile-page__section-title">方案與用量</h2>
      <div class="profile-page__plan-card">
        <template v-if="planName">
          <p class="profile-page__plan-name">{{ planName }}</p>
          <p v-if="isTrial && trialDaysLeft !== null" class="profile-page__plan-note">
            試用還剩 {{ trialDaysLeft }} 天（到 {{ dateText(entitlement?.trialEndsAt) }}）。試用結束後自動轉為免費版，你的資料都會保留。
          </p>
          <p v-else-if="entitlement?.source === 'subscription' && entitlement.currentPeriodEnd" class="profile-page__plan-note">
            有效至 {{ dateText(entitlement.currentPeriodEnd) }}
          </p>
        </template>
        <p v-else class="profile-page__plan-note">方案資訊暫時無法取得</p>

        <table class="profile-page__plan-table">
          <caption class="visually-hidden">你的方案額度{{ usage ? '與目前用量' : '' }}</caption>
          <thead>
            <tr>
              <th scope="col">項目</th>
              <th v-if="usage" scope="col">已使用</th>
              <th scope="col">上限</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in QUOTA_ROWS" :key="row.resource">
              <th scope="row">{{ row.label }}</th>
              <td v-if="usage">{{ usage[row.resource] ?? 0 }} {{ row.unit }}</td>
              <td>{{ limitText(entitlement ? entitlement.quotas[row.resource] ?? null : undefined, row.unit) }}</td>
            </tr>
          </tbody>
        </table>
        <el-button disabled class="profile-page__plan-cta">專業版即將開放</el-button>
      </div>

      <div v-if="plans" class="profile-page__plan-compare">
        <table class="profile-page__plan-table">
          <caption class="visually-hidden">免費版與專業版的差別</caption>
          <thead>
            <tr>
              <th scope="col">項目</th>
              <th scope="col">免費版</th>
              <th scope="col">專業版</th>
            </tr>
          </thead>
          <tbody>
            <!-- 法規底線（投信投顧法）：付費只能差在能追蹤、儲存多少，分析與資料兩邊一樣——寫在最前面 -->
            <tr>
              <th scope="row">個股分析、篩選結果、資料來源</th>
              <td colspan="2">兩個方案完全相同</td>
            </tr>
            <tr v-for="row in QUOTA_ROWS" :key="row.resource">
              <th scope="row">{{ row.label }}</th>
              <td>{{ limitText(planOf('FREE')?.quotas[row.resource], row.unit) }}</td>
              <td>{{ limitText(planOf('PRO')?.quotas[row.resource], row.unit) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="profile-page__plan-footnote">新註冊的帳號有 14 天專業版試用，不需要信用卡；到期自動轉為免費版，超過免費額度的部分可以看、可以刪，只是不能再新增。</p>
    </section>
  </div>
</template>

<style scoped>
.profile-page {
  width: 100%;
  max-width: 480px;
  margin: 0 auto;
}

.profile-page__title {
  margin: 0 0 16px;
}

.profile-page__card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 32px 16px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 12px;
}

.profile-page__avatar {
  background: var(--el-color-primary);
  margin-bottom: 8px;
}

.profile-page__name {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
}

.profile-page__email {
  margin: 0 0 16px;
  font-size: 0.875rem;
  color: var(--el-text-color-secondary);
}

.profile-page__signout {
  width: 100%;
  max-width: 240px;
}

.profile-page__section {
  margin-top: 24px;
}

.profile-page__section-title {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0 0 12px;
}

.profile-page__plan-card {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 12px;
  padding: 20px 16px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 12px;
}

.profile-page__plan-name {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
}

.profile-page__plan-note,
.profile-page__plan-footnote {
  margin: 0;
  color: var(--el-text-color-regular);
}

.profile-page__plan-footnote {
  margin-top: 12px;
}

.profile-page__plan-cta {
  align-self: center;
  width: 100%;
  max-width: 240px;
  min-height: 44px;
}

.profile-page__plan-compare {
  margin-top: 16px;
}

.profile-page__plan-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 1rem;
  font-variant-numeric: tabular-nums;
}

.profile-page__plan-table th,
.profile-page__plan-table td {
  padding: 10px 12px;
  text-align: left;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.profile-page__plan-table thead th {
  font-weight: 600;
  border-bottom-width: 2px;
}

.profile-page__plan-table tbody th {
  font-weight: 400;
}
</style>
