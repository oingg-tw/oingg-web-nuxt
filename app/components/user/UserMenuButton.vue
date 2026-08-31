<script setup lang="ts">
import { Moon, Sunny, User } from '@element-plus/icons-vue'
import type { ThemeColor } from '~/composables/useAppTheme'

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
const { color, market, resolvedMode, setMode, setColor, setMarket } = useAppTheme()

const displayLabel = computed(() => currentUser.value?.displayName || currentUser.value?.email || '')
const initial = computed(() => displayLabel.value.slice(0, 1).toUpperCase())

// Swatch preview colors only — decorative, not the actual styling source (that's
// main.css's own html.dark[data-theme-color='...'] blocks). Only the keys with a real CSS
// block go here — GREEN/PURPLE/ORANGE/RED/TEAL exist in ThemeColor (the backend's enum
// already includes them) but aren't offered as a choice yet, since picking one today would
// just silently fall back to Element Plus's unthemed default rather than a real color. Add
// a new theme color by adding both: a real CSS block there, and its preview swatch + label
// here, together.
const THEME_COLOR_OPTIONS: { key: ThemeColor; label: string; swatch: string }[] = [
  { key: 'GOLD', label: '金色', swatch: '#d6b351' },
  { key: 'BLUE', label: '藍色', swatch: '#7eb6e8' }
]

async function handleSignOut() {
  await compatAuth.signOut()
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

  <el-popover v-else-if="currentUser" placement="top-end" width="220" trigger="click">
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
      <div class="user-menu-panel__theme-row">
        <span class="user-menu-panel__theme-label">外觀模式</span>
        <el-switch
          :model-value="resolvedMode === 'DARK'"
          inline-prompt
          size="large"
          :active-icon="Moon"
          :inactive-icon="Sunny"
          @update:model-value="value => setMode(value ? 'DARK' : 'LIGHT')"
        />
      </div>

      <div class="user-menu-panel__theme-row">
        <span class="user-menu-panel__theme-label">主題色</span>
        <div class="user-menu-panel__swatches">
          <button
            v-for="option in THEME_COLOR_OPTIONS"
            :key="option.key"
            type="button"
            class="user-menu-panel__swatch"
            :class="{ 'is-active': color === option.key }"
            :style="{ background: option.swatch }"
            :title="option.label"
            :aria-label="`切換主題色為${option.label}`"
            @click="setColor(option.key)"
          />
        </div>
      </div>

      <div class="user-menu-panel__theme-row">
        <span class="user-menu-panel__theme-label">漲跌顏色</span>
        <el-switch
          :model-value="market === 'WESTERN'"
          inline-prompt
          size="large"
          active-text="歐美"
          inactive-text="亞洲"
          @update:model-value="value => setMarket(value ? 'WESTERN' : 'ASIA')"
        />
      </div>

      <NuxtLink to="/profile"><el-button class="user-menu-panel__signout">個人資料設定</el-button></NuxtLink>
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

.user-menu-panel__theme-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

/* Element Plus hardcodes its inline-prompt label/icon at 12px regardless of the `size`
   prop (theme-chalk's .el-switch__inner-wrapper rule, not driven by the size map the way
   every other switch dimension is) — confirmed live at a measured 12px. That's below even
   this project's accepted 14px dense-control floor (see docs/accessibility-guidelines.md
   §1.1), so it needs its own override; size="large" above only handles the touch-target
   (core height 20px → 24px, the WCAG 2.5.8 floor), not this. */
.user-menu-panel__theme-row :deep(.el-switch__inner-wrapper) {
  font-size: 14px;
}

.user-menu-panel__theme-label {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.user-menu-panel__swatches {
  display: flex;
  gap: 6px;
}

/* Only one option exists today (see THEME_COLOR_OPTIONS) — sized as a compact secondary
   control (not the project's 44px primary-action floor) since this is a settings toggle
   inside an already-small popover, not a main action; still comfortably clears WCAG's
   24px minimum hit area. */
.user-menu-panel__swatch {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 2px solid transparent;
  padding: 0;
  cursor: pointer;
}

.user-menu-panel__swatch.is-active {
  border-color: var(--el-text-color-primary);
}

.user-menu-panel__signout {
  width: 100%;
}
</style>
