<script setup lang="ts">
import { InfoFilled } from '@element-plus/icons-vue'
// 特別股篩選（2026-10-15 三組篩選重新設計）：整頁交給 ScreenerPageShell，跟普通股、ETF 同一份畫面；這一頁只給特別股的資料來源。
// 原本的三個固定分頁（全部／非累積型／累積型）變成「股息累積性」條件，手寫的表格與 SortableJS 表頭拖曳換成共用的結果表。
const requestUrl = useRequestURL()
useSeoMeta({
  title: '特別股篩選：股息率、YTW 與契約條件',
  description: '比較上市櫃特別股的票面利率、殖利率、最差殖利率（YTW）、溢價率，以及累積、參加、可轉換、可收回等條件；可存成自己的篩選與欄位組合。'
})
useHead({ link: [{ rel: 'canonical', href: `${requestUrl.origin}${SCREENER_PATHS.preferred}` }] })

const screener = reactive(useUniverseScreener(usePreferredSource()))
</script>

<template>
  <ScreenerPageShell universe="preferred" :screener="screener">
    <template #title-extra>
      <el-tooltip content="閱讀特別股入門文章" placement="bottom" :trigger="['hover', 'focus']" :popper-style="{ maxWidth: '280px' }">
        <NuxtLink to="/blog/what-is-preferred-stock" target="_blank" rel="noopener" class="preferred-screener__intro-link" aria-label="閱讀特別股入門文章（另開新分頁）">
          <el-icon><InfoFilled /></el-icon>
        </NuxtLink>
      </el-tooltip>
    </template>
  </ScreenerPageShell>
</template>

<style scoped>
/* 圖示連結至少 24px（WCAG 2.5.8，2026-10-08 check-a11y-pages 量到原本只有 16px） */
.preferred-screener__intro-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  min-height: 24px;
  font-size: 1rem;
  color: var(--el-text-color-secondary);
}

.preferred-screener__intro-link:hover,
.preferred-screener__intro-link:focus-visible {
  color: var(--el-color-primary);
}
</style>
