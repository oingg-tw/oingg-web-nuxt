<script setup lang="ts">
// 登入後是連到 /profile 的帳號入口；登出時是「登入」按鈕。兩個版型（2026-10-21 頁首重新設計時整理，使用者：「app-header-menu 我懷疑
// 這邊的樣式也是不一致的 請重新設計」）：
//   - bar：頁首那一顆，.app-bar-item 的樣子。登入前「登入」、登入後「頭像＋帳號」，兩個一樣寬——原本「登入」86px、登入後只剩 32px
//     的頭像，登入狀態一換搜尋框就跟著移位。登入後不顯示名稱（2026-09-24「登入後的名稱在電腦版不用顯示」），「帳號」兩個字是給人
//     知道這顆是什麼
//   - row：手機選單層最上面整列寬的一列：頭像、名稱、「個人資料與設定」、箭頭；登出時是整列寬的「登入」按鈕。原本登入後是一行帶底線的
//     email 連結
// 外觀設定的入口在 AppHeaderMenu／AppFeatureMenu 各自的按鈕。
import { ArrowRight, User } from '@element-plus/icons-vue'

withDefaults(defineProps<{ layout?: 'bar' | 'row' }>(), { layout: 'bar' })

const currentUser = useCurrentUser()
const { open: openLogin } = useLoginDialog()
// 登入狀態還沒確定（伺服器、hydration、Firebase 還在還原）：登入過的瀏覽器（firebase.client.ts 的 auth-hint）先畫登入後的樣子
// 但不能點，不先畫「登入」再換掉（2026-10-20，使用者：「重新整理的時候會閃動」）。也要等這個元件自己接手（mounted）：它的第一次
// 渲染要跟伺服器一樣。看的是自己、不是整個 app 的 hydration——手機選單層延後接手（hydrate-on-idle），接手時 app 早就 hydrate 完、
// 登入也確定了，用 app 的旗標它第一次就畫頭像連結，伺服器畫的卻是佔位（2026-10-21 使用者回報 Hydration mismatch，375 的個股頁量到）
const mounted = ref(false)
onMounted(() => { mounted.value = true })
const authResolved = useAuthResolved()
const authHint = useCookie<boolean | null>('auth-hint')
const resolving = computed(() => !mounted.value || !authResolved.value)

const displayLabel = computed(() => currentUser.value?.displayName || currentUser.value?.email || '')
const initial = computed(() => displayLabel.value.slice(0, 1).toUpperCase())
</script>

<template>
  <template v-if="layout === 'bar'">
    <NuxtLink v-if="currentUser && !resolving" to="/profile" class="app-bar-item user-menu-button user-menu-button__trigger">
      <el-avatar :size="24" :src="currentUser.photoURL ?? undefined" alt="" class="user-menu-button__avatar">{{ initial }}</el-avatar>
      帳號<span class="visually-hidden">：個人資料設定</span>
    </NuxtLink>
    <span v-else-if="resolving && authHint" class="app-bar-item user-menu-button user-menu-button--pending" aria-hidden="true">
      <span class="user-menu-button__pending-avatar" />帳號
    </span>
    <button v-else type="button" class="app-bar-item user-menu-button" title="登入" @click="openLogin">
      <el-icon aria-hidden="true"><User /></el-icon>登入
    </button>
  </template>

  <template v-else>
    <NuxtLink v-if="currentUser && !resolving" to="/profile" class="user-menu-button__row user-menu-button__trigger">
      <el-avatar :size="40" :src="currentUser.photoURL ?? undefined" alt="" class="user-menu-button__avatar">{{ initial }}</el-avatar>
      <span class="user-menu-button__text">
        <span class="user-menu-button__name">{{ displayLabel }}</span>
        <span class="user-menu-button__hint">個人資料與設定</span>
      </span>
      <el-icon aria-hidden="true" class="user-menu-button__arrow"><ArrowRight /></el-icon>
    </NuxtLink>
    <span v-else-if="resolving && authHint" class="user-menu-button__row user-menu-button--pending" aria-hidden="true">
      <span class="user-menu-button__pending-avatar user-menu-button__pending-avatar--row" />
    </span>
    <el-button v-else type="primary" size="large" :icon="User" title="登入" class="user-menu-button__login" @click="openLogin">登入</el-button>
  </template>
</template>

<style scoped>
/* 頁首那一顆：登入與帳號同寬（見上面的說明） */
.user-menu-button {
  min-width: 88px;
}

.user-menu-button__avatar {
  flex-shrink: 0;
  background: var(--el-color-primary);
}

.user-menu-button--pending {
  cursor: default;
}

/* 登入狀態確定前的頭像空位：跟頭像一樣大 */
.user-menu-button__pending-avatar {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--el-fill-color);
}

.user-menu-button__pending-avatar--row {
  width: 40px;
  height: 40px;
}

/* 手機選單層的那一列：整列可點、64px 高 */
.user-menu-button__row {
  display: flex;
  align-items: center;
  gap: 12px;
  box-sizing: border-box;
  width: 100%;
  min-height: 64px;
  padding: 8px 12px;
  border-radius: 12px;
  color: var(--el-text-color-primary);
  text-decoration: none;
}

a.user-menu-button__row:hover {
  background: var(--el-fill-color-light);
}

.user-menu-button__text {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
}

/* 沒有顯示名稱、只剩 email 的帳號截短 */
.user-menu-button__name {
  overflow: hidden;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-menu-button__hint {
  color: var(--el-text-color-secondary);
}

.user-menu-button__arrow {
  flex-shrink: 0;
  color: var(--el-text-color-secondary);
}

.user-menu-button__login {
  width: 100%;
}
</style>
