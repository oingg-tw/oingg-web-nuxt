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
//
// 上下的距離也在這裡（2026-10-23，使用者看 /stock/5314/metrics：「間距甚麼的似是隨意」）：原本每一頁自己挑 app-page（24px）、
// app-page--compact（16px）或什麼都不給（只靠各元素的 margin），同一個骨架在不同頁距離不一樣。現在：摘要卡、導覽、麵包屑一組，
// 之間 16px；之後每一段（各問句段落、定義區、頁尾）之間 40px（手機 32px）。段落裡面的節奏在 main.css 的 .stock-page-section
defineProps<{
  code: string
  stock: Stock | null | undefined
  pending: boolean
  // 興櫃三態，見 StockSummaryCard
  isEmerging: boolean | null
  shortName: string
  // 摘要卡標題（唯一的 <h1>）後半：「台積電 2330 {topic}」
  topic: string
  breadcrumbs: StockBreadcrumbItem[]
  footer: { sources: string[], links?: StockPageFooterLink[], freshness?: string | null, disclaimer?: string }
  // 找不到時的「找不到這檔{subject}」，預設「股票」
  subject?: string
}>()
</script>

<template>
  <div v-loading="pending" class="stock-page-shell">
    <template v-if="pending" />
    <SharedStockNotFound v-else-if="!stock" :subject="subject" />
    <template v-else>
      <div class="stock-page-shell__head">
        <StockSummaryCard :stock="stock" :is-emerging="isEmerging" :short-name="shortName" :topic="topic" />
        <slot name="nav">
          <StockPageNav :code="code" />
        </slot>
        <StockBreadcrumb :items="breadcrumbs" />
      </div>
      <slot />
      <slot name="guide" />
      <StockPageFooter v-bind="footer" />
    </template>
  </div>
</template>

<style scoped>
/* scoped 的屬性選擇器讓它比呼叫端還帶著的 .app-page／.app-page--compact 重，距離一律以這裡為準 */
.stock-page-shell {
  display: flex;
  flex-direction: column;
  gap: clamp(32px, 4vw, 40px);
  width: 100%;
}

.stock-page-shell__head {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
</style>
