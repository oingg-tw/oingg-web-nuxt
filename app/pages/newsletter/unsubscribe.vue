<script setup lang="ts">
// 信裡「不再收週報」打開的頁（2026-11-16，業務中台的合約；設計 https://claude.ai/artifact/YK4pXxDNTwggGgbB4DvoEN 的 5～8）。不用登入。兩種網址：
//   - 內文的連結 #t=<token>：# 後面不會送到伺服器，網站與業務中台的紀錄都沒有它。讀到後查遮罩過的 email 與狀態（POST /newsletter/token/lookup），
//     按「不再收週報」才退訂（POST /newsletter/opt-out）：打開就退訂的話，信箱的安全掃描先點一次就把人退掉了。退訂後可以「繼續收週報」
//   - 信件標頭 List-Unsubscribe 的 ?t=<token>：Gmail、Yahoo 用 POST 打（server/routes/newsletter/unsubscribe.post.ts），有些信箱用 GET 打開，
//     就是這一頁。那把 token 只能退訂（查詢、繼續收都回 404），所以不查、直接給「不再收週報」，退訂後也沒有「繼續收」
// 標頭（不快取、不收錄、Referer 只送網域）在 nuxt.config 的 routeRules
useSeoMeta({ title: '不再收週報', robots: 'noindex, nofollow' })

type Step = 'loading' | 'confirm' | 'stopped' | 'resumed' | 'expired'
const route = useRoute()
// 標頭那把在網址的 ? 後面，伺服器就看得到：第一個畫面直接是確認頁。內文那把在 # 後面，要等瀏覽器讀
const fromHeader = route.query.t
const headerToken = isNewsletterToken(fromHeader)
const step = ref<Step>(headerToken ? 'confirm' : 'loading')
const token = ref(headerToken ? fromHeader : '')
const maskedEmail = ref<string | null>(null)
const lookupError = ref<unknown>(null)
const busy = ref(false)
const message = ref('')
const recipient = computed(() => (maskedEmail.value ? `到 ${maskedEmail.value}` : '給你'))

async function lookup() {
  lookupError.value = null
  try {
    const state = await apiFetch<NewsletterTokenState>('/newsletter/token/lookup', { method: 'POST', body: { token: token.value } })
    maskedEmail.value = state.maskedEmail
    step.value = state.optIn ? 'confirm' : 'stopped'
  } catch (error) {
    // 4xx（不認得的 token）是連結失效；連不上、5xx 交給全站的讀取失敗彈窗重試
    if ((businessErrorStatus(error) ?? 500) < 500) step.value = 'expired'
    else lookupError.value = error
  }
}
watchLoadFailure('newsletter-token', () => lookupError.value, lookup)

onMounted(() => {
  if (headerToken) return
  const fromBody = new URLSearchParams(route.hash.slice(1)).get('t')
  if (!isNewsletterToken(fromBody)) {
    step.value = 'expired'
    return
  }
  token.value = fromBody
  void lookup()
})

async function send(action: 'opt-out' | 'opt-in') {
  message.value = ''
  busy.value = true
  try {
    const state = await apiFetch<NewsletterTokenState>(`/newsletter/${action}`, { method: 'POST', body: { token: token.value } })
    maskedEmail.value = state.maskedEmail ?? maskedEmail.value
    step.value = action === 'opt-out' ? 'stopped' : 'resumed'
  } catch (error) {
    const status = businessErrorStatus(error)
    if (action === 'opt-out' && status === 404) step.value = 'expired'
    else if (businessErrorCode(error) === 'newsletter_email_missing') message.value = '這個帳號沒有 email，沒辦法寄週報。'
    else message.value = status === 404 ? '這個連結沒辦法重新開啟週報，請登入後到帳號設定打開。' : '沒有送出，請再試一次。'
  } finally {
    busy.value = false
  }
}

// 「登入後到帳號設定」：帳號頁會把訪客送回首頁，所以沒登入的先開登入，在這一頁登入好了再過去
const currentUser = useCurrentUser()
const { open: openLogin } = useLoginDialog()
const toSettings = ref(false)
function openSettings() {
  if (currentUser.value) return navigateTo('/account/newsletter')
  toSettings.value = true
  openLogin('登入後就能管理電子報。')
}
watch(currentUser, (user) => {
  if (user && toSettings.value) void navigateTo('/account/newsletter')
})
</script>

<template>
  <div class="newsletter-unsubscribe">
    <template v-if="step === 'loading' || step === 'confirm'">
      <h1 class="app-page__title app-page__title--app">不再收每週持股週報？</h1>
      <p v-if="step === 'loading'" class="newsletter-unsubscribe__lead"><span class="app-skeleton app-skeleton--flow" aria-hidden="true">按下去之後，就不會再寄週報到 n***@example.com。</span></p>
      <p v-else class="newsletter-unsubscribe__lead">按下去之後，就不會再寄週報{{ recipient }}。</p>
      <div class="app-card newsletter-unsubscribe__card">
        <el-button type="primary" :loading="busy" :disabled="step === 'loading'" class="newsletter-unsubscribe__primary" @click="send('opt-out')">不再收週報</el-button>
        <NuxtLink to="/" class="newsletter-unsubscribe__link">繼續收，不用改</NuxtLink>
      </div>
      <p class="newsletter-unsubscribe__note">不用登入。要挑週報裡放哪幾塊，可以<button type="button" class="newsletter-unsubscribe__inline" @click="openSettings">登入後到帳號設定</button>。</p>
    </template>

    <template v-else-if="step === 'stopped'">
      <h1 class="app-page__title app-page__title--app">已停止寄週報</h1>
      <p class="newsletter-unsubscribe__lead" role="status">之後不會再寄每週持股週報{{ recipient }}。</p>
      <div v-if="!headerToken" class="app-card newsletter-unsubscribe__card">
        <p class="newsletter-unsubscribe__ask">按錯了嗎？</p>
        <el-button type="primary" :loading="busy" class="newsletter-unsubscribe__primary" @click="send('opt-in')">繼續收週報</el-button>
      </div>
      <p class="newsletter-unsubscribe__note">登入後也能在<button type="button" class="newsletter-unsubscribe__inline" @click="openSettings">帳號設定</button>重新開啟。你的持股和觀察清單都還在，沒有變動。</p>
    </template>

    <template v-else-if="step === 'resumed'">
      <h1 class="app-page__title app-page__title--app">週報會照常寄給你</h1>
      <p class="newsletter-unsubscribe__lead" role="status">下一封預計 {{ nextNewsletterIssue(Date.now()) }}寄{{ recipient }}，內容跟之前選的一樣；那週沒有內容就不寄。</p>
      <div class="app-card newsletter-unsubscribe__card">
        <!-- 連到首頁是連結，借 Element 主要按鈕的樣子 -->
        <NuxtLink to="/" class="el-button el-button--primary newsletter-unsubscribe__primary">到安盈選股首頁</NuxtLink>
        <button type="button" class="newsletter-unsubscribe__link" @click="openSettings">管理電子報設定</button>
      </div>
    </template>

    <template v-else>
      <h1 class="app-page__title app-page__title--app">這個連結已經不能用</h1>
      <p class="newsletter-unsubscribe__lead">連結可能不完整，或已經失效。要停止或重新開啟週報，登入後到帳號設定就能改。</p>
      <div class="app-card newsletter-unsubscribe__card">
        <el-button type="primary" class="newsletter-unsubscribe__primary" @click="openSettings">登入並管理電子報</el-button>
        <NuxtLink to="/" class="newsletter-unsubscribe__link">到安盈選股首頁</NuxtLink>
      </div>
      <p class="newsletter-unsubscribe__note">也可以直接用信箱的「取消訂閱」按鈕（Gmail、Yahoo 在信件最上面），一樣會停止。</p>
    </template>

    <p v-if="message" class="newsletter-unsubscribe__message" role="alert">{{ message }}</p>
  </div>
</template>

<style scoped>
.newsletter-unsubscribe {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
  max-width: 480px;
  margin: 0 auto;
}

.newsletter-unsubscribe p {
  margin: 0;
}

.newsletter-unsubscribe__lead {
  color: var(--el-text-color-regular);
}

.newsletter-unsubscribe__card {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 8px;
  padding: 16px;
}

.newsletter-unsubscribe__primary {
  min-height: 48px;
  margin: 0;
}

.newsletter-unsubscribe__link,
.newsletter-unsubscribe__inline {
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  color: var(--el-color-primary-dark-2);
  cursor: pointer;
}

.newsletter-unsubscribe__link {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
}

.newsletter-unsubscribe__inline {
  text-decoration: underline;
}

.newsletter-unsubscribe__note {
  color: var(--el-text-color-secondary);
}

.newsletter-unsubscribe__message {
  color: var(--el-color-danger);
}
</style>
