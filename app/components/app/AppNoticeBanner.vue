<script setup lang="ts">
// 全站橫幅（2026-11-16 站內信，使用者：「站內信按照建議實作」；設計 https://claude.ai/artifact/EG27Jgn2v1TYyWvymRztqX 的 4、5）：管理站發更新紀錄時
// 選「全站橫幅」的那一則（維護、緊急狀況），每一頁內容最上面，訪客也看得到。伺服器畫頁面時就放進去，不會載入後才把頁面往下推；
// 關掉記在 cookie，伺服器下次就不畫。從 publishedAt 掛到 bannerEndsAt，一次只掛最新的一則（activeBanner）。更新紀錄頁 2026-11-25
// 拿掉後沒有「看詳情」，每一項變更都寫在橫幅上。讀不到更新紀錄就不掛，不擋頁面。不寄 email（使用者：「不佔用戶email這種私人空間」）
import { Close, InfoFilled } from '@element-plus/icons-vue'

const { data } = await useFetch<{ entries: ReleaseNote[] }>('/api/cached/release-notes', { key: 'release-notes' })
const dismissed = useCookie<string[]>('notice-banner-dismissed', { default: () => [], maxAge: 60 * 60 * 24 * 180, sameSite: 'lax' })
const banner = computed(() => activeBanner(data.value?.entries ?? [], Date.now(), dismissed.value))

function dismiss() {
  if (banner.value) dismissed.value = [...dismissed.value, banner.value.id].slice(-20)
}
</script>

<template>
  <section v-if="banner" class="app-card notice-banner" aria-label="公告">
    <el-icon class="notice-banner__icon" aria-hidden="true"><InfoFilled /></el-icon>
    <p class="notice-banner__text">
      <strong>{{ banner.title }}</strong><template v-if="banner.changes.length">：{{ banner.changes.map(change => change.text).join('；') }}</template>
    </p>
    <button type="button" class="notice-banner__close" aria-label="關閉這則公告" @click="dismiss">
      <el-icon aria-hidden="true"><Close /></el-icon>
    </button>
  </section>
</template>

<style scoped>
/* 一張卡片（.app-card），框色與底色換成提醒色：橫幅要跟一般內容分得開（全站健康橫幅同一組顏色，字在兩種模式都過 4.5:1） */
.notice-banner {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 12px;
  margin-bottom: 16px;
  padding: 4px 4px 4px 16px;
  border-color: var(--el-color-warning);
  background: var(--el-color-warning-light-9);
}

.notice-banner__icon {
  flex: none;
  font-size: 1.25rem;
  color: var(--el-color-warning);
}

.notice-banner__text {
  flex: 1 1 16rem;
  margin: 0;
  padding: 8px 0;
  color: var(--el-text-color-primary);
}

.notice-banner__close {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  padding: 0;
  border: 0;
  border-radius: var(--el-border-radius-base);
  background: transparent;
  color: var(--el-text-color-regular);
  font-size: 1.125rem;
  cursor: pointer;
}

.notice-banner__close:hover,
.notice-banner__close:focus-visible {
  background: var(--el-fill-color);
}
</style>
