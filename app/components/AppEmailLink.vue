<script setup lang="ts">
// 首頁的聯絡管道（退休族群設計要點的「容易聯絡」）；結構同 AppGithubLink。不是品牌標誌，所以用 Element Plus 的 Message
// 圖示而不是手畫 SVG。mailto: 不是頁面導覽，不用 target="_blank"。
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

/* 點擊區擴到 48×48（觸控熱區），不放大可見的 32px 盒子——同 AppGithubLink。 */
.app-email-link::before {
  content: '';
  position: absolute;
  inset: -8px;
}
</style>
