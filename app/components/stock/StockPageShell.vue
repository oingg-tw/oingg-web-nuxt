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
  <div class="stock-page-shell">
    <!-- 讀取中（換到另一檔、公司資料還沒到；伺服器端不會發生）：先畫結構——摘要卡與麵包屑同高的骨架、側欄、第一段的骨架。
         原本整頁留白加 v-loading 轉圈（2026-10-23，手機換頁延遲；「先畫結構、資料用骨架」）。頁面自己的段落等名稱到了才畫，
         不然問句會先出現「2317（2317）的…」再換字 -->
    <template v-if="pending">
      <div class="stock-page-shell__head">
        <el-card class="stock-page-shell__card-skeleton" shadow="never" :body-style="{ padding: '12px 20px' }" aria-hidden="true">
          <span class="app-skeleton stock-page-shell__skeleton-title" />
          <span class="app-skeleton stock-page-shell__skeleton-price" />
        </el-card>
        <h1 class="visually-hidden">{{ code }} {{ topic }}</h1>
        <slot name="nav">
          <StockPageNav :code="code" />
        </slot>
        <div class="stock-page-shell__crumb-skeleton" aria-hidden="true"><span class="app-skeleton app-skeleton--text" /></div>
      </div>
      <div class="stock-page-shell__section-skeleton" aria-hidden="true">
        <span class="app-skeleton stock-page-shell__skeleton-question" />
        <span class="app-skeleton app-skeleton--text" />
        <div class="app-skeleton app-skeleton--chart" />
      </div>
    </template>
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

/* 讀取中的骨架：摘要卡同高（多數股票實測手機 163px、601px 以上 131px；多一行面額註記的會再高一點）、麵包屑 48px */
.stock-page-shell__card-skeleton {
  height: 163px;
}

.stock-page-shell__card-skeleton :deep(.el-card__body) {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 12px;
  height: 100%;
  box-sizing: border-box;
}

.stock-page-shell__skeleton-title {
  width: min(16em, 70%);
  height: 1.6em;
}

.stock-page-shell__skeleton-price {
  width: 6em;
  height: 2em;
}

.stock-page-shell__crumb-skeleton {
  display: flex;
  align-items: center;
  height: 48px;
}

.stock-page-shell__crumb-skeleton .app-skeleton {
  width: min(20em, 80%);
}

.stock-page-shell__section-skeleton {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.stock-page-shell__skeleton-question {
  width: min(22em, 85%);
  height: 1.5em;
}

@media (min-width: 601px) {
  .stock-page-shell__card-skeleton {
    height: 131px;
  }
}
</style>
