<script setup lang="ts">
import { MACRO_NAV_ITEMS } from '~/utils/macro-nav'

// 總經特區的導覽。版面與兩份 DOM 的理由都在 SectionNav.vue（2026-10-05 一般化出去，持股管理共用）。
</script>

<template>
  <SectionNav label="總經特區" :items="MACRO_NAV_ITEMS" />
</template>
