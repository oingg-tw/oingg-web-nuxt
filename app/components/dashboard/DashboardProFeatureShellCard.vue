<script setup lang="ts">
// Generic structural placeholder for 專家模式-only dashboard cards — none of these (SWR
// guardrails, Monte Carlo simulation, VaR) have a calc engine or backing data yet (see
// project_dashboard_novice_pro_modes memory: these are net-new calc engines, not quick
// wires-up of an existing endpoint). Per this app's "no fabricated data" rule, shows only
// the card shape (title + empty state), no invented numbers/charts.
defineProps<{ title: string }>()
</script>

<template>
  <el-card class="pro-feature-shell" shadow="never">
    <template #header>
      <span class="pro-feature-shell__title">{{ title }}</span>
    </template>
    <el-empty description="功能開發中，敬請期待" :image-size="60" />
  </el-card>
</template>

<style scoped>
.pro-feature-shell {
  border-radius: 12px;
}

.pro-feature-shell__title {
  font-weight: 600;
}
</style>
