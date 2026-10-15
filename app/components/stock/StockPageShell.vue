<script setup lang="ts">
import type { Stock } from '~/composables/stock/useStocks'
import type { StockBreadcrumbItem } from '~/composables/stock/useStockPageSeo'
import type { StockPageFooterLink } from '~/components/stock/StockPageFooter.vue'
// 個股頁的骨架（2026-10-14）：讀取中／找不到這檔 → 摘要卡 → 個股導覽 → 麵包屑 → 各段落（default slot）→ 定義區（#guide）→ 頁尾。
// 順序只寫在這裡，頁面只填內容。
//
// 為什麼收成一個元件：這一串原本在 17 個地方各寫一次，連「讀取中／找不到」都有兩種寫法（有的頁先判斷 stockPending、有的先判斷
// stock），段落順序、定義區、頁尾也都各自統一過一輪仍然漏改（使用者：「怎麼改可以不要漏掉？」「這種東西只能從架構上去優化」）。
// 頁尾是必填的 prop 而不是 slot：每一頁都要有（2026-10-11「個股瀏覽頁面的底部希望可以統一元件去管理」），少了 typecheck 會擋。
// 定義區是選填的 slot：個股首頁、指標總覽、指標速覽、三大財務報表與三張報表本來就沒有。
//
// 讀取中先不畫任何東西、資料到了才決定「找不到」：stock 是非同步讀的，直接寫「找不到這檔股票」會在每次第一次繪製時閃一下。
//
// 特別股與 ETF 的個別頁（2026-10-15 三組篩選重新設計）也用這個骨架：#nav 換成篩選區的導覽（ScreenerNav），subject 換掉
// 「找不到這檔股票」的「股票」。個股頁什麼都不用傳。
defineProps<{
  code: string
  stock: Stock | null | undefined
  pending: boolean
  // 興櫃三態，見 StockSummaryCard
  isEmerging: boolean | null
  isFavorite: boolean
  shortName: string
  // 摘要卡標題（唯一的 <h1>）後半：「台積電 2330 {topic}」
  topic: string
  breadcrumbs: StockBreadcrumbItem[]
  footer: { sources: string[], links?: StockPageFooterLink[], freshness?: string | null, disclaimer?: string }
  // 找不到時的「找不到這檔{subject}」，預設「股票」
  subject?: string
}>()
defineEmits<{ 'toggle-favorite': [] }>()
</script>

<template>
  <div v-loading="pending">
    <template v-if="pending" />
    <SharedStockNotFound v-else-if="!stock" :subject="subject" />
    <template v-else>
      <StockSummaryCard :stock="stock" :is-emerging="isEmerging" :is-favorite="isFavorite" :short-name="shortName" :topic="topic" @toggle-favorite="$emit('toggle-favorite')" />
      <slot name="nav">
        <StockPageNav :code="code" />
      </slot>
      <StockBreadcrumb :items="breadcrumbs" />
      <slot />
      <slot name="guide" />
      <StockPageFooter v-bind="footer" />
    </template>
  </div>
</template>
