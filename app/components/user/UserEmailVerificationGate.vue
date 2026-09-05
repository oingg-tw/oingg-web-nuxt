<script setup lang="ts">
// Wraps every app-shell page's <slot/> (desktop.vue/mobile.vue — not landing.vue, which
// stays open to signed-out visitors entirely). Blocks only the specific gap this closes:
// an email/password sign-up that never clicked its verification link (see
// UserLoginDialog.vue's signInSuccessWithAuthResult, which is what actually sends that
// email). A signed-out visitor, or any Google-signed-in user (always emailVerified:true,
// Google verifies the address itself) is never touched by this at all.
const currentUser = useCurrentUser()
const authResolved = useAuthResolved()
const compatAuth = useFirebaseCompatAuth()

// !import.meta.dev: explicit local-dev bypass per direct user request, so testing doesn't
// require actually clicking a real verification link every time.
// authResolved: firebase.client.ts's onAuthStateChanged only flips this once, always
// asynchronously (even for a warm/cached session) — without it, an already-verified
// returning user would flash this gate for an instant before their real state loads (same
// race useScreenerTabs.ts's own tabsReady already guards against).
const isGated = computed(
  () => !import.meta.dev && authResolved.value && !!currentUser.value && currentUser.value.emailVerified === false
)

const resending = ref(false)
const resendCooldown = ref(0)
let cooldownTimer: ReturnType<typeof setInterval> | undefined

function startCooldown() {
  resendCooldown.value = 60
  cooldownTimer = setInterval(() => {
    resendCooldown.value -= 1
    if (resendCooldown.value <= 0 && cooldownTimer) clearInterval(cooldownTimer)
  }, 1000)
}

async function resendEmail() {
  if (!currentUser.value || resendCooldown.value > 0) return
  resending.value = true
  try {
    await currentUser.value.sendEmailVerification()
    ElMessage.success('驗證信已寄出，請查收')
    startCooldown()
  } catch {
    ElMessage.error('寄送失敗，請稍後再試')
  } finally {
    resending.value = false
  }
}

const checking = ref(false)

async function checkVerified() {
  if (!currentUser.value) return
  checking.value = true
  try {
    // reload() mutates the SAME User object in place rather than firing
    // onAuthStateChanged again (that's for sign-in/out transitions, not a profile-detail
    // change like this) — currentUser being a useState ref means Vue only re-runs isGated
    // above if the ref's own .value identity changes, which a plain in-place mutation never
    // triggers on its own. triggerRef forces that re-evaluation without needing to
    // reassign a new object (which would lose the User instance's own methods/prototype).
    await currentUser.value.reload()
    triggerRef(currentUser)
    if (!currentUser.value?.emailVerified) {
      ElMessage.warning('尚未偵測到驗證，請確認已點擊信件中的連結')
    }
  } finally {
    checking.value = false
  }
}

async function handleSignOut() {
  await compatAuth.signOut()
}

onUnmounted(() => {
  if (cooldownTimer) clearInterval(cooldownTimer)
})
</script>

<template>
  <div v-if="isGated" class="email-verification-gate">
    <el-result icon="warning" title="請先驗證您的電子郵件">
      <template #sub-title>
        <p class="email-verification-gate__message">
          我們已寄送驗證信到 {{ currentUser?.email }}，請點擊信中的連結完成驗證後再繼續使用。
        </p>
      </template>
      <template #extra>
        <el-button type="primary" :loading="checking" @click="checkVerified">我已完成驗證</el-button>
        <el-button :disabled="resendCooldown > 0" :loading="resending" @click="resendEmail">
          {{ resendCooldown > 0 ? `重新寄送 (${resendCooldown}s)` : '重新寄送驗證信' }}
        </el-button>
        <el-button text @click="handleSignOut">登出</el-button>
      </template>
    </el-result>
  </div>
  <slot v-else />
</template>

<style scoped>
.email-verification-gate {
  display: flex;
  justify-content: center;
  padding: 48px 16px;
}

.email-verification-gate__message {
  font-size: 16px;
  color: var(--el-text-color-secondary);
}
</style>
