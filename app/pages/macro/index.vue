<script setup lang="ts">
// /macro — 總經特區的索引（2026-09-22，特區有七頁才建：只有一個連結的索引是本站到處拒絕的薄頁）。每列帶一句「這一頁呈現什麼」，
// 有它這一頁才值得被索引、不是上方導覽的複本；句子跟著 MACRO_NAV_ITEMS 走。
const items = MACRO_NAV_ITEMS

const { breadcrumbs } = useHubPageSeo({
  title: '台股總經特區：十項總體經濟指標與大盤對照',
  description: '央行、聯準會與歐洲央行政策利率、股票風險溢酬、景氣燈號、貨幣供給、公債殖利率、匯率、通膨與經濟成長率，每一項都附逐期數據表，多數與加權股價指數畫在同一個時間軸上。',
  path: '/macro',
  breadcrumbs: [
    { label: '首頁', to: '/' },
    { label: '總經特區', to: '/macro' }
  ]
})
</script>

<template>
  <div class="app-page app-page--compact macro-index">
    <h1 class="app-page__title macro-index__title">台股總經特區</h1>
    <StockBreadcrumb :items="breadcrumbs" />
    <!-- 索引頁也放導覽列（2026-09-22）：它是特區的一員，落地在這裡的人該能直接跳到某個指標，不用捲表格找同樣的連結 -->
    <MacroNav />

    <section class="stock-page-section" aria-labelledby="macro-index-heading">
      <h2 id="macro-index-heading" class="stock-page-section__title">這裡有哪些總體經濟指標？</h2>
      <p class="hub-answer">
        以下 {{ items.length }} 項指標各自有一頁，每一頁都把該指標與加權股價指數畫在同一個時間軸上，並附逐期數據表。
        資料來自中央銀行、行政院主計總處、國家發展委員會與臺灣證券交易所。
      </p>
      <p class="hub-answer">
        這些頁面只呈現數字與時間，不對指標與股市的關係做任何推論。
      </p>

      <SharedTableScroll label="總經特區的指標一覽">
        <table class="seo-table" data-ssr-table>
          <caption>總經特區的 {{ items.length }} 項指標與各自的內容</caption>
          <thead>
            <tr>
              <th scope="col">指標</th>
              <th scope="col">這一頁呈現什麼</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in items" :key="item.to">
              <th scope="row"><NuxtLink :to="item.to">{{ item.label }}</NuxtLink></th>
              <td>{{ item.description }}</td>
            </tr>
          </tbody>
        </table>
      </SharedTableScroll>
    </section>
  </div>
</template>

