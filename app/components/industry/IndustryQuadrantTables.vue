<script setup lang="ts">
// 散佈圖的手機版（2026-11-02，使用者選「要比很多項目的圖，手機改成清單」：散佈圖在手機上點擠成一團、名字標不出來）：四個象限各一張
// 小表，看得見的表名就是那一組。分組用 quadrantGroups（shared/utils/quadrants.ts）；列照頁面給的順序（產業頁照代號，不做排行）。
// 用的頁：/industries/dividend、/industries/growth、/industry/[sector]/dividend。
// collapsed：每組收成一列（全站的 app-disclosure），點開才是表——類股頁一個類股可到兩百多家，四張表攤開有七千多 px 長。
// 每一列一行，數字都在欄裡（2026-11-04，使用者看過設計圖選 D：列底下的「標籤＋數字」每列重複、數字沒有對齊，「看起來都亂亂的」）。
// 殖利率頁的最右欄原本用分段鈕換三個數字，2026-11-08 只留持股股利 5 年成長率（使用者：「3年拿掉，成本殖利率也拿掉，因為不夠直觀」），分段鈕跟著拿掉
export interface QuadrantTableRow { key: string; name: string; code?: string; to: string | null; cells: string[] }
export interface QuadrantTable { title: string; rows: QuadrantTableRow[] }

defineProps<{ groups: QuadrantTable[]; columns: readonly string[]; collapsed?: boolean }>()
</script>

<template>
  <div class="industry-quadrant-tables">
    <template v-for="group in groups" :key="group.title">
      <component :is="collapsed ? 'details' : 'div'" v-if="group.rows.length" :class="{ 'app-disclosure': collapsed }">
        <summary v-if="collapsed">{{ group.title }}</summary>
        <SharedTable :label="group.title" :caption-visible="!collapsed" table-class="industry-quadrant-table">
          <thead>
            <tr>
              <th v-for="(column, index) in columns" :key="column" scope="col" :class="{ 'seo-table__num': index > 0 }">{{ column }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in group.rows" :key="row.key">
              <th scope="row">
                <span class="industry-quadrant-tables__name">
                  <NuxtLink v-if="row.to" :to="row.to">{{ row.name }}</NuxtLink>
                  <template v-else>{{ row.name }}</template>
                  <span v-if="row.code" class="industry-quadrant-tables__code">{{ row.code }}</span>
                </span>
              </th>
              <td v-for="(cell, index) in row.cells" :key="index" class="seo-table__num">{{ cell }}</td>
            </tr>
          </tbody>
        </SharedTable>
      </component>
    </template>
  </div>
</template>

<style scoped>
.industry-quadrant-tables {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* 名稱與代號之間 8px；320 寬放不下時代號換到下一行，靠左對齊名稱 */
.industry-quadrant-tables__name {
  display: inline-flex;
  flex-wrap: wrap;
  column-gap: 8px;
}

.industry-quadrant-tables__code {
  font-weight: 400;
  color: var(--el-text-color-secondary);
}

/* 全站表格預設不換行、太寬就左右捲；這三欄要在 320px 寬放得下：數字欄貼著內容靠右、名稱欄吃掉其餘的寬，欄與欄的間距收成 16px（全站 24px）。
   只有名稱可以折（電腦及週邊設備業這種長的，320 寬才折） */
.industry-quadrant-tables :deep(.industry-quadrant-table tbody th) {
  white-space: normal;
}

.industry-quadrant-tables :deep(.industry-quadrant-table :is(th, td):not(:first-child)) {
  width: 1%;
  padding-left: 8px;
}

.industry-quadrant-tables :deep(.industry-quadrant-table :is(th, td):not(:last-child)) {
  padding-right: 8px;
}
</style>
