<script setup lang="ts">
import { SwitchButton, User } from '@element-plus/icons-vue'

// Icon-only everywhere by default (header, mobile bar) — the sidebar footer has room for
// the actual name, so it opts in via this prop.
withDefaults(defineProps<{ showName?: boolean }>(), { showName: false })

const currentUser = useCurrentUser()
const compatAuth = useFirebaseCompatAuth()
const { open: openLogin } = useLoginDialog()

const displayLabel = computed(() => currentUser.value?.displayName || currentUser.value?.email || '')
const initial = computed(() => displayLabel.value.slice(0, 1).toUpperCase())

async function handleSignOut() {
  await compatAuth.signOut()
}
</script>

<template>
  <template v-if="currentUser">
    <el-popover placement="top-end" width="220" trigger="click">
      <template #reference>
        <div class="user-menu-button__trigger" :class="{ 'user-menu-button__trigger--named': showName }">
          <!-- Always pass `initial` as the fallback slot — el-avatar itself decides
               whether to show it (no src, or the <img> actually fails to load, e.g.
               Google's photoURL 403ing under some referrer/CSP setups). Hard-coding this
               slot to '' whenever photoURL was merely present left a blank circle on any
               load failure, since el-avatar had already switched to the fallback slot. -->
          <el-avatar :size="32" :src="currentUser.photoURL ?? undefined" class="user-menu-button__avatar" title="個人資料設定">
            {{ initial }}
          </el-avatar>
          <span v-if="showName" class="user-menu-button__name">{{ displayLabel }}</span>
        </div>
      </template>
      <div class="user-menu-panel">
        <p class="user-menu-panel__name">{{ displayLabel }}</p>
        <el-button :icon="SwitchButton" class="user-menu-panel__signout" @click="handleSignOut">登出</el-button>
      </div>
    </el-popover>
  </template>

  <el-button v-else :icon="User" :circle="!showName" title="登入" @click="openLogin">
    <span v-if="showName">登入</span>
  </el-button>
</template>

<style scoped>
.user-menu-button__trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.user-menu-button__trigger--named {
  width: 100%;
}

.user-menu-button__avatar {
  cursor: pointer;
  background: var(--el-color-primary);
  flex-shrink: 0;
}

.user-menu-button__name {
  font-size: 14px;
  color: var(--el-text-color-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-menu-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.user-menu-panel__name {
  margin: 0;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  word-break: break-all;
}

.user-menu-panel__signout {
  width: 100%;
}
</style>
