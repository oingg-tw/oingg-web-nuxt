<script setup lang="ts">
// 登入後是連到 /profile 的頭像；登出時是「登入」按鈕（外觀設定的入口在 AppHeaderMenu／AppFeatureMenu 各自的按鈕，
// 2026-09-16 起是連到 /appearance 的連結）。原本還有一個 popover 版的帳號選單給側欄用，側欄 2026-09-21 刪除後
// 兩個呼叫端都只用連結版，2026-10-08 連 popover 一起刪。
import { User } from '@element-plus/icons-vue'

// 標頭與手機列是純圖示；手機功能選單的頁尾有空間放名字，用 showName 打開
withDefaults(defineProps<{ showName?: boolean }>(), { showName: false })

const currentUser = useCurrentUser()
const { open: openLogin } = useLoginDialog()
// 登入狀態還沒確定（伺服器、hydration、Firebase 還在還原）：登入過的瀏覽器（firebase.client.ts 的 auth-hint）先畫一個頭像大小的
// 空位，不先畫「登入」再換掉（2026-10-20，使用者：「重新整理的時候會閃動」）。也要等 hydration：Firebase 可能在那之前就解析完，
// 瀏覽器的第一次渲染要跟伺服器一樣，否則 Hydration node mismatch（同日 dev 日誌量到的就是這裡）
const hasHydrated = useHasHydrated()
const authResolved = useAuthResolved()
const authHint = useCookie<boolean | null>('auth-hint')
const resolving = computed(() => !hasHydrated.value || !authResolved.value)

const displayLabel = computed(() => currentUser.value?.displayName || currentUser.value?.email || '')
const initial = computed(() => displayLabel.value.slice(0, 1).toUpperCase())
</script>

<template>
  <NuxtLink
    v-if="currentUser && !resolving"
    to="/profile"
    class="user-menu-button__trigger"
    aria-label="個人資料設定"
    :class="{ 'user-menu-button__trigger--named': showName }"
  >
    <!-- 一律傳 initial 當 fallback：有沒有顯示由 el-avatar 自己決定（沒有 src、或圖片載入失敗時） -->
    <el-avatar :size="32" :src="currentUser.photoURL ?? undefined" alt="" class="user-menu-button__avatar">
      {{ initial }}
    </el-avatar>
    <span v-if="showName" class="user-menu-button__name">{{ displayLabel }}</span>
  </NuxtLink>
  <span v-else-if="resolving && authHint" class="user-menu-button__pending" aria-hidden="true"><span class="user-menu-button__pending-avatar" /></span>
  <!-- 兩顆而不是一顆帶條件 slot 的按鈕：el-button 只要收到 default slot 就會多包一個 span，純圖示的圓形按鈕
       會因此偏離中心（2026-09-17） -->
  <el-button v-else-if="showName" :icon="User" title="登入" class="user-menu-button__action" @click="openLogin">登入</el-button>
  <el-button v-else :icon="User" circle title="登入" @click="openLogin" />
</template>

<style scoped>
.user-menu-button__trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  /* Lets the trigger itself shrink inside the header's flex row — see __name below for what it
     costs when it cannot. */
  min-width: 0;
}

/* 不設 width: 100%（2026-09-24 它讓標頭的搜尋框被擠到 0px）；要整列寬的呼叫端（AppFeatureMenu）自己設。 */

.user-menu-button__avatar {
  cursor: pointer;
  background: var(--el-color-primary);
  flex-shrink: 0;
}

/* min-width: 0 讓 ellipsis 真的生效（flex item 預設不肯縮到比內容窄；2026-09-24 沒有這行時整個名字把搜尋框擠扁）；
   max-width 把沒有顯示名稱、只剩 email 的帳號截短——搜尋框才是工具，名字只是識別。 */
.user-menu-button__name {
  font-size: 1rem;
  color: var(--el-text-color-primary);
  min-width: 0;
  max-width: 10em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 登入狀態確定前的空位：跟頭像一樣大，換成頭像時頁首不動 */
.user-menu-button__pending {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.user-menu-button__pending-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--el-fill-color);
}

/* 帶文字的「登入」要和旁邊的外觀設定按鈕同高（2026-09-20 反映兩顆高度不一） */
.user-menu-button__action {
  min-height: 44px;
}
</style>
