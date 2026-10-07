<script setup lang="ts">
// StockProfileCard 的結構骨架——profile 404（沒有公司資料）或離線時顯示。欄位標籤跟真卡片一樣（通用結構標籤，不是任何公司
// 的資料），只有值是骨架方塊（「只做版面結構，不放任何數字」）。2026-09-02 跟著真卡片從 27 欄 5 區精簡成 9 欄一列。
const FIELDS: string[] = ['產業別', '成立日期', '上市日期', '外國企業註冊地', '實收資本額', '已發行股數', '私募股數', '特別股股數', '簽證會計師事務所']
</script>

<template>
  <el-card class="profile-shell" shadow="never">
    <template #header>
      <StockCardTitle title="公司基本資訊" level="h2" />
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
  font-size: 1rem;
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
  font-size: 1rem;
  color: var(--el-text-color-placeholder);
  text-align: center;
}
</style>
