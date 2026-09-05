<script setup lang="ts">
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
</script>

<template>
  <div v-if="currentUser" class="profile-page">
    <h1 class="profile-page__title">個人資料設定</h1>
    <div class="profile-page__card">
      <el-avatar :size="72" :src="currentUser.photoURL ?? undefined" class="profile-page__avatar">
        {{ displayLabel.slice(0, 1).toUpperCase() }}
      </el-avatar>
      <p class="profile-page__name">{{ currentUser.displayName || '未設定名稱' }}</p>
      <p class="profile-page__email">{{ currentUser.email }}</p>
      <el-button :icon="SwitchButton" class="profile-page__signout" @click="handleSignOut">登出</el-button>
    </div>

    <!-- Structural shell only — no billing/subscription backend exists anywhere yet (no
         bff-ts endpoint, no payment processor). Price is real (user-supplied), but nothing
         here is actually purchasable — the button is disabled rather than wired to a
         checkout flow that doesn't exist, per this app's own "no fabricated functionality"
         principle applied to actions, not just data. -->
    <section class="profile-page__section">
      <h2 class="profile-page__section-title">訂閱方案</h2>
      <div class="profile-page__plan-card">
        <div class="profile-page__plan-header">
          <span class="profile-page__plan-name">專業方案</span>
          <el-tag type="warning" round>即將推出</el-tag>
        </div>
        <p class="profile-page__plan-price">
          NT$ 399<span class="profile-page__plan-price-unit">/ 月</span>
        </p>
        <p class="profile-page__plan-price-alt">或 NT$ 3,990 / 年</p>
        <el-button disabled class="profile-page__plan-cta">敬請期待</el-button>
      </div>
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
  font-size: 20px;
  font-weight: 600;
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
  font-size: 18px;
  font-weight: 600;
}

.profile-page__email {
  margin: 0 0 16px;
  font-size: 14px;
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
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 12px;
}

.profile-page__plan-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 24px 16px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 12px;
}

.profile-page__plan-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.profile-page__plan-name {
  font-size: 18px;
  font-weight: 600;
}

.profile-page__plan-price {
  margin: 0;
  font-size: 28px;
  font-weight: 700;
  color: var(--el-color-primary);
}

.profile-page__plan-price-unit {
  font-size: 16px;
  font-weight: 400;
  color: var(--el-text-color-secondary);
}

.profile-page__plan-price-alt {
  margin: 0 0 16px;
  font-size: 16px;
  color: var(--el-text-color-secondary);
}

.profile-page__plan-cta {
  width: 100%;
  max-width: 240px;
}
</style>
