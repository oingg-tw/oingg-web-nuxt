<script setup lang="ts">
// Structural-only placeholder for StockProfileCard.vue — no real company-profile endpoint
// exists yet (its own assumed contract turned out to be entirely wrong; see
// project_stock_chart_lookback_window_research memory / the bff-ts thread). Mirrors the real
// card's section/field layout exactly (same section titles, same field labels — those are
// generic structural labels, not any specific company's data) so the shell shows the actual
// shape of the eventual card; only the VALUES are skeleton blocks, per the same "只做版面結構，
// 不放任何數字" direction as StockChartShell.vue.
const SECTIONS: { title: string; fields: string[] }[] = [
  { title: '公司資訊', fields: ['公司名稱', '簡稱', '英文簡稱', '產業別', '統一編號', '成立日期', '上市日期', '外國企業註冊地'] },
  { title: '經營團隊', fields: ['董事長', '總經理', '發言人', '代理發言人'] },
  { title: '聯絡資訊', fields: ['地址', '英文地址', '電話', '傳真', 'Email', '網站'] },
  { title: '股務資訊', fields: ['財報類別', '面額', '實收資本額', '已發行股數', '私募股數', '特別股股數', '股務代理機構', '股務代理電話', '股務代理地址'] },
  { title: '簽證會計師', fields: ['簽證會計師事務所', '簽證會計師'] }
]
</script>

<template>
  <el-card class="profile-shell" shadow="never">
    <template #header>
      <span class="profile-shell__title">公司詳細資料</span>
    </template>

    <div v-for="section in SECTIONS" :key="section.title" class="profile-shell__section">
      <p class="profile-shell__section-title">{{ section.title }}</p>
      <div class="profile-shell__grid">
        <div v-for="label in section.fields" :key="label" class="profile-shell__field">
          <span class="profile-shell__label">{{ label }}</span>
          <span class="profile-shell__value" />
        </div>
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

.profile-shell__section + .profile-shell__section {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.profile-shell__section-title {
  margin: 0 0 12px;
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-placeholder);
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

.profile-shell__label {
  font-size: 12px;
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
