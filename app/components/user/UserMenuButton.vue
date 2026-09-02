<script setup lang="ts">
import { User } from '@element-plus/icons-vue'

// Icon-only everywhere by default (header, mobile bar) — the sidebar footer has room for
// the actual name, so it opts in via this prop. linkToProfile swaps the popover (desktop
// sidebar's own small menu, unchanged) for a plain navigation to the full /profile page
// instead — the mobile feature-menu footer wants that since a popover stacked on top of the
// fullscreen menu dialog it already lives in is exactly the "彈窗疊彈窗" pattern this app
// avoids elsewhere.
const props = withDefaults(defineProps<{ showName?: boolean; linkToProfile?: boolean }>(), {
  showName: false,
  linkToProfile: false
})

const currentUser = useCurrentUser()
const compatAuth = useFirebaseCompatAuth()
const { open: openLogin } = useLoginDialog()

const displayLabel = computed(() => currentUser.value?.displayName || currentUser.value?.email || '')
const initial = computed(() => displayLabel.value.slice(0, 1).toUpperCase())

async function handleSignOut() {
  await compatAuth.signOut()
}

// The popover's own trigger="click" only closes it on an outside click — this component
// stays mounted across a route change (it lives in the sidebar/header, not page content), so
// without this, clicking through to /profile left the popover sitting open on top of the
// profile page it just navigated to.
const menuVisible = ref(false)

function closeMenu() {
  menuVisible.value = false
}
</script>

<template>
  <NuxtLink
    v-if="currentUser && props.linkToProfile"
    to="/profile"
    class="user-menu-button__trigger"
    :class="{ 'user-menu-button__trigger--named': showName }"
  >
    <el-avatar :size="32" :src="currentUser.photoURL ?? undefined" class="user-menu-button__avatar" title="個人資料設定">
      {{ initial }}
    </el-avatar>
    <span v-if="showName" class="user-menu-button__name">{{ displayLabel }}</span>
  </NuxtLink>

  <el-popover v-else-if="currentUser" v-model:visible="menuVisible" placement="top-end" width="220" trigger="click">
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
      <UserThemeSettings />

      <NuxtLink to="/profile"><el-button class="user-menu-panel__profile" @click="closeMenu">個人資料設定</el-button></NuxtLink>
    </div>
  </el-popover>

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

/* 16px per docs/accessibility-guidelines.md §1.1 — site-wide floor, no exceptions. Was 14px. */
.user-menu-button__name {
  font-size: 16px;
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

.user-menu-panel__profile {
  width: 100%;
}
</style>
