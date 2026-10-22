<script setup lang="ts">
import type { MetricsHistoryEntry, MetricsHistoryTimeframe } from '#shared/types/metrics-history'
// 「X 的歷年變化如何？」那一張逐期表，2026-10-01 從 StockMetricDetailPage 抽出來共用
//（「roe 沒有歷年變化的表格又是為什麼? 都補上好嗎?」）。
//
// 那 7 個徽章頁拿到的 series 跟指標頁是同一個端點、同一個形狀（實測 roe 20 期），缺的只是這張表——
// 所以這裡沒有任何徽章專屬的分支，兩個模板傳一樣的東西。
const props = defineProps<{
  entries: MetricsHistoryEntry[]
  metricCode: string
  timeframe: MetricsHistoryTimeframe
  topic: string
  unit: string
  shortName: string
  code: string
  // 上市櫃日（YYYY-MM-DD），只有用到股價的指標（河流圖那幾頁）傳。2026-10-17 6498 久禾光：2025-05-20 才上櫃，之前 7 季財報在 MOPS
  // 有、股價沒有，pbRatio 是 missing_input，原本寫「無法計算」讀起來像資料出錯
  listedOn?: string | null
}>()

// 財報公布（knowledgeDate）在上市櫃日之前、又沒有數值的列不列——那時沒有股價，不管 nullReason 是缺材料還是期數不足（6498 的本益比
// 兩種都有：興櫃時只有半年報，近四季湊不滿）都不可能有值。同日先試過寫「上市櫃前沒有股價」，使用者：「連 上市櫃前沒有股價 這個都
// 別顯示 直接隱藏多餘的row」。這些列都在最舊的那一端，拿掉不會在中間留缺口（中間的缺期照留，2026-10-13）
const points = computed(() => metricHistoryPoints(props.entries, props.metricCode).filter(entry =>
  !(props.listedOn && entry.point?.value === null && (entry.point.knowledgeDate ?? '') < props.listedOn)))
const text = computed(() => {
  const list = points.value
  return historyTableText({ ...props, basis: TIMEFRAME_LABELS[props.timeframe], count: list.length, from: list.length ? periodLabel(list.at(-1)!, props.timeframe) : '', to: list.length ? periodLabel(list[0]!, props.timeframe) : '' })
})
// 只有一期時不寫涵蓋期間（同 metricHistoryAnswer 的 < 2 門檻）
const answer = computed(() => (points.value.length < 2 ? null : text.value.answer))

// 連續幾期都因為同一個原因算不出來，合成一列「2021 Q3～2025 Q4（18 期）」（2026-10-21，使用者看 6741 現金轉換循環：「為什麼歷史資料
// 要出現這麼多 "無法計算"」，選了先只合併顯示）。原因照舊放 title；只有一期的照舊一列。期數（答句的「共 N 期」）不變
const rows = computed(() => {
  const groups: (typeof points.value)[] = []
  for (const entry of points.value) {
    const head = groups.at(-1)?.[0]?.point
    if (entry.point?.value === null && head?.value === null && head.nullReason === entry.point.nullReason) groups.at(-1)!.push(entry)
    else groups.push([entry])
  }
  return groups.map((group) => {
    const newest = group[0]!
    const label = periodLabel(newest, props.timeframe)
    return { key: `${newest.fiscalYear}-${newest.fiscalQuarter}`, entry: newest, period: group.length > 1 ? `${periodLabel(group.at(-1)!, props.timeframe)}～${label}（${group.length} 期）` : label }
  })
})
</script>

<template>
  <StockQuestionSection v-if="points.length" id="stock-metric-history" :question="text.question" :answer="answer">
    <!-- ssr="history"：指標頁一圖一表的那一張表（scripts/check-stock-pages.mjs 數它） -->
    <SharedTable :label="text.label" ssr="history">
      <thead>
        <tr>
          <th scope="col">期別</th>
          <th scope="col">{{ topic }}{{ unit ? `（${unit}）` : '' }}</th>
          <th scope="col">資料時間</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="{ key, entry, period } in rows" :key="key">
          <th scope="row">{{ period }}</th>
          <td :title="entry.point ? nullReasonTitle(entry.point) : undefined">{{ metricCellText(entry.point, unit) }}</td>
          <!-- 算不出數值的列不寫資料時間（2026-10-17「沒上市 那為什麼會有資料時間?」）：那個日期是分母的財報公布日，不是這個數字的 -->
          <td>{{ entry.point?.value != null ? entry.point.knowledgeDate ?? '—' : '—' }}</td>
        </tr>
      </tbody>
    </SharedTable>
  </StockQuestionSection>
</template>

