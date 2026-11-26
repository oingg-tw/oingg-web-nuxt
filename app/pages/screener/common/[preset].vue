<script setup lang="ts">
// 條件說明頁 2026-11-26 收進選股策略頁（使用者：「篩選個別頁面 似乎資訊量也沒有大到值得自己一頁」→「蓋成方案C」）：舊網址 301 到那一組的段落。
// 不認得的代稱照舊 404
const slug = String(useRoute().params.preset)
if (!screenerTemplateNameBySlug(slug)) throw createError({ statusCode: 404, statusMessage: '找不到這組篩選條件', fatal: true })
await navigateTo(`${STRATEGIES_PATH}#${slug}`, { redirectCode: 301 })
</script>

<template>
  <div />
</template>
