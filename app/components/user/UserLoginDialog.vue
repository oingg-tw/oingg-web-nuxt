<script setup lang="ts">
const { visible, close } = useLoginDialog()
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
    // Google 登入在 LINE 內建瀏覽器一定失敗（Google 擋嵌入式 WebView），那裡只留 LINE 與電子郵件
    signInOptions: inLine ? ['password'] : ['google.com', 'password'],
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
      <!-- LINE 登入是一般的網頁跳轉（app/utils/line-login.ts），不經過 FirebaseUI -->
      <div class="login-dialog__line">
        <el-button class="login-dialog__line-button" @click="startLineLogin(route.fullPath)">用 LINE 登入</el-button>
        <p v-if="inLine" class="login-dialog__note">在 LINE 裡無法用 Google 登入，請用 LINE 或電子郵件。</p>
      </div>
      <div id="firebaseui-auth-container" />
    </el-dialog>
  </ClientOnly>
</template>

<style scoped>
/* 跟 FirebaseUI 的按鈕同寬、置中（它們是 max-width 220px） */
.login-dialog__line {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}

.login-dialog__line-button {
  width: 100%;
  max-width: 220px;
}

.login-dialog__note {
  margin: 0;
  text-align: center;
}
</style>
