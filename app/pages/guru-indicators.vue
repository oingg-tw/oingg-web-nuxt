<script setup lang="ts">
// Placeholder page — 大師指標：讓用戶自己組合常見大師（葛拉漢、巴菲特、彼得林區等）常用的財務
// 指標，畫成一張六角雷達圖，呈現這組指標涵蓋了哪些分析面向（估值/成長/獲利能力/現金品質/財務
// 韌性/營運效率）。此頁曾實作出完整的角色選擇＋可編輯雷達圖 UI，但先整個收回、暫時只留這個
// shell（2026-09-03，per user request）——見 project_guru_zone_radar_chart_idea 記憶保留的完整
// 設計與合規歷史，之後重做時直接參考，不必重新設計一次。
</script>

<template>
  <div class="guru-indicators-page">
    <h1 class="guru-indicators-page__title">
      <el-icon class="guru-indicators-page__icon"><SharedIconHexagon /></el-icon>
      大師指標
    </h1>
    <p class="guru-indicators-page__subtitle">
      選一位大師，看看他常用的指標框架涵蓋哪些分析面向——不是任何一檔股票的評分或建議
    </p>
    <el-empty description="功能開發中，敬請期待" />
  </div>
</template>

<style scoped>
.guru-indicators-page {
  width: 100%;
}

.guru-indicators-page__title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 20px;
  font-weight: 600;
  margin: 0 0 16px;
}

.guru-indicators-page__icon {
  color: var(--el-color-primary);
}

.guru-indicators-page__subtitle {
  font-size: 16px;
  color: var(--el-text-color-secondary);
  margin: -8px 0 16px;
}
</style>
