<script setup lang="ts">
// User for 登入/個人資料設定, Setting for 外觀設定 — real bug fixed 2026-09-14 (reported live:
// "另外兩者icon過於接近要調整", once both buttons sat side by side in the sidebar footer) — both
// used to share the same User icon, reading as visually identical actions at a glance despite
// doing completely different things. First fix swapped 登入 to Key, but that read wrong once
// 登入 sat next to the signed-in 個人資料設定 trigger elsewhere (same User icon, different label,
// for the exact same action) — reverted 登入 back to User the same day per direct follow-up
// ("登入icon回來，要換的是外觀設定") and gave 外觀設定 its own Setting (gear) icon instead, which
// reads correctly as "settings" regardless of which other User-icon button it sits beside.
import { Setting, User } from '@element-plus/icons-vue'

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

function handleGuestLogin() {
  closeMenu()
  openLogin()
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

  <!-- right-end (not top-end): the only popover instance of this component is
       AppPinnedSidebar's footer trigger, pinned to the viewport's bottom-left inside a
       240px-wide column with the nav list stacked directly above it — top-end kept the
       220px-wide panel inside that same column, sitting right on top of the last nav
       items while open. right-end opens it into the main content area to the right
       instead (bottom-edge-aligned to the trigger, so it grows up-and-right from there),
       clearing the nav list entirely. -->
  <el-popover v-else-if="currentUser" v-model:visible="menuVisible" placement="right-end" width="220" trigger="click">
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
      <!-- Changed from an embedded UserThemeSettings widget to a plain link 2026-09-16 per
           direct request ("外觀設定就不再彈窗，而是造訪 appearance") — same change applied to
           the guest branch's own dedicated 外觀設定 button further down, for the same reason:
           settings live on a real page now (/appearance, built the same day), not expanded
           in-place inside a small popover panel. -->
      <!-- custom + v-slot 2026-09-17 (Tab-order review, same fix as AppHeaderMenu.vue's own
           外觀設定 button) — a plain <NuxtLink> wrapping <el-button> renders two focusable nodes
           for one visual control; `custom` renders no <a>, `navigate` fires the same route push
           from the button's own click instead. -->
      <NuxtLink to="/appearance" custom v-slot="{ navigate }">
        <el-button :icon="Setting" class="user-menu-panel__profile" @click="(e: MouseEvent) => { closeMenu(); navigate(e) }">外觀設定</el-button>
      </NuxtLink>
      <NuxtLink to="/profile" custom v-slot="{ navigate }">
        <el-button class="user-menu-panel__profile" @click="(e: MouseEvent) => { closeMenu(); navigate(e) }">個人資料設定</el-button>
      </NuxtLink>
    </div>
  </el-popover>

  <!-- Guest theme-settings entry point added 2026-09-14 (real bug reported live: "要讓匿名用戶
       在沒登入的狀況下就可以變顏色") — ThemeSettings.vue itself never gated on currentUser
       (useAppTheme.ts's own setMode/setColor/setMarket apply locally first regardless of sign-in
       state, only additionally syncing to the account when one exists), but this component's own
       guest branch used to skip straight to a plain 登入 button with no popover at all — the
       settings were reachable in theory, unreachable in practice.
       登入 moved OUT of the popover panel to its own standalone button 2026-09-14, per direct
       follow-up ("登入按鈕要移出彈窗，放到 外觀設定sidebar 按鈕下面") — it used to live inside
       UserThemeSettings' own panel (one extra click to reach); now it's a plain sibling button
       rendered right after the 外觀設定 trigger, always visible, no popover needed to find it.
       外觀設定 itself changed from an el-popover trigger to a plain NuxtLink 2026-09-16 per
       direct request ("外觀設定就不再彈窗，而是造訪 appearance") — same change applied to the
       signed-in branch's own account popover above, for the same reason: settings live on a
       real page now (/appearance, built the same day), not expanded in-place. Also drops the
       "彈窗疊彈窗" concern this used to have inside the mobile fullscreen-menu footer
       (linkToProfile) — moot now since there's no popover left to stack, but this button is
       still excluded there anyway: the mobile feature menu already has its own identical
       NuxtLink to /appearance (see AppFeatureMenu.vue), so this component doesn't need to
       duplicate it.
       Fragment root (this component already has multiple top-level elements, e.g. the
       currentUser branches above) — both render as direct children of whatever container the
       caller puts this component in; AppPinnedSidebar.vue stacks them in one column. -->
  <template v-else-if="!props.linkToProfile">
    <!-- custom + v-slot 2026-09-17 (Tab-order review, same fix as AppHeaderMenu.vue's own
         外觀設定 button) — a plain <NuxtLink> wrapping <el-button> renders two focusable nodes
         for one visual control. -->
    <NuxtLink to="/appearance" custom v-slot="{ navigate }">
      <!-- Real bug fixed 2026-09-17 (reported live: "登入按鈕裡面的icon看起來不在正中央") — el-button
           checks whether a default slot was PASSED AT ALL to decide whether to render its own
           internal wrapping `<span>` around it (and the `[class*=el-icon]+span{margin-left:4px}`
           gap that comes with it), not whether that slot's content is actually visible.
           `<span v-if="showName">...</span>` as a child still counts as "a slot was passed" even
           when showName is false and the v-if renders nothing — el-button still wraps it in its
           own empty `<span>`, and that phantom span's margin then pushes the icon off-center in
           icon-only (circle) mode specifically, where symmetric centering actually matters (a
           non-circle button just looks like it has a bit of empty padding, not obviously wrong).
           Splitting into two whole `v-if`/`v-else` buttons instead of one button with a
           conditionally-empty slot means the icon-only branch passes NO default slot at all,
           matching how every other plain icon-only `<el-button :icon="..." circle />` call site
           in this app is already written (e.g. AppHeaderMenu.vue's own 外觀設定 button right next
           to this one, which was never affected). -->
      <el-button v-if="showName" :icon="Setting" title="外觀設定" class="user-menu-button__action" @click="navigate">外觀設定</el-button>
      <el-button v-else :icon="Setting" circle title="外觀設定" @click="navigate" />
    </NuxtLink>
    <el-button v-if="showName" :icon="User" title="登入" class="user-menu-button__action" @click="openLogin">登入</el-button>
    <el-button v-else :icon="User" circle title="登入" @click="openLogin" />
  </template>

  <!-- template wrapper required here (not a bare v-if/v-else pair) — this needs to terminate the
       SAME v-if/else-if/else chain started at the top of this file (currentUser && linkToProfile
       / currentUser / !linkToProfile / ← this branch), and Vue's conditional chaining only
       connects ADJACENT v-if/else-if/else siblings; a bare v-if here without wrapping it as one
       `v-else` unit would start an unrelated second chain instead, rendering unconditionally
       regardless of the outer branches above. -->
  <template v-else>
    <el-button v-if="showName" :icon="User" title="登入" class="user-menu-button__action" @click="openLogin">登入</el-button>
    <el-button v-else :icon="User" circle title="登入" @click="openLogin" />
  </template>
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

/* 16px per docs/ui-ux/accessibility-guidelines.md §1.1 — site-wide floor, no exceptions. Was 14px. */
.user-menu-button__name {
  font-size: 1rem;
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

/* Real bug reported live 2026-09-20 ("右上角 外觀設定 與 登入 樣式似乎跑掉了") — these two
   icon+text buttons (外觀設定/登入, the showName=true variants only; the icon-only circle
   siblings are untouched) had no explicit sizing of their own, so they rendered at Element Plus's
   own small-size default (28px) while AppHeaderMenu.vue's own 外觀設定 button right next to this
   component already had an explicit 44px min-height (from an earlier fix that day) — the two sat
   side by side at visibly different heights. min-height only, no padding override, matching the
   same minimal pattern that already worked for AppHeaderMenu.vue's own button. */
.user-menu-button__action {
  min-height: 44px;
}
</style>
