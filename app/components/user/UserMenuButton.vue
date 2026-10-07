<script setup lang="ts">
// 登入後是連到 /profile 的頭像；登出時是「登入」按鈕（外觀設定的入口在 AppHeaderMenu／AppFeatureMenu 各自的按鈕，
// 2026-09-16 起是連到 /appearance 的連結）。原本還有一個 popover 版的帳號選單給側欄用，側欄 2026-09-21 刪除後
// 兩個呼叫端都只用連結版，2026-10-08 連 popover 一起刪。
import { User } from '@element-plus/icons-vue'

// 標頭與手機列是純圖示；手機功能選單的頁尾有空間放名字，用 showName 打開
withDefaults(defineProps<{ showName?: boolean }>(), { showName: false })

const currentUser = useCurrentUser()
const { open: openLogin } = useLoginDialog()

const displayLabel = computed(() => currentUser.value?.displayName || currentUser.value?.email || '')
const initial = computed(() => displayLabel.value.slice(0, 1).toUpperCase())
</script>

<template>
  <NuxtLink
    v-if="currentUser"
    to="/profile"
    class="user-menu-button__trigger"
    :class="{ 'user-menu-button__trigger--named': showName }"
  >
    <!-- 一律傳 initial 當 fallback：有沒有顯示由 el-avatar 自己決定（沒有 src、或圖片載入失敗時） -->
    <el-avatar :size="32" :src="currentUser.photoURL ?? undefined" class="user-menu-button__avatar" title="個人資料設定">
      {{ initial }}
    </el-avatar>
    <span v-if="showName" class="user-menu-button__name">{{ displayLabel }}</span>
  </NuxtLink>
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

/* 帶文字的「登入」要和旁邊的外觀設定按鈕同高（2026-09-20 反映兩顆高度不一） */
.user-menu-button__action {
  min-height: 44px;
}
</style>
