<script setup lang="ts">
// 全站表格（2026-10-23，使用者：「要以 screener-shell__results 這邊的卡片+表格，為核心去滿足整個網站的所有表格需求」「重點是表格元件要
// 統一管理 這是最重要的」）：網站上每一張表都由這個元件畫——卡片、卡片裡的標題列（#header，選填）、可左右捲的區塊、
// <table class="seo-table"> 與藏起來的 caption 都在這裡，頁面只給 <thead>／<tbody>。表格長什麼樣（卡片白底、表頭暖色、列線、垂直置中、
// 左右 16px…）在 main.css 的「全站表格」，el-table 那一半在 element-plus.css。el-table 這類自己畫的內容用 custom：不畫捲動區與 <table>，
// 預設插槽原樣放進卡片（三大財務報表、篩選結果）。scripts/check-tables.mjs 擋住在這裡以外直接寫 <table>、.seo-table 或 .app-table-card。
//
// 捲動區（原 SharedTableScroll，2026-09-19 SEO 版）：寬表在手機上用手指左右捲，鍵盤使用者也要進得去、用方向鍵捲（axe
// scrollable-region-focusable），所以有 tabindex、role="region" 與名稱「…，可左右捲動」。
const props = withDefaults(defineProps<{
  // 這張表是什麼（「半導體業公司名單」）：捲動區的名稱，也是 caption。caption 另外給時要以它開頭（check-stock-pages 驗）
  label?: string
  caption?: string
  // caption 是畫面上的說明（例如「殖利率為某日收盤價計算」），看得見、在卡片裡表格上方；預設藏起來（2026-10-13 個股頁統一藏）
  captionVisible?: boolean
  // 頁面自己的版面（手機改成格子之類）掛在這個 class 上；表格本身的樣子不在頁面改
  tableClass?: string
  tableId?: string
  // data-ssr-table：伺服器端就畫好的資料表，檢查腳本靠它找表。'history' 歷年表；'audit' 計算依據（不算在「一圖一表」裡）；false 不加
  ssr?: boolean | 'history' | 'audit'
  // el-table 或其他自己畫的內容：不畫捲動區與 <table>
  custom?: boolean
  // 不會左右捲的表（窄的時候自己疊成一列一列，例如指標速覽）：不畫可聚焦的捲動區，少一個沒用的 Tab 停留點
  scrollable?: boolean
}>(), { label: '', caption: undefined, captionVisible: false, tableClass: undefined, tableId: undefined, ssr: true, custom: false, scrollable: true })

const ssrAttr = computed(() => (props.ssr === false ? undefined : props.ssr === true ? '' : props.ssr))
</script>

<template>
  <!-- <table> 明寫 role="table"：頁面窄的時候把表格改成 block/grid（指標速覽、持股指標表），Safari＋VoiceOver 會因此丟掉表格語意 -->
  <div class="shared-table app-table-card">
    <div v-if="$slots.header" class="shared-table__header">
      <slot name="header" />
    </div>
    <slot v-if="custom" />
    <div v-else-if="scrollable" class="shared-table__scroll" tabindex="0" role="region" :aria-label="`${label}，可左右捲動`">
      <table :id="tableId" class="seo-table" :class="tableClass" :data-ssr-table="ssrAttr" role="table">
        <caption :class="captionVisible ? 'shared-table__caption' : 'visually-hidden'">{{ caption ?? label }}</caption>
        <slot />
      </table>
    </div>
    <table v-else :id="tableId" class="seo-table" :class="tableClass" :data-ssr-table="ssrAttr" role="table">
      <caption :class="captionVisible ? 'shared-table__caption' : 'visually-hidden'">{{ caption ?? label }}</caption>
      <slot />
    </table>
  </div>
</template>

<style scoped>
/* clip 讓表格的方角不露出卡片的圓角；不用 hidden：hidden 會變成捲動容器，裡面黏住的表頭就黏在卡片裡 */
.shared-table {
  overflow: clip;
}

/* 卡片裡的標題列：左右 16px，跟表格第一欄切齊 */
.shared-table__header {
  padding: 16px 16px 12px;
}

.shared-table__scroll {
  width: 100%;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

/* 看得見的 caption：表格上方、跟標題列同樣左右 16px，次要文字色 */
.shared-table__caption {
  padding: 12px 16px;
  text-align: left;
  color: var(--el-text-color-secondary);
  white-space: normal;
}

/* 焦點框畫在裡面：畫在外面會被卡片的圓角裁掉 */
.shared-table__scroll:focus-visible {
  outline-offset: -3px;
}
</style>
