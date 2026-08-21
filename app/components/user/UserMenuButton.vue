<script setup lang="ts">
import { SwitchButton, User } from '@element-plus/icons-vue'

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
        <el-avatar :size="32" :src="currentUser.photoURL ?? undefined" class="user-menu-button__avatar" title="個人資料設定">
          {{ currentUser.photoURL ? '' : initial }}
        </el-avatar>
      </template>
      <div class="user-menu-panel">
        <p class="user-menu-panel__name">{{ displayLabel }}</p>
        <el-button :icon="SwitchButton" class="user-menu-panel__signout" @click="handleSignOut">登出</el-button>
      </div>
    </el-popover>
  </template>

  <el-button v-else :icon="User" circle title="登入" @click="openLogin" />

  <el-dialog v-model="loginDialogVisible" title="登入" width="360" @close="closeLogin">
    <div id="firebaseui-auth-container" />
  </el-dialog>
</template>

<style scoped>
.user-menu-button__avatar {
  cursor: pointer;
  background: var(--el-color-primary);
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
