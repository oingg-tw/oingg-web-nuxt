<script setup lang="ts">
// 個股頁的頁尾（2026-10-11，使用者：「個股瀏覽頁面的底部希望可以統一元件去管理」）。每一頁都掛、都放在內容最後，
// 固定三行、順序不變：資料來源（＋資料時間）→ 相關頁面 → 免責。
//
// 統一之前有五種寫法：StockPageDigest（h2「資料來源」，6 頁）、指標頁與徽章頁各自手刻的 footer div（一個有來源沒免責、
// 一個反過來）、三率／償債／杜邦段落中間的「資料來源：…」「相關：…」、單一連結的段落、只放連結清單的問句段落；另外 6 頁
// 完全沒寫來源。使用者選的形式：
//   - 沒有標題、上方一條分隔線：它不回答任何問題，掛問句或 h2 會讓它看起來像內容、也佔文件大綱
//   - 免責每頁都放（網站最底下的共用頁尾另有非投顧聲明，這句是針對這一頁的數字）
//   - 來源與「相關」連結只出現在這裡，段落裡只留回答
// 用 div 不用 <footer>：check-stock-pages.mjs 把 <footer> 當成全站頁尾整段略過不掃（禁用詞掃描），這一塊是這一頁的內容。
// 只用 <p>／<a>，不巢狀 div：check-stock-pages.mjs 用正規表示式切出這一塊比對 SSR 與水合後的文字。
//
// 文獻引用（徽章與三率三升的「出處：作者・原始文獻」）不搬來這裡：那是概念的出處，跟著概念的說明走。

export interface StockPageFooterLink {
  to: string
  label: string
  external?: boolean
}

withDefaults(defineProps<{
  sources: string[]
  // 資料時間，例如「最新財報資料：2026 Q2（揭露日 2026-08-14）」
  freshness?: string | null
  links?: StockPageFooterLink[]
  disclaimer?: string
}>(), {
  freshness: null,
  links: () => [],
  disclaimer: STOCK_DIGEST_DISCLAIMER
})
</script>

<template>
  <div class="stock-page-footer">
    <p v-if="sources.length">資料來源：{{ sources.join('、') }}<template v-if="freshness">（{{ freshness }}）</template></p>
    <p v-if="links.length">
      <!-- 連結用全站的內文連結樣式（2026-10-21：原本沒有 class，畫成瀏覽器預設的藍色） -->
      相關頁面：<template v-for="(link, index) in links" :key="link.to"><template v-if="index">、</template><a v-if="link.external" :href="link.to" target="_blank" rel="noopener noreferrer" class="hub-inline-link">{{ link.label }}（另開新視窗）</a><NuxtLink v-else :to="link.to" class="hub-inline-link">{{ link.label }}</NuxtLink></template>
    </p>
    <p>{{ disclaimer }}</p>
  </div>
</template>

<style scoped>
/* 安靜的頁尾，不是另一張卡片（2026-09-21 StockPageDigest 拿掉卡片外框的理由）：只有上方一條線，用全站表格那一條淡的（2026-10-23，
   原本是元件外框的 3:1 深灰）。跟上一段的距離是 StockPageShell 的段落間距，這裡不另外加 */
.stock-page-footer {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-top: 16px;
  border-top: 1px solid var(--app-divider);
  line-height: 1.7;
  color: var(--el-text-color-secondary);
}

.stock-page-footer p {
  margin: 0;
}
</style>
