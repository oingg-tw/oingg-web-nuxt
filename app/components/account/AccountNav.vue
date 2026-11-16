<script setup lang="ts">
// 帳號這一區的側欄（2026-11-16，使用者：「帳號相關URL還要叫做profile嗎? 因為我想這邊會有sidebar，sidebar其中一樣就會是電子報管理」→「好」）。
// 版面與兩份 DOM 的理由在 SharedSectionNav.vue
const ITEMS = [
  { label: '帳號與登入', to: '/account' },
  { label: '方案與用量', to: '/account/plan' },
  { label: '電子報', to: '/account/newsletter' }
]
</script>

<template>
  <SharedSectionNav label="帳號" :items="ITEMS" />
</template>
