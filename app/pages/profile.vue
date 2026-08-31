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
</style>
