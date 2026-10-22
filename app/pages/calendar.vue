<script setup lang="ts">
// 配息月曆與除權息月覽的父路由（2026-10-22，使用者：「為什麼選 calendar/months app-header-menu 的選定樣式就沒了」→「靠 NuxtLink 是對的」）。
// 兩頁原本是互不相干的兩條路由，NuxtLink 不知道 /calendar/months 屬於 /calendar；共用這個父路由之後，連到 /calendar 的連結在月覽也會帶
// router-link-active（頁首、手機圖示格的選定樣式認它），aria-current 照舊只標完全相同的那一頁（側欄）
</script>

<template>
  <NuxtPage />
</template>
