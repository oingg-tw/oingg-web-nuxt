<script setup lang="ts">
// New component 2026-09-16 per direct request ("整個StockSearchBar全部樣式都拆掉。或是另外開一個
// 檔案真的叫做Menu，我們從頭做") — pulled the 網站導覽／個股 el-menu OUT of StockSearchBar.vue
// into its own file, built with zero custom styling: plain <el-menu>, no :deep() overrides, no
// CSS custom property tweaks, Element Plus's own default appearance as-is.
const route = useRoute()
</script>

<template>
  <el-menu mode="horizontal" router :default-active="route.path" :ellipsis="false">
    <el-menu-item index="/sitemap">網站導覽</el-menu-item>
    <el-menu-item index="/stock/2330">個股</el-menu-item>
  </el-menu>
</template>
