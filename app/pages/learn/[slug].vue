<script setup lang="ts">
// /learn/{slug} 分派（2026-10-12 新手專區結構重做）：六組的組頁 → LearnGroupPage；主題與指標的教學 → LearnArticlePage。
// 解析順序 組 → 主題 → 指標；組名與主題名都不是型錄指標的 slug。
const route = useRoute()
const slug = String(route.params.slug)
const group = findLearnGroup(slug)
</script>

<template>
  <LearnGroupPage v-if="group" :group="group" />
  <LearnArticlePage v-else :slug="slug" />
</template>
