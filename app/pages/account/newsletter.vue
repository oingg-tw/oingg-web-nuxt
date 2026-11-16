<script setup lang="ts">
// 電子報（2026-11-16：使用者在業務中台那邊決定先做每週持股週報；設計 https://claude.ai/artifact/YK4pXxDNTwggGgbB4DvoEN）。預設關閉，打開開關
// 就是同意收信（業務中台 GET /newsletter、PUT /newsletter/weekly）；改了就存，不另外按儲存。信裡的退訂連結打開的是 /newsletter/unsubscribe。
// 設定頁：不給搜尋引擎收錄，也不進 sitemap
useSeoMeta({ title: '電子報', robots: 'noindex, nofollow' })

const currentUser = useCurrentUser()
const authedFetch = useAuthedFetch()
const settings = ref<NewsletterSettings | null>(null)
const loadError = ref<unknown>(null)
const weekly = computed(() => settings.value?.editions.find(edition => edition.edition === 'weekly') ?? null)
// LINE 建立的帳號沒有 email：開關換成「加上 Google 登入」。讀到之前先看 Firebase 的 email，版面不用等回應才決定
const hasEmail = computed(() => (settings.value ? !!settings.value.email : !!currentUser.value?.email))
const ALL_SECTIONS = NEWSLETTER_SECTIONS.map(section => section.code)
const nextIssue = nextNewsletterIssue(Date.now())
const sampleOpen = ref(false)

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
    showErrorMessage(businessErrorCode(error) === 'newsletter_email_missing' ? '這個帳號還沒有 email，加上 Google 登入後才能開啟週報。' : '沒有存到，請再試一次。')
    // 畫面回到業務中台存著的樣子
    await load()
    return false
  }
}

async function setOptIn(value: string | number | boolean) {
  if (!weekly.value) return
  const optIn = value === true
  weekly.value.optIn = optIn
  if ((await save({ optIn })) && optIn && weekly.value?.optIn) ElMessage.success(`週報已開啟，下一封預計 ${nextIssue}`)
}

function setSections(value: (string | number | boolean)[]) {
  const sections = ALL_SECTIONS.filter(code => value.includes(code))
  if (!weekly.value || !sections.length) return
  weekly.value.sections = sections
  void save({ sections })
}
</script>

<template>
  <AccountPageShell title="電子報">
    <p class="newsletter-page__lead">每週一封，整理你持有和關注的股票這一週發生的事。</p>

    <section v-if="hasEmail" class="app-card newsletter-page__card" aria-labelledby="newsletter-weekly-label">
      <div class="newsletter-page__part newsletter-page__switch-row">
        <div class="newsletter-page__text">
          <label id="newsletter-weekly-label" for="newsletter-weekly" class="newsletter-page__name">每週持股週報</label>
          <!-- 開、關兩種狀態都有這一行，讀到時不變高 -->
          <span v-if="weekly" class="newsletter-page__status">{{ weekly.optIn ? `已開啟・下一封預計 ${nextIssue}` : '未開啟・打開就是同意每週寄到下面的 email' }}</span>
          <span v-else class="newsletter-page__status"><span class="app-skeleton app-skeleton--flow" aria-hidden="true">未開啟・打開就是同意每週寄到下面的 email</span></span>
          <span class="newsletter-page__note">每週日晚上 8 點寄出。那週你持有、關注的股票都沒有可以整理的內容，就不寄。</span>
        </div>
        <el-switch id="newsletter-weekly" :model-value="weekly?.optIn ?? false" :disabled="!weekly" @change="setOptIn" />
      </div>

      <p class="newsletter-page__part newsletter-page__text">
        <span class="newsletter-page__name">寄到</span>
        <span v-if="settings" class="newsletter-page__email">{{ settings.email }}</span>
        <span v-else class="newsletter-page__email"><span class="app-skeleton app-skeleton--flow" aria-hidden="true">name@example.com</span></span>
        <span class="newsletter-page__note">用帳號的 email。要換成別的，請改用那個帳號登入。</span>
      </p>

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
    </section>

    <!-- LINE 建立的帳號：自己填 email 加驗證信等業務中台的合約（newsletterEmail），現在先給加上 Google 登入這條 -->
    <section v-else class="app-card newsletter-page__card" aria-labelledby="newsletter-weekly-name">
      <div class="newsletter-page__part newsletter-page__text">
        <h2 id="newsletter-weekly-name" class="newsletter-page__name">每週持股週報</h2>
        <span class="newsletter-page__status">每週日晚上 8 點寄出・要先有 email</span>
        <span class="newsletter-page__note">這個帳號是用 LINE 建立的，還沒有 email。加上 Google 登入，週報就寄到那個 Google 帳號的 email。</span>
        <NuxtLink to="/account#sign-in-methods-title" class="newsletter-page__link">到「帳號與登入」加上 Google 登入</NuxtLink>
      </div>
    </section>

    <p class="newsletter-page__footnote">只放你持有、加入觀察清單的股票。每封信最下面都有一鍵退訂，在這裡關掉也一樣。</p>
    <AccountNewsletterSample v-model="sampleOpen" />
  </AccountPageShell>
</template>

<style scoped>
.newsletter-page__lead,
.newsletter-page__footnote {
  margin: 0;
  color: var(--el-text-color-regular);
}

.newsletter-page__card {
  margin-top: 16px;
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
  align-items: flex-start;
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
  color: var(--el-text-color-primary);
}

.newsletter-page__note {
  margin: 0;
  color: var(--el-text-color-secondary);
}

.newsletter-page__email {
  overflow-wrap: anywhere;
}

/* 開關的觸控範圍 44px */
.newsletter-page__switch-row .el-switch {
  flex: none;
  height: 44px;
}

.newsletter-page__sections {
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}

.newsletter-page__checks {
  display: flex;
  flex-direction: column;
  gap: 4px;
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
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  color: var(--el-color-primary-dark-2);
}
</style>
