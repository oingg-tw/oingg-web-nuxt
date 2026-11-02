<script setup lang="ts">
// 散佈圖的手機版（2026-11-02，使用者選「要比很多項目的圖，手機改成清單」：散佈圖在手機上點擠成一團、名字標不出來）：四個象限各一張
// 小表，看得見的表名就是那一組。分組用 quadrantGroups（shared/utils/quadrants.ts）；列照頁面給的順序（產業頁照代號，不做排行）。
// 用的頁：/industries/dividend、/industries/growth、/industry/[sector]/dividend。
// collapsed：每組收成一列（全站的 app-disclosure），點開才是表——類股頁一個類股可到兩百多家，四張表攤開有七千多 px 長
export interface QuadrantTableRow { key: string; name: string; to: string | null; cells: string[] }
export interface QuadrantTable { title: string; rows: QuadrantTableRow[] }

defineProps<{ groups: QuadrantTable[]; columns: readonly string[]; collapsed?: boolean }>()
</script>

<template>
  <div class="industry-quadrant-tables">
    <template v-for="group in groups" :key="group.title">
      <component :is="collapsed ? 'details' : 'div'" v-if="group.rows.length" :class="{ 'app-disclosure': collapsed }">
        <summary v-if="collapsed">{{ group.title }}</summary>
        <SharedTable :label="group.title" :caption-visible="!collapsed">
          <thead>
            <tr>
              <th v-for="(column, index) in columns" :key="column" scope="col" :class="{ 'seo-table__num': index > 0 }">{{ column }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in group.rows" :key="row.key">
              <th scope="row">
                <NuxtLink v-if="row.to" :to="row.to">{{ row.name }}</NuxtLink>
                <template v-else>{{ row.name }}</template>
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
</style>
