<script setup lang="ts">
const { visible, reason, close } = useLoginDialog()
const { arm: armPostLoginLoader } = usePostLoginLoader()
// firebaseui ships an `export =` .d.ts that doesn't line up with its ESM runtime export shape.
// firebaseui's own AuthUI type, obtained where it is used rather than restated here. The hand-
// written stub this replaces（`{ start; reset }`）was narrower than the real class, so assigning a
// genuine AuthUI to it failed — a self-inflicted mismatch, since the only reason for a stub was
// that firebaseui is imported dynamically. `typeof import(...)` gets the type without pulling the
// module into the bundle.
type FirebaseAuthUI = InstanceType<typeof import('firebaseui')['auth']['AuthUI']>

let authUI: FirebaseAuthUI | null = null
const route = useRoute()
const inLine = isLineInAppBrowser()

watch(visible, async open => {
  if (!open) return
  await nextTick()

  // compat 跟 FirebaseUI 一起在打開時才載（loadFirebaseCompatAuth，2026-10-16）：FirebaseUI 只會用 compat API
  const [{ auth: firebaseuiAuth }, compatAuth] = await Promise.all([
    import('firebaseui'),
    loadFirebaseCompatAuth(),
    // The CSS import resolves to a type now, so the @ts-expect-error that used to sit here became
    // an error of its own（TS2578）— removed rather than swapped for @ts-ignore, which would hide
    // the next real problem too.
    import('firebaseui/dist/firebaseui.css')
  ])

  authUI = firebaseuiAuth.AuthUI.getInstance() ?? new firebaseuiAuth.AuthUI(compatAuth)
  // Non-null after the line above assigns it; the compiler loses that across the `??`.
  authUI!.start('#firebaseui-auth-container', {
    // Google 登入在 LINE 內建瀏覽器一定失敗（Google 擋嵌入式 WebView），那裡只留 LINE 與電子郵件。
    // fullLabel 把按鈕換成中文（FirebaseUI 的 npm 版只有英文，表單裡面的字仍是英文）。
    // LINE 借 FirebaseUI 的按鈕清單排版，跟 Google 那顆同款（使用者 2026-10-18「比照 Sign in with Google」）；按下去由下面的
    // interceptLine 在捕獲階段攔下、改走我們自己的跳轉，Firebase 的 oidc.line 從來不會被呼叫（也沒有啟用）
    signInOptions: [
      ...(inLine ? [] : [{ provider: 'google.com', fullLabel: '使用 Google 帳號登入' }]),
      { provider: 'oidc.line', providerName: 'LINE', fullLabel: '使用 LINE 帳號登入', buttonColor: '#ffffff', iconUrl: '/images/line-icon.svg' },
      { provider: 'password', fullLabel: '使用電子郵件登入' }
    ],
    signInFlow: 'popup',
    credentialHelper: 'none',
    callbacks: {
      // authResult's shape is the standard Firebase UserCredential (confirmed against
      // firebaseui's own runtime source, not just its docs, since this file already has to
      // work around firebaseui's .d.ts not lining up with its ESM shape) — hand-written
      // minimal type here for the same reason authUI above gets one.
      signInSuccessWithAuthResult: (authResult: {
        user: { sendEmailVerification: () => Promise<void> }
        additionalUserInfo?: { isNewUser?: boolean; providerId?: string | null }
      }) => {
        // Only a brand-new password sign-up needs a verification email — a Google sign-up
        // is already emailVerified:true (Google verifies the address itself, sending one
        // here would just be a confusing extra email), and an existing user signing back in
        // (isNewUser false) already either verified or didn't; this moment shouldn't
        // re-trigger either way. See UserEmailVerificationGate for what actually gates on
        // the result of this.
        if (authResult.additionalUserInfo?.isNewUser && authResult.additionalUserInfo?.providerId === 'password') {
          authResult.user.sendEmailVerification()
        }
        armPostLoginLoader()
        close()
        return false
      }
    }
  })
})

// 滑鼠點與鍵盤都要攔：FirebaseUI 對 Enter 是在 keypress 上自己處理（不經過 click），keydown 擋下（preventDefault）它就收不到
function interceptLine(event: Event) {
  if (event instanceof KeyboardEvent && event.key !== 'Enter' && event.key !== ' ') return
  if (!(event.target as Element | null)?.closest('[data-provider-id="oidc.line"]')) return
  event.preventDefault()
  event.stopPropagation()
  startLineLogin(route.fullPath)
}

function handleClose() {
  close()
  authUI?.reset()
}
</script>

<template>
  <!-- el-dialog teleports to <body> and renders (closed) regardless of login state, so it
       always mounts during SSR too. Vue's SSR renderer buffers teleported content into a
       pass that runs after the rest of the tree, while the client mounts it in normal
       document order — that shifts the shared useId() counter differently on each side and
       can desync id-based siblings that come later (e.g. StockSearchBar's autocomplete).
       Login only ever happens after a click, well after hydration, so deferring this to
       client-only is free. -->
  <ClientOnly>
    <el-dialog v-model="visible" title="登入" width="min(360px, calc(100vw - 32px))" @close="handleClose">
      <p v-if="reason" class="login-dialog__reason">{{ reason }}</p>
      <p v-if="inLine" class="login-dialog__note">在 LINE 裡無法用 Google 登入，請用 LINE 或電子郵件。</p>
      <!-- 捕獲階段攔 LINE 那顆（見 signInOptions 的註解）：LINE 登入是一般的網頁跳轉（app/utils/line-login.ts），不經過 FirebaseUI -->
      <div id="firebaseui-auth-container" @click.capture="interceptLine" @keydown.capture="interceptLine" />
      <!-- LINE 的 email 用途（2026-10-20 帳號綁定）：按 LINE 之前就要看得到；申請 LINE Login 的 email 權限也是截這一段 -->
      <p class="login-dialog__privacy">用 LINE 登入時，會取得你在 LINE 登記的電子郵件，只用來連到你用同一個電子郵件註冊的帳號。</p>
    </el-dialog>
  </ClientOnly>
</template>

<style scoped>
.login-dialog__note {
  margin: 0 0 8px;
  text-align: center;
}

.login-dialog__reason {
  margin: 0 0 12px;
  line-height: 1.7;
}

.login-dialog__privacy {
  margin: 8px 0 0;
  color: var(--el-text-color-regular);
  line-height: 1.7;
}

/* LINE 那顆跟 Google 同款：白底、灰字（FirebaseUI 自訂按鈕預設白字，白底上看不到）。#757575 對白底 4.6:1 */
:deep([data-provider-id="oidc.line"] .firebaseui-idp-text) {
  color: #757575;
}

/* 2026-10-20 axe（登入對話框成了分享頁「加到我的觀察清單」的註冊入口）：FirebaseUI 的按鈕字是 14px（全站下限 16px），
   「使用電子郵件登入」白字壓在 #db4437 上只有 4.29:1。底色同色相調深到 #c5372c，白字 5.3:1；FirebaseUI 的 CSS 在打開時才載、
   排在後面，hover 那條同特異性會贏，所以加 !important */
:deep(.firebaseui-idp-text) {
  font-size: 1rem;
}

/* 三顆按鈕一樣寬，寬度跟著最長的那顆字（使用者 2026-10-20：「Google 登入折行了」；放寬成整個彈窗寬之後又「文字後面的留白
   過多」）。FirebaseUI 把按鈕鎖在 220px，字放到 16px 之後「使用 Google 帳號登入」差幾 px 放不下。不寫死寬度：Mac、Windows
   的字寬不一樣。清單照內容寬、置中，按鈕撐滿清單 */
:deep(.firebaseui-idp-list) {
  width: max-content;
  max-width: 100%;
  margin-left: auto;
  margin-right: auto;
}

:deep(.firebaseui-idp-button) {
  max-width: none;
}

:deep(.firebaseui-idp-password),
:deep(.firebaseui-idp-password:hover) {
  background-color: #c5372c !important;
}
</style>
