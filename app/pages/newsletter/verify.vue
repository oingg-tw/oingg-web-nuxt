<script setup lang="ts">
// 驗證信裡的連結打開的頁（2026-11-16，業務中台的 newsletterEmail 合約；設計 https://claude.ai/artifact/YK4pXxDNTwggGgbB4DvoEN 的 11～13）。不用登入。
// token 在 # 後面，不進任何紀錄。按「確認 email」才送出（POST /newsletter/email/verify）：有些信箱的安全掃描會連頁面的程式一起跑，打開就確認的話，
// 填錯的那個信箱沒按也會被確認，週報（有持股數字）就寄給了別人。版面是 NewsletterResult；標頭在 nuxt.config 的 routeRules
useSeoMeta({ title: '確認 email', robots: 'noindex, nofollow' })

type Step = 'confirm' | 'verified' | 'taken' | 'expired'
const route = useRoute()
const step = ref<Step>('confirm')
const token = ref('')
const busy = ref(false)
const message = ref('')
const result = ref<NewsletterVerifyResult | null>(null)
const weeklyOn = computed(() => result.value?.editions.some(edition => edition.edition === 'weekly' && edition.optIn) ?? false)

onMounted(() => {
  const fromLink = new URLSearchParams(route.hash.slice(1)).get('t')
  if (isNewsletterToken(fromLink)) token.value = fromLink
  else step.value = 'expired'
})

async function verify() {
  message.value = ''
  busy.value = true
  try {
    result.value = await apiFetch<NewsletterVerifyResult>('/newsletter/email/verify', { method: 'POST', body: { token: token.value } })
    step.value = 'verified'
  } catch (error) {
    const status = businessErrorStatus(error)
    // 404：用過、過期、重寄過或換過 email；409：別的帳號在用；連不上、5xx 留在這一頁再按一次
    if (businessErrorCode(error) === 'newsletter_email_taken') step.value = 'taken'
    else if (status && status < 500) step.value = 'expired'
    else message.value = '沒有送出，請再試一次。'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <NewsletterResult v-if="step === 'confirm'" title="確認你的 email" :message="message">
    <p class="newsletter-result__lead">按下確認，就能用這個 email 收安盈選股的每週持股週報。</p>
    <template #actions>
      <el-button type="primary" :loading="busy" :disabled="!token" class="newsletter-result__primary" @click="verify">確認 email</el-button>
    </template>
    <template #note>
      <p class="newsletter-result__note">不是你填的就不用按，關掉這一頁就好；沒有確認，我們不會寄任何週報。</p>
    </template>
  </NewsletterResult>

  <NewsletterResult v-else-if="step === 'verified'" title="email 已驗證">
    <p v-if="weeklyOn" class="newsletter-result__lead" role="status">持股週報會寄到 {{ result?.maskedAddress }}，第一封預計 {{ nextNewsletterIssue(Date.now()) }}；那週沒有內容就不寄。</p>
    <p v-else class="newsletter-result__lead" role="status">週報現在是關著的；登入後在帳號設定打開，就會寄到 {{ result?.maskedAddress }}。</p>
    <template #actions="{ toSettings }">
      <NuxtLink to="/" class="el-button el-button--primary newsletter-result__primary">到安盈選股首頁</NuxtLink>
      <button type="button" class="newsletter-result__link" @click="toSettings">管理電子報設定</button>
    </template>
    <template #note>
      <p class="newsletter-result__note">這一頁不用登入，在別的手機或電腦打開也可以。要挑週報裡放哪幾塊，登入後到帳號設定。</p>
    </template>
  </NewsletterResult>

  <NewsletterResult v-else-if="step === 'taken'" title="這個 email 已經用在別的帳號">
    <p class="newsletter-result__lead">它已經是另一個安盈選股帳號的 email，所以沒辦法用在這個帳號收週報。</p>
    <template #actions="{ toSettings }">
      <el-button type="primary" class="newsletter-result__primary" @click="toSettings">登入並改用別的 email</el-button>
      <NuxtLink to="/" class="newsletter-result__link">到安盈選股首頁</NuxtLink>
    </template>
    <template #note>
      <p class="newsletter-result__note">那個帳號是你的話，用它登入就能收週報；兩個帳號的持股和觀察清單不會合併。</p>
    </template>
  </NewsletterResult>

  <NewsletterResult v-else title="這個驗證連結已經不能用">
    <p class="newsletter-result__lead">連結可能已經用過、超過 24 小時，或之後重寄過、換過 email。登入後在帳號設定再寄一封就好。</p>
    <template #actions="{ toSettings }">
      <el-button type="primary" class="newsletter-result__primary" @click="toSettings">登入並重寄驗證信</el-button>
      <NuxtLink to="/" class="newsletter-result__link">到安盈選股首頁</NuxtLink>
    </template>
    <template #note>
      <p class="newsletter-result__note">如果已經驗證過，週報會照常寄，不用再做什麼。</p>
    </template>
  </NewsletterResult>
</template>
