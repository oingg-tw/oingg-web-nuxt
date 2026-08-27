<script setup lang="ts">
import { SwitchButton, User } from '@element-plus/icons-vue'

// Icon-only everywhere by default (header, mobile bar) — the sidebar footer has room for
// the actual name, so it opts in via this prop.
withDefaults(defineProps<{ showName?: boolean }>(), { showName: false })

const currentUser = useCurrentUser()
const compatAuth = useFirebaseCompatAuth()

const loginDialogVisible = ref(false)
// firebaseui ships an `export =` .d.ts that doesn't line up with its ESM runtime export shape.
let authUI: { start: (selector: string, config: unknown) => void; reset: () => void } | null = null

const displayLabel = computed(() => currentUser.value?.displayName || currentUser.value?.email || '')
const initial = computed(() => displayLabel.value.slice(0, 1).toUpperCase())

async function openLogin() {
  loginDialogVisible.value = true
  await nextTick()

  const [{ auth: firebaseuiAuth }] = await Promise.all([
    import('firebaseui'),
    // @ts-expect-error -- CSS-only import, no type declarations
    import('firebaseui/dist/firebaseui.css')
  ])

  authUI = firebaseuiAuth.AuthUI.getInstance() ?? new firebaseuiAuth.AuthUI(compatAuth)
  authUI.start('#firebaseui-auth-container', {
    signInOptions: ['google.com', 'password'],
    signInFlow: 'popup',
    credentialHelper: 'none',
    callbacks: {
      signInSuccessWithAuthResult: () => {
        loginDialogVisible.value = false
        return false
      }
    }
  })
}

function closeLogin() {
  loginDialogVisible.value = false
  authUI?.reset()
}

async function handleSignOut() {
  await compatAuth.signOut()
}
</script>

<template>
  <template v-if="currentUser">
    <el-popover placement="top-end" width="220" trigger="click">
      <template #reference>
        <div class="user-menu-button__trigger" :class="{ 'user-menu-button__trigger--named': showName }">
          <el-avatar :size="32" :src="currentUser.photoURL ?? undefined" class="user-menu-button__avatar" title="個人資料設定">
            {{ currentUser.photoURL ? '' : initial }}
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

  <!-- el-dialog teleports to <body> and renders (closed) regardless of login state, so it
       always mounts during SSR too. Vue's SSR renderer buffers teleported content into a
       pass that runs after the rest of the tree, while the client mounts it in normal
       document order — that shifts the shared useId() counter differently on each side and
       can desync id-based siblings that come later (e.g. StockSearchBar's autocomplete, or
       another instance of this same component further down the page). Login only ever
       happens after a click, well after hydration, so deferring this to client-only is free. -->
  <ClientOnly>
    <el-dialog v-model="loginDialogVisible" title="登入" width="360" @close="closeLogin">
      <div id="firebaseui-auth-container" />
    </el-dialog>
  </ClientOnly>
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
