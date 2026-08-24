<script setup lang="ts">
import { Expand, Fold, Menu } from '@element-plus/icons-vue'

const visible = ref(false)
const collapsed = ref(false)

// Mobile: a bottom-docked sheet (thumb-reachable, sized to its content).
// Desktop: a left-hand sidebar. Only ever matters after a real click opens the drawer,
// so there's no SSR/hydration risk in reading the viewport directly here.
const isDesktop = ref(false)

if (import.meta.client) {
  const mql = window.matchMedia('(min-width: 768px)')
  isDesktop.value = mql.matches
  const update = (event: MediaQueryListEvent) => {
    isDesktop.value = event.matches
  }
  mql.addEventListener('change', update)
  onUnmounted(() => mql.removeEventListener('change', update))
}

const direction = computed(() => (isDesktop.value ? 'ltr' : 'btt'))
const size = computed(() => (isDesktop.value ? '280px' : 'auto'))

function close() {
  visible.value = false
}
</script>

<template>
  <el-button :icon="Menu" circle title="功能選單" @click="visible = true" />

  <el-drawer
    v-model="visible"
    :direction="direction"
    :size="size"
    :with-header="false"
    class="feature-menu-drawer"
  >
    <div class="feature-menu">
      <div class="feature-menu__header">
        <span class="feature-menu__title">功能選單</span>
        <el-button
          :icon="collapsed ? Expand : Fold"
          circle
          size="small"
          title="收合"
          @click="collapsed = !collapsed"
        />
      </div>

      <div class="feature-menu__grid" :class="{ 'feature-menu__grid--collapsed': collapsed }">
        <NuxtLink
          v-for="feature in APP_FEATURES"
          :key="feature.key"
          :to="feature.to"
          class="feature-menu__item"
          @click="close"
        >
          <el-icon class="feature-menu__icon"><component :is="feature.icon" /></el-icon>
          <span class="feature-menu__label">{{ feature.label }}</span>
        </NuxtLink>
      </div>
    </div>
  </el-drawer>
</template>

<style scoped>
.feature-menu {
  display: flex;
  flex-direction: column;
}

.feature-menu__header {
  display: none;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.feature-menu__title {
  font-weight: 600;
  font-size: 14px;
}

.feature-menu__grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-auto-rows: min-content;
  gap: 8px;
  max-height: 60vh;
  overflow-y: auto;
}

.feature-menu__item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 20px 8px;
  border-radius: 12px;
  color: var(--el-text-color-primary);
  text-decoration: none;
}

.feature-menu__item:hover {
  background: var(--el-fill-color-light);
}

.feature-menu__icon {
  font-size: 26px;
  color: var(--el-color-primary);
}

.feature-menu__label {
  font-size: 13px;
  text-align: center;
}

@media (min-width: 768px) {
  .feature-menu__header {
    display: flex;
  }

  .feature-menu__grid {
    grid-template-columns: 1fr;
    gap: 4px;
    max-height: none;
    overflow-y: visible;
  }

  .feature-menu__item {
    flex-direction: row;
    justify-content: flex-start;
    padding: 10px 12px;
  }

  .feature-menu__grid--collapsed .feature-menu__item {
    justify-content: center;
    padding: 10px 0;
  }

  .feature-menu__grid--collapsed .feature-menu__label {
    display: none;
  }
}

:deep(.feature-menu-drawer .el-drawer__body) {
  padding: 16px;
  padding-bottom: calc(16px + env(safe-area-inset-bottom));
}

:deep(.feature-menu-drawer.el-drawer.btt) {
  border-radius: 16px 16px 0 0;
}
</style>
