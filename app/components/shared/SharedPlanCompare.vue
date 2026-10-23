<script setup lang="ts">
// 免費版與專業版能存多少（2026-10-06「完善付費方案」；2026-10-24 從個人資料頁抽出來，額度彈窗 AppQuotaDialog 也用）。數字來自
// 業務中台 GET /billing/plans，不在前端寫死。表格一開始就畫：讀到之前數字是同大小的骨架，讀不到寫「－」，數字到的時候表格不長高也不消失。
// highlight：額度彈窗把卡住的那一列標出來
defineProps<{ highlight?: QuotaResource }>()

interface PlanQuotas { tier: 'FREE' | 'PRO'; quotas: Partial<Record<QuotaResource, number | null>> }
const TIERS = ['FREE', 'PRO'] as const
// 個人資料頁與彈窗共用一份、讀到就不再讀。undefined ＝ 讀取中；null ＝ 讀不到（下次掛上再試）
const plans = useState<PlanQuotas[] | null | undefined>('billing-plans', () => undefined)
onMounted(async () => {
  if (plans.value) return
  plans.value = await apiFetch<{ plans: PlanQuotas[] }>('/billing/plans').then(response => response.plans).catch(() => null)
})
const limitOf = (tier: PlanQuotas['tier'], row: (typeof QUOTA_ROWS)[number]) =>
  quotaLimitText(plans.value?.find(plan => plan.tier === tier)?.quotas[row.resource], row.unit)
</script>

<template>
  <SharedTable label="免費版與專業版的差別" :ssr="false" table-class="plan-compare">
    <thead>
      <tr>
        <th scope="col">項目</th>
        <th scope="col">免費版</th>
        <th scope="col">專業版</th>
      </tr>
    </thead>
    <tbody>
      <!-- 法規底線（投信投顧法）：付費只能差在能追蹤、儲存多少，分析與資料兩邊一樣——寫在最前面 -->
      <tr>
        <th scope="row">個股分析、篩選結果、資料來源</th>
        <td colspan="2">兩個方案完全相同</td>
      </tr>
      <tr v-for="row in QUOTA_ROWS" :key="row.resource" :class="{ 'plan-compare__hit': row.resource === highlight }">
        <th scope="row">{{ row.label }}</th>
        <td v-for="tier in TIERS" :key="tier">
          <span v-if="plans === undefined" class="app-skeleton app-skeleton--inline" aria-hidden="true">10 {{ row.unit }}</span>
          <template v-else>{{ limitOf(tier, row) }}</template>
        </td>
      </tr>
    </tbody>
  </SharedTable>
</template>

<style scoped>
.plan-compare tbody th {
  white-space: normal;
}

/* 卡住的那一列：粗體、淡主色底（彈窗標題已經用字說了是哪一項）。第一欄有全站表格自己的不透明底（main.css 的
   .seo-table tbody th:first-child，左右捲時蓋住後面的格子），要比它多一層才蓋得過 */
.plan-compare .plan-compare__hit > * {
  font-weight: 600;
  background: var(--el-color-primary-light-9);
}
</style>
