<script setup lang="ts">
// 信裡「不再收週報」打開的頁（2026-11-16，業務中台的合約；設計 https://claude.ai/artifact/YK4pXxDNTwggGgbB4DvoEN 的 5～8）。不用登入。兩種網址：
//   - 內文的連結 #t=<token>：# 後面不會送到伺服器，網站與業務中台的紀錄都沒有它。讀到後查遮罩過的 email 與狀態（POST /newsletter/token/lookup），
//     按「不再收週報」才退訂（POST /newsletter/opt-out）：打開就退訂的話，信箱的安全掃描先點一次就把人退掉了。退訂後可以「繼續收週報」
//   - 信件標頭 List-Unsubscribe 的 ?t=<token>：Gmail、Yahoo 用 POST 打（server/routes/newsletter/unsubscribe.post.ts），有些信箱用 GET 打開，
//     就是這一頁。那把 token 只能退訂（查詢、繼續收都回 404），所以不查、直接給「不再收週報」，退訂後也沒有「繼續收」
// 版面是 NewsletterResult；標頭（不快取、不收錄、Referer 只送網域）在 nuxt.config 的 routeRules
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
    else if (businessErrorCode(error) === 'newsletter_email_missing') message.value = '這個帳號沒有收信的 email，沒辦法寄週報。'
    else message.value = status === 404 ? '這個連結沒辦法重新開啟週報，請登入後到帳號設定打開。' : '沒有送出，請再試一次。'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <NewsletterResult v-if="step === 'loading' || step === 'confirm'" title="不再收每週持股週報？" :message="message">
    <p v-if="step === 'loading'" class="newsletter-result__lead"><span class="app-skeleton app-skeleton--flow" aria-hidden="true">按下去之後，就不會再寄週報到 n***@example.com。</span></p>
    <p v-else class="newsletter-result__lead">按下去之後，就不會再寄週報{{ recipient }}。</p>
    <template #actions>
      <el-button type="primary" :loading="busy" :disabled="step === 'loading'" class="newsletter-result__primary" @click="send('opt-out')">不再收週報</el-button>
      <NuxtLink to="/" class="newsletter-result__link">繼續收，不用改</NuxtLink>
    </template>
    <template #note="{ toSettings }">
      <p class="newsletter-result__note">不用登入。要挑週報裡放哪幾塊，可以<button type="button" class="newsletter-result__inline" @click="toSettings">登入後到帳號設定</button>。</p>
    </template>
  </NewsletterResult>

  <NewsletterResult v-else-if="step === 'stopped'" title="已停止寄週報" :message="message">
    <p class="newsletter-result__lead" role="status">之後不會再寄每週持股週報{{ recipient }}。</p>
    <template v-if="!headerToken" #actions>
      <p>按錯了嗎？</p>
      <el-button type="primary" :loading="busy" class="newsletter-result__primary" @click="send('opt-in')">繼續收週報</el-button>
    </template>
    <template #note="{ toSettings }">
      <p class="newsletter-result__note">登入後也能在<button type="button" class="newsletter-result__inline" @click="toSettings">帳號設定</button>重新開啟。你的持股和觀察清單都還在，沒有變動。</p>
    </template>
  </NewsletterResult>

  <NewsletterResult v-else-if="step === 'resumed'" title="週報會照常寄給你">
    <p class="newsletter-result__lead" role="status">下一封預計 {{ nextNewsletterIssue(Date.now()) }}寄{{ recipient }}，內容跟之前選的一樣；那週沒有內容就不寄。</p>
    <template #actions="{ toSettings }">
      <!-- 連到首頁是連結，借 Element 主要按鈕的樣子 -->
      <NuxtLink to="/" class="el-button el-button--primary newsletter-result__primary">到安盈選股首頁</NuxtLink>
      <button type="button" class="newsletter-result__link" @click="toSettings">管理電子報設定</button>
    </template>
  </NewsletterResult>

  <NewsletterResult v-else title="這個連結已經不能用">
    <p class="newsletter-result__lead">連結可能不完整，或已經失效。要停止或重新開啟週報，登入後到帳號設定就能改。</p>
    <template #actions="{ toSettings }">
      <el-button type="primary" class="newsletter-result__primary" @click="toSettings">登入並管理電子報</el-button>
      <NuxtLink to="/" class="newsletter-result__link">到安盈選股首頁</NuxtLink>
    </template>
    <template #note>
      <p class="newsletter-result__note">也可以直接用信箱的「取消訂閱」按鈕（Gmail、Yahoo 在信件最上面），一樣會停止。</p>
    </template>
  </NewsletterResult>
</template>
