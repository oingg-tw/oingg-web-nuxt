<script setup lang="ts">
// 電子報（2026-11-16：使用者在業務中台那邊決定先做每週持股週報；設計 https://claude.ai/artifact/YK4pXxDNTwggGgbB4DvoEN）。預設關閉，打開開關
// 就是同意收信（業務中台 GET /newsletter、PUT /newsletter/weekly）；改了就存，不另外按儲存。信裡的退訂連結打開的是 /newsletter/unsubscribe。
// 沒有帳號 email 的人（LINE 建立的）自己填一個收件 email（PUT /newsletter/email），驗證信（POST /newsletter/email/verification）裡的連結
// 打開 /newsletter/verify，確認了才開始寄。設定頁：不給搜尋引擎收錄，也不進 sitemap
useSeoMeta({ title: '電子報', robots: 'noindex, nofollow' })

const currentUser = useCurrentUser()
const authedFetch = useAuthedFetch()
const settings = ref<NewsletterSettings | null>(null)
const loadError = ref<unknown>(null)
const weekly = computed(() => settings.value?.editions.find(edition => edition.edition === 'weekly') ?? null)
// 帳號的 email（讀到之前先看 Firebase 的，版面不用等回應才決定）；沒有的話用自己填的收件 email
const accountEmail = computed(() => (settings.value ? settings.value.email : currentUser.value?.email ?? null))
const ownEmail = computed(() => (accountEmail.value ? null : settings.value?.newsletterEmail ?? null))
// 有地址可以寄了：帳號的，或驗證過的收件 email
const deliverable = computed(() => !!settings.value && !!newsletterAddress(settings.value))
const ALL_SECTIONS = NEWSLETTER_SECTIONS.map(section => section.code)
const nextIssue = nextNewsletterIssue(Date.now())
const sampleOpen = ref(false)

// 開、關、等驗證都有這一行，讀到時不變高
const statusText = computed(() => {
  const edition = weekly.value
  if (!edition) return null
  if (!accountEmail.value && !ownEmail.value) return '未開啟・先填一個收信的 email'
  if (!edition.optIn) return '未開啟・打開就是同意每週寄到下面的 email'
  return deliverable.value ? `已開啟・下一封預計 ${nextIssue}` : '已開啟・email 驗證完才開始寄'
})

async function load() {
  loadError.value = null
  try {
    settings.value = await authedFetch<NewsletterSettings>('/newsletter')
  } catch (error) {
    loadError.value = error
  }
}
watch(currentUser, (user) => {
  settings.value = null
  if (user) void load()
}, { immediate: true })
watchLoadFailure('newsletter-settings', () => loadError.value, load)

// 一次送一個：連續改兩下時第二個等第一個回來，業務中台最後存的就是畫面上最後的樣子
let queue: Promise<unknown> = Promise.resolve()
async function save(body: { optIn?: boolean; sections?: NewsletterSection[] }) {
  const sent = queue.then(() => authedFetch<NewsletterEdition>('/newsletter/weekly', { method: 'PUT', body }))
  queue = sent.catch(() => undefined)
  try {
    await sent
    return true
  } catch (error) {
    showErrorMessage(businessErrorCode(error) === 'newsletter_email_missing' ? '先填一個收信的 email，才能開啟週報。' : '沒有存到，請再試一次。')
    // 畫面回到業務中台存著的樣子
    await load()
    return false
  }
}

async function setOptIn(value: string | number | boolean) {
  if (!weekly.value) return
  const optIn = value === true
  weekly.value.optIn = optIn
  if ((await save({ optIn })) && optIn && weekly.value?.optIn) ElMessage.success(deliverable.value ? `週報已開啟，下一封預計 ${nextIssue}` : '週報已開啟，email 驗證完才開始寄')
}

function setSections(value: (string | number | boolean)[]) {
  const sections = ALL_SECTIONS.filter(code => value.includes(code))
  if (!weekly.value || !sections.length) return
  weekly.value.sections = sections
  void save({ sections })
}

// ---- 自己填的收件 email（沒有帳號 email 的人）----
const editingEmail = ref(false)
const emailDraft = ref('')
const emailBusy = ref(false)
const emailMessage = ref('')
const cooldownLeft = ref(0)
let cooldownTimer: ReturnType<typeof setInterval> | undefined

// 重寄要隔 60 秒（業務中台的冷卻；沒有 Retry-After，照 60 秒倒數）
function startCooldown() {
  const until = Date.now() + 60_000
  clearInterval(cooldownTimer)
  const tick = () => {
    cooldownLeft.value = Math.max(0, Math.ceil((until - Date.now()) / 1000))
    if (!cooldownLeft.value) clearInterval(cooldownTimer)
  }
  tick()
  cooldownTimer = setInterval(tick, 1000)
}
onBeforeUnmount(() => clearInterval(cooldownTimer))

function editEmail() {
  emailDraft.value = ownEmail.value?.address ?? ''
  emailMessage.value = ''
  editingEmail.value = true
}

async function sendVerification() {
  try {
    await authedFetch('/newsletter/email/verification', { method: 'POST' })
    startCooldown()
  } catch (error) {
    const code = businessErrorCode(error)
    if (code === 'newsletter_verification_cooldown') startCooldown()
    if (code === 'newsletter_verification_cooldown') emailMessage.value = '剛寄過一封，倒數完再重寄。'
    else if (code === 'newsletter_verification_daily_limit') emailMessage.value = '24 小時內最多寄 5 封驗證信，請明天再試。'
    else if (businessErrorStatus(error) === 503) emailMessage.value = '現在還沒辦法寄驗證信，請稍後再試。'
    else if (code !== 'newsletter_email_already_verified') emailMessage.value = '驗證信沒寄出去，請稍後再按一次。'
  }
}

// 第一次填：存起來、打開週報（按下去就是同意收信）、寄驗證信。換一個：存起來（舊的驗證連結跟著失效）、寄驗證信，開關不動
async function submitEmail() {
  const firstTime = !ownEmail.value
  emailMessage.value = ''
  emailBusy.value = true
  try {
    await authedFetch('/newsletter/email', { method: 'PUT', body: { address: emailDraft.value.trim() } })
    if (firstTime && !weekly.value?.optIn) await authedFetch('/newsletter/weekly', { method: 'PUT', body: { optIn: true } })
    editingEmail.value = false
    await sendVerification()
  } catch (error) {
    const code = businessErrorCode(error)
    if (code === 'newsletter_account_email_exists') emailMessage.value = '這個帳號已經有 email，週報會寄到帳號的 email。'
    else emailMessage.value = businessErrorStatus(error) === 400 ? 'email 的格式不對，請再檢查一次。' : '沒有存到，請再試一次。'
  } finally {
    await load()
    emailBusy.value = false
  }
}

async function resend() {
  emailMessage.value = ''
  emailBusy.value = true
  await sendVerification()
  await load()
  emailBusy.value = false
}
</script>

<template>
  <AccountPageShell title="電子報">
    <p class="newsletter-page__lead">每週一封，整理你持有和關注的股票這一週發生的事。</p>

    <AccountSection id="newsletter-weekly-title" title="每週持股週報">
      <template #description>每週日晚上 8 點寄出。那週你持有、關注的股票都沒有可以整理的內容，就不寄。</template>
      <div class="app-card newsletter-page__card">
        <div class="newsletter-page__part newsletter-page__switch-row">
          <span v-if="statusText" class="newsletter-page__status">{{ statusText }}</span>
          <span v-else class="newsletter-page__status"><span class="app-skeleton app-skeleton--flow" aria-hidden="true">未開啟・打開就是同意每週寄到下面的 email</span></span>
          <!-- 沒有任何 email 不給開關：要先填一個（下面的表單就會打開週報） -->
          <el-switch v-if="accountEmail || ownEmail" id="newsletter-weekly" aria-label="每週持股週報" :model-value="weekly?.optIn ?? false" :disabled="!weekly" @change="setOptIn" />
        </div>

        <!-- 寄到哪：帳號的 email；或自己填的收件 email（狀態、重寄、換一個）；都沒有就填一個 -->
        <div class="newsletter-page__part newsletter-page__text">
          <span class="newsletter-page__name">寄到</span>
          <template v-if="accountEmail">
            <span v-if="settings" class="newsletter-page__email">{{ settings.email }}</span>
            <span v-else class="newsletter-page__email"><span class="app-skeleton app-skeleton--flow" aria-hidden="true">name@example.com</span></span>
            <span class="newsletter-page__note">用帳號的 email。要換成別的，請改用那個帳號登入。</span>
          </template>
          <template v-else-if="ownEmail && !editingEmail">
            <span class="newsletter-page__email">{{ ownEmail.address }}<span class="newsletter-page__tag">{{ ownEmail.status === 'verified' ? '已驗證' : '待驗證' }}</span></span>
            <span class="newsletter-page__actions">
              <el-button v-if="ownEmail.status !== 'verified'" :disabled="cooldownLeft > 0" :loading="emailBusy" @click="resend">
                {{ cooldownLeft ? `重寄驗證信（${cooldownLeft} 秒後）` : ownEmail.status === 'entered' ? '寄驗證信' : '重寄驗證信' }}
              </el-button>
              <el-button @click="editEmail">改用別的 email</el-button>
            </span>
            <span class="newsletter-page__note">{{ ownEmail.status === 'verified'
              ? '自己填的 email 只用來寄週報，不會變成登入方式。'
              : '點驗證信裡的連結就開始寄。沒收到的話看看垃圾郵件匣；連結 24 小時內有效，重寄後舊的就不能用了。' }}</span>
          </template>
          <form v-else class="newsletter-page__form" @submit.prevent="submitEmail">
            <span v-if="!ownEmail" class="newsletter-page__note">這個帳號還沒有 email。</span>
            <label for="newsletter-email">{{ ownEmail ? '改成哪個 email' : '要寄到哪個 email' }}</label>
            <el-input id="newsletter-email" v-model="emailDraft" type="email" autocomplete="email" maxlength="254" required placeholder="name@example.com" :disabled="!settings" />
            <span class="newsletter-page__actions">
              <el-button type="primary" native-type="submit" :loading="emailBusy" :disabled="!settings">{{ ownEmail ? '寄驗證信' : '寄驗證信並開啟週報' }}</el-button>
              <el-button v-if="ownEmail" @click="editingEmail = false">取消</el-button>
            </span>
            <span class="newsletter-page__note">{{ ownEmail
              ? '換了 email 要重新驗證，驗證完才會寄到新的 email。'
              : '點驗證信裡的連結確認後就開始寄。按下去就是同意收週報，之後隨時可以關掉；這個 email 只用來寄週報，不會變成登入方式。' }}</span>
            <span v-if="!ownEmail" class="newsletter-page__note">或<NuxtLink to="/account#sign-in-methods-title" class="newsletter-page__link">加上 Google 登入</NuxtLink>，週報就寄到那個 Google 帳號的 email，不用另外驗證。</span>
          </form>
          <p v-if="emailMessage" class="newsletter-page__message" role="alert">{{ emailMessage }}</p>
        </div>

        <!-- 分隔線畫在外面這一層：fieldset 的上框線會穿過 legend -->
        <div class="newsletter-page__part">
          <fieldset class="newsletter-page__sections">
            <legend class="newsletter-page__name">{{ weekly?.optIn ? '每封要有哪幾塊（至少留一塊，改了就存）' : '每封有這幾塊（打開後可以挑）' }}</legend>
            <!-- 讀到之前照沒設定過的預設（四塊全選）畫，多數人讀到時不變。min：只剩一塊時那一塊不能取消（勾選框自己不能再傳 disabled，
                 Element 會拿它蓋掉群組的停用） -->
            <el-checkbox-group :model-value="weekly?.sections ?? ALL_SECTIONS" :disabled="!weekly?.optIn" :min="1" class="newsletter-page__checks" @change="setSections">
              <el-checkbox v-for="section in NEWSLETTER_SECTIONS" :key="section.code" :value="section.code" class="newsletter-page__check">
                <span class="newsletter-page__check-name">{{ section.label }}</span>
                <span class="newsletter-page__note">{{ section.hint }}</span>
              </el-checkbox>
            </el-checkbox-group>
          </fieldset>
        </div>

        <div class="newsletter-page__part newsletter-page__text">
          <p class="newsletter-page__note">每週一封。專業版之後會有每天或即時，內容一樣，只是寄得比較快。</p>
          <el-button class="newsletter-page__sample" @click="sampleOpen = true">看範例週報</el-button>
        </div>
      </div>
      <p class="newsletter-page__footnote">只放你持有、加入觀察清單的股票。每封信最下面都有一鍵退訂，在這裡關掉也一樣。</p>
    </AccountSection>
    <AccountNewsletterSample v-model="sampleOpen" />
  </AccountPageShell>
</template>

<style scoped>
.newsletter-page__lead,
.newsletter-page__footnote {
  margin: 0;
  color: var(--el-text-color-regular);
}

.newsletter-page__footnote {
  margin-top: 12px;
}

/* 卡片裡一段一段，段與段之間一條淡線（同帳號與登入的登入方式） */
.newsletter-page__part {
  margin: 0;
  padding: 16px;
}

.newsletter-page__part + .newsletter-page__part {
  border-top: 1px solid var(--app-divider);
}

.newsletter-page__switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.newsletter-page__text {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
}

.newsletter-page__name {
  margin: 0;
  padding: 0;
  font-size: 1rem;
  font-weight: 600;
}

.newsletter-page__status {
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.newsletter-page__note {
  margin: 0;
  color: var(--el-text-color-secondary);
}

.newsletter-page__email {
  overflow-wrap: anywhere;
}

.newsletter-page__tag {
  display: inline-block;
  margin-left: 8px;
  padding: 0 8px;
  border: 1px solid var(--el-border-color);
  border-radius: 999px;
  font-size: 0.875rem;
  color: var(--el-text-color-regular);
}

/* 開關的觸控範圍 44px */
.newsletter-page__switch-row .el-switch {
  flex: none;
  height: 44px;
}

.newsletter-page__form {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-self: stretch;
}

/* 並排的按鈕相隔 8px（全站），折行時也一樣 */
.newsletter-page__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.newsletter-page__actions .el-button {
  min-height: 44px;
  margin: 0;
}

.newsletter-page__message {
  margin: 0;
  color: var(--el-color-danger);
}

.newsletter-page__sections {
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}

/* 卡片寬（電腦版在右邊那欄）時排成兩欄；手機一欄 */
.newsletter-page__checks {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
  gap: 4px 24px;
  margin-top: 8px;
}

/* 一個勾選框兩行：名稱一行、說明一行；整列至少 44px 高 */
.newsletter-page__check {
  height: auto;
  min-height: 44px;
  margin-right: 0;
  align-items: flex-start;
  padding: 8px 0;
  white-space: normal;
}

.newsletter-page__check :deep(.el-checkbox__input) {
  margin-top: 0.25em;
}

.newsletter-page__check :deep(.el-checkbox__label) {
  display: flex;
  flex-direction: column;
  font-size: 1rem;
  line-height: 1.5;
}

.newsletter-page__check-name {
  color: var(--el-text-color-primary);
}

.newsletter-page__sample {
  min-height: 44px;
  margin-top: 8px;
}

.newsletter-page__link {
  color: var(--el-color-primary-dark-2);
  text-decoration: underline;
}
</style>
