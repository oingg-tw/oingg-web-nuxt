<script setup lang="ts">
import { Icon } from '@iconify/vue'

// @element-plus/icons-vue's own set has nothing that reads as "a certificate/preferential
// claim" without colliding with an icon already used elsewhere in the nav (Medal/GoldMedal both
// tried and rejected — see app-features.ts's own comment history for 特別股專區's icon). Per
// direct request ("真的找不到可以安裝套件，我們選擇多一些"), pulled in @iconify/vue instead of
// picking a third mediocre fit from the same small built-in set — it exposes Iconify's full
// catalog (Material Design Icons, Tabler, Phosphor, etc, tens of thousands of icons) via one
// runtime `<Icon icon="set:name" />` component, no bundler plugin needed for this scale of
// usage. Wrapped in its own component (same pattern as IconHexagon.vue, a plain custom SVG) so
// every OTHER call site (AppPinnedSidebar.vue/AppFeatureMenu.vue) keeps using
// `<component :is="feature.icon" />` unchanged — no branching needed between "an Element Plus
// icon component" and "an Iconify icon name string" at the render site.
</script>

<template>
  <Icon icon="mdi:certificate-outline" />
</template>
