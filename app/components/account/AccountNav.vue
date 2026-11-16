<script setup lang="ts">
// 帳號這一區的側欄（2026-11-16，使用者：「帳號相關URL還要叫做profile嗎? 因為我想這邊會有sidebar，sidebar其中一樣就會是電子報管理」→「好」）。
// 版面與兩份 DOM 的理由在 SharedSectionNav.vue。站內信（同一天）有未讀時名稱後面寫幾則
const unseen = useInboxUnseen()
const items = computed(() => [
  { label: '帳號與登入', to: '/account' },
  { label: '方案與用量', to: '/account/plan' },
  { label: '電子報', to: '/account/newsletter' },
  { label: unseen.value ? `站內信（${unseenText(unseen.value)} 則未讀）` : '站內信', to: '/account/notices' }
])
</script>

<template>
  <SharedSectionNav label="帳號" :items="items" />
</template>
