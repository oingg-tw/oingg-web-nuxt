<script setup lang="ts">
// 產業索引先隱藏（2026-11-09，使用者：「產業索引隱藏。把產業殖利率當作產業索引預設畫面，URL不變化」）：/industries 直接畫殖利率分析，
// 網址不導走。標準網址照那一頁（/industries/dividend），兩個網址不算兩份內容。原本的產業索引在 overview.vue
import IndustriesDividend from './dividend.vue'
</script>

<template>
  <IndustriesDividend />
</template>
