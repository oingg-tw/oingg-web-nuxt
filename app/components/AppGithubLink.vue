<script setup lang="ts">
// AppHeaderMenu 與 layouts/landing.vue 共用的 GitHub 連結——第二個使用處出現時抽出來，SVG path 只放一份。
</script>

<template>
  <a
    href="https://github.com/oingg-tw"
    target="_blank"
    rel="noopener noreferrer"
    class="app-github-link"
    aria-label="GitHub（另開新視窗）"
    title="GitHub（另開新視窗）"
  >
    <svg viewBox="0 0 16 16" width="20" height="20" fill="currentColor" aria-hidden="true">
      <path
        fill-rule="evenodd"
        d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"
      />
    </svg>
  </a>
</template>

<style scoped>
.app-github-link {
  position: relative;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 6px;
  color: var(--el-text-color-secondary);
}

/* 點擊區擴到 48×48（觸控熱區）但不放大可見的 32px 盒子：AppHeaderMenu 量自己的高度時讀的是元素實際盒子，
   用絕對定位的透明覆蓋層擴大熱區才不會影響那個量測。 */
.app-github-link::before {
  content: '';
  position: absolute;
  inset: -8px;
}

.app-github-link:hover {
  color: var(--el-text-color-primary);
  background: var(--el-fill-color-light);
}
</style>
