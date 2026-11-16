<script setup lang="ts">
// 帳號這一區 2026-11-16 搬到 /account（使用者：「帳號相關URL還要叫做profile嗎? 因為我想這邊會有sidebar，sidebar其中一樣就會是電子報管理」→「好」；
// /profile 在個股頁另有意思：/stock/{code}/profile 是公司基本資料）。舊網址轉過去，查詢字串照帶（LINE 的 openExternalBrowser）；
// 站內換頁時 #plan 直接到方案與用量，伺服器轉址看不到 #，由 /account 接手（account/index.vue）
definePageMeta({ redirect: to => (to.hash === '#plan' ? '/account/plan' : { path: '/account', query: to.query, hash: to.hash }) })
</script>

<template>
  <div />
</template>
