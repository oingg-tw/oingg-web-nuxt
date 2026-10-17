<script setup lang="ts">
// Personal/settings page (2026-09-19): nothing here is content for a crawler — keep it out of the
// index, and out of the sitemap via nuxt.config's own sitemap.exclude.
useSeoMeta({ title: '個人資料設定', robots: 'noindex, nofollow' })

import { SwitchButton } from '@element-plus/icons-vue'
import { EmailAuthProvider, GoogleAuthProvider, reauthenticateWithCredential, reauthenticateWithPopup, signOut } from 'firebase/auth'

const currentUser = useCurrentUser()
const authResolved = useAuthResolved()
const auth = useFirebaseAuth()
const router = useRouter()

const displayLabel = computed(() => currentUser.value?.displayName || currentUser.value?.email || '')

// 訪客沒有個人資料可管理：彈回首頁，不顯示空頁。登入狀態只在瀏覽器裡、而且是 Firebase 非同步還原的，所以不能在伺服器端
// 轉址；也要等 authResolved——只看 currentUser 的話，直接載入 /profile 會在使用者還原之前就被彈走（2026-10-08 實測，
// 登入中的人重新整理也會回到首頁）。immediate 同時涵蓋「從沒登入」與「在這頁登出」。
watch(
  [authResolved, currentUser],
  ([resolved, user]) => {
    if (resolved && !user) router.replace('/')
  },
  { immediate: true }
)

async function handleSignOut() {
  await signOut(auth)
}

// ---- 方案與用量（2026-10-06「完善付費方案」）----
// 使用者決定：只有免費＋專業版、價格等定價研究、這一輪不收款。所以這裡誠實地呈現「現在是什麼方案、額度
// 多少、用了多少」，升級按鈕停用、不寫價格（原本寫死的 NT$399／3,990 拿掉了）。
const { entitlement, entitlementFailure, isTrial, trialDaysLeft } = useEntitlement()
const QUOTA_ROWS: { resource: QuotaResource; label: string; unit: string }[] = [
  { resource: 'watchlistItems', label: '觀察清單', unit: '檔' },
  { resource: 'watchlistColumns', label: '觀察清單欄位', unit: '欄' },
  { resource: 'customHoldingColumns', label: '持股欄位', unit: '欄' },
  { resource: 'screenerPresets', label: '篩選分頁', unit: '個' },
  { resource: 'columnPresets', label: '儲存的欄位組合', unit: '個' }
]
const limitText = (value: number | null | undefined, unit: string) =>
  value === undefined ? '－' : value === null ? '不限' : `${value} ${unit}`

// 用量：entitlement 的 usage（業務中台 79b4d81）；舊版 業務中台 沒有這欄時只列上限
const usage = computed(() => entitlement.value?.usage)

// 免費 vs 專業版的對照數字來自 業務中台（GET /billing/plans，79b4d81），不在前端寫死；
// 端點問不到的時候不顯示對照表，只顯示自己方案的額度。
interface PlanQuotas { tier: 'FREE' | 'PRO'; quotas: Partial<Record<QuotaResource, number | null>> }
const { data: plans } = useAsyncData('billing-plans', () =>
  apiFetch<{ plans: PlanQuotas[] }>('/billing/plans')
    .then(response => response.plans)
    .catch(() => null),
{ server: false, default: () => null })
const planOf = (tier: PlanQuotas['tier']) => plans.value?.find(plan => plan.tier === tier)

// ---- 刪除帳號（2026-10-18，治理盤點→使用者「先做功能」；個資法第 11 條的刪除權）----
// DELETE /users/me（業務中台 ca1ab52）刪掉這個人的全部資料與 Firebase 帳號。不能復原，所以：
//   - 一個對話框（不疊第二個）：列出會刪什麼、輸入自己的 email 才能按
//   - 最近 5 分鐘內沒登入過要先重新驗證（上游看 token 的 auth_time，回 401 reauth_required）：打開對話框就先看一次，在同一個對話框裡
//     驗證——密碼帳號輸入密碼，Google 帳號跳 Google 視窗。驗證完強制換新 token，否則送出去的還是舊的 auth_time
//   - 成功後立刻登出、不打任何其他 API：手上的 token 還能用約一小時，期間打到查方案的端點會重建一個空的使用者（業務中台提醒）
//   - 付費期間內（409 subscription_active）要等到期；別的寫入進行中（409 write_in_progress）稍後再試
const authedFetch = useAuthedFetch()
const REAUTH_WINDOW_MS = 4.5 * 60 * 1000
const deleteOpen = ref(false)
const deleteConfirmEmail = ref('')
const deletePassword = ref('')
const needsReauth = ref(false)
const deleting = ref(false)
const deleteMessage = ref('')
const providers = computed(() => currentUser.value?.providerData.map(provider => provider.providerId) ?? [])
const reauthWithGoogle = computed(() => providers.value.includes('google.com') && !providers.value.includes('password'))
const confirmMatches = computed(() => !!currentUser.value?.email && deleteConfirmEmail.value.trim().toLowerCase() === currentUser.value.email.toLowerCase())

async function openDelete() {
  deleteConfirmEmail.value = ''
  deletePassword.value = ''
  deleteMessage.value = ''
  deleteOpen.value = true
  const result = await currentUser.value?.getIdTokenResult()
  needsReauth.value = !result || Date.now() - Date.parse(result.authTime) > REAUTH_WINDOW_MS
}

async function reauthenticate(): Promise<boolean> {
  const user = currentUser.value
  if (!user) return false
  try {
    if (reauthWithGoogle.value) await reauthenticateWithPopup(user, new GoogleAuthProvider())
    else await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email ?? '', deletePassword.value))
    await user.getIdToken(true)
    needsReauth.value = false
    return true
  } catch (error) {
    const code = (error as { code?: string }).code ?? ''
    deleteMessage.value = /wrong-password|invalid-credential/.test(code)
      ? '密碼不正確，請再試一次。'
      : /popup-closed|cancelled-popup/.test(code) ? '驗證視窗關掉了，請再按一次。' : '身分驗證沒有成功，請再試一次。'
    return false
  }
}

async function deleteAccount() {
  deleteMessage.value = ''
  deleting.value = true
  try {
    if (needsReauth.value && !(await reauthenticate())) return
    await authedFetch('/users/me', { method: 'DELETE' })
    // 立刻登出，中間不打任何 API（見上面）。登出後這一頁的 watcher 會回首頁
    await signOut(auth)
    deleteOpen.value = false
    ElMessage.success('帳號與所有資料已經刪除')
  } catch (error) {
    const code = businessErrorCode(error)
    if (code === 'reauth_required') {
      needsReauth.value = true
      deleteMessage.value = '為了安全，請再驗證一次身分後再按刪除。'
    } else if (code === 'subscription_active') {
      const end = (error as { data?: { currentPeriodEnd?: string } }).data?.currentPeriodEnd
      deleteMessage.value = `付費期間${end ? `到 ${dateText(end)} ` : ''}還沒結束，到期之後才能刪除帳號。`
    } else if (code === 'write_in_progress') {
      deleteMessage.value = '有其他資料正在儲存，請稍等幾秒再按一次。'
    } else {
      deleteMessage.value = '刪除沒有成功，請稍後再試；你的資料都還在。'
    }
  } finally {
    deleting.value = false
  }
}

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
      <el-avatar :size="72" :src="currentUser.photoURL ?? undefined" alt="" class="profile-page__avatar">
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
        <!-- 讀不到時全站彈窗會說明並重讀（2026-10-11）；這裡只在還沒回來時說讀取中 -->
        <p v-else-if="!entitlementFailure" class="profile-page__plan-note">方案資訊讀取中…</p>

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
        <p class="profile-page__plan-cta">專業版即將開放</p>
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

    <section class="profile-page__section" aria-labelledby="delete-account-title">
      <h2 id="delete-account-title" class="profile-page__section-title">刪除帳號</h2>
      <p class="profile-page__delete-text">刪除帳號會把你在這裡的所有資料一起刪掉，而且無法復原。</p>
      <el-button type="danger" plain class="profile-page__delete-button" @click="openDelete">刪除帳號…</el-button>
    </section>

    <el-dialog v-model="deleteOpen" title="永久刪除帳號" width="min(480px, 92vw)">
      <p class="profile-page__delete-text">以下資料會一起刪除，無法復原：</p>
      <ul class="profile-page__delete-list">
        <li>持股與全部交易紀錄（含匯入的對帳單）</li>
        <li>觀察清單與備註</li>
        <li>篩選分頁、欄位組合、釘選指標與外觀設定</li>
        <li>登入帳號本身（之後要用需要重新註冊）</li>
      </ul>
      <template v-if="needsReauth">
        <p class="profile-page__delete-text">為了安全，刪除前請再驗證一次身分。</p>
        <el-button v-if="reauthWithGoogle" :loading="deleting" @click="reauthenticate">用 Google 重新驗證</el-button>
        <template v-else>
          <label for="delete-account-password" class="profile-page__delete-label">密碼</label>
          <el-input id="delete-account-password" v-model="deletePassword" type="password" show-password autocomplete="current-password" />
        </template>
      </template>
      <label for="delete-account-email" class="profile-page__delete-label">請輸入你的電子郵件 {{ currentUser.email }} 確認</label>
      <el-input id="delete-account-email" v-model="deleteConfirmEmail" autocomplete="off" />
      <p v-if="deleteMessage" class="profile-page__delete-message" role="alert">{{ deleteMessage }}</p>
      <template #footer>
        <el-button @click="deleteOpen = false">取消</el-button>
        <el-button
          type="danger"
          :loading="deleting"
          :disabled="!confirmMatches || (needsReauth && !reauthWithGoogle && !deletePassword)"
          @click="deleteAccount"
        >
          永久刪除
        </el-button>
      </template>
    </el-dialog>
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
  font-size: 1rem;
  color: var(--el-text-color-secondary);
}

.profile-page__signout {
  width: 100%;
  max-width: 240px;
}

.profile-page__section {
  margin-top: 24px;
}

.profile-page__delete-text {
  margin: 0 0 12px;
}

.profile-page__delete-list {
  margin: 0 0 16px;
  padding-left: 1.25em;
}

.profile-page__delete-label {
  display: block;
  margin: 12px 0 6px;
}

.profile-page__delete-message {
  margin: 12px 0 0;
  color: var(--el-color-danger);
}

.profile-page__delete-button {
  min-height: 44px;
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

/* 不是 disabled 按鈕（朗讀器會念成「按鈕，已停用」卻沒有任何可做的事）：一行靜態說明 */
.profile-page__plan-cta {
  margin: 0;
  text-align: center;
  color: var(--el-text-color-secondary);
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
