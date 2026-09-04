<script setup lang="ts">
// Landing page's own trust-signal contact channel (see docs/compass_artifact_.../吸引退休族群的
// 網站首頁設計要點.md's "容易聯絡" credibility criterion) — mirrors AppGithubLink.vue/
// AppLineLink.vue's structure. Not a brand mark, so uses Element Plus's own Message icon
// instead of a hand-rolled SVG. mailto: needs no target="_blank" — it isn't a page navigation.
import { Message } from '@element-plus/icons-vue'
</script>

<template>
  <a
    href="mailto:ian.chu@oingg.com"
    class="app-email-link"
    aria-label="Email 聯絡我們"
    title="Email"
  >
    <el-icon :size="20"><Message /></el-icon>
  </a>
</template>

<style scoped>
.app-email-link {
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

.app-email-link:hover {
  color: var(--el-text-color-primary);
  background: var(--el-fill-color-light);
}

/* Expands the click/touch area to 44x44 without resizing the visible 32px box — same fix as
   AppGithubLink.vue/AppLineLink.vue. */
.app-email-link::before {
  content: '';
  position: absolute;
  inset: -6px;
}
</style>
