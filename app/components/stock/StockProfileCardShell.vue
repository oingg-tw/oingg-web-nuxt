<script setup lang="ts">
// Structural-only placeholder for StockProfileCard.vue — no real company-profile endpoint
// exists yet for symbols with no record (404), or while offline. Mirrors the real card's flat
// field list exactly (same labels — generic structural labels, not any specific company's
// data) so the shell shows the actual shape of the eventual card; only the VALUES are skeleton
// blocks, per the same "只做版面結構，不放任何數字" direction as StockChartShell.vue.
//
// Trimmed from 27 fields (5 sections) to 9 (one flat list) 2026-09-02 alongside
// StockProfileCard.vue's own trim — see that file's comment for the full first-principles
// reasoning on what got cut and why.
const FIELDS: string[] = ['產業別', '成立日期', '上市日期', '外國企業註冊地', '實收資本額', '已發行股數', '私募股數', '特別股股數', '簽證會計師事務所']
</script>

<template>
  <el-card class="profile-shell" shadow="never">
    <template #header>
      <span class="profile-shell__title">公司基本資訊</span>
    </template>

    <div class="profile-shell__grid">
      <div v-for="label in FIELDS" :key="label" class="profile-shell__field">
        <span class="profile-shell__label">{{ label }}</span>
        <span class="profile-shell__value" />
      </div>
    </div>

    <p class="profile-shell__note">資料尚未提供</p>
  </el-card>
</template>

<style scoped>
.profile-shell {
  border-radius: 12px;
}

.profile-shell__title {
  font-weight: 600;
}

.profile-shell__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px 16px;
}

.profile-shell__field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

/* 16px per docs/ui-ux/accessibility-guidelines.md §1.1 — was 12px pre-existing, fixed alongside the
   real card's own matching fix. */
.profile-shell__label {
  font-size: 16px;
  color: var(--el-text-color-secondary);
}

.profile-shell__value {
  height: 14px;
  width: 70%;
  border-radius: 4px;
  background: var(--el-fill-color);
}

.profile-shell__note {
  margin: 20px 0 0;
  font-size: 16px;
  color: var(--el-text-color-placeholder);
  text-align: center;
}
</style>
