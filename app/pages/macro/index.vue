<script setup lang="ts">
import { MACRO_NAV_ITEMS } from '~/utils/macro-nav'

// /macro — 總經特區's index（2026-09-22）.
//
// Deliberately NOT built the day before, when the zone had one page: an index with a single link
// on it is the thin page this app rejects everywhere else, and the comment in policy-rate.vue said
// so and said the level goes in「when the zone has enough members to be worth browsing」. Seven
// members is that. Building it now also settles two things that were deferred with it — the macro
// pages' breadcrumbs gain their middle level, and the header gets one destination to point at
// instead of a seven-item dropdown.
//
// A list of the zone's pages with what each one actually contains, not a bare link list: the
// 一句話 per row is the thing that makes this page worth indexing rather than a duplicate of the
// nav that sits above it on every member page.
const DESCRIPTIONS: Record<string, string> = {
  '/macro/policy-rate': '中央銀行歷次升降息的生效日與重貼現率，對照加權股價指數的月收盤。',
  '/macro/business-cycle': '國發會景氣對策信號的分數與燈號，對照大盤走勢。',
  '/macro/money-supply': 'M1B 與 M2 的年增率，兩者的高低關係是市場常討論的資金指標。',
  '/macro/bond-yield': '10 年期公債殖利率，一般作為無風險利率的參考。',
  '/macro/exchange-rate': '新台幣兌美元的月收盤匯率；數字越小代表新台幣越強。',
  '/macro/inflation': '消費者物價指數的年增率，也就是一般所說的通膨率。',
  '/macro/gdp-growth': '主計總處公布的經濟成長率，按季發布。'
}

const items = computed(() => MACRO_NAV_ITEMS.map(item => ({ ...item, description: DESCRIPTIONS[item.to] ?? '' })))

const { breadcrumbs } = useHubPageSeo({
  title: '台股總經特區：七項總體經濟指標與大盤對照',
  description: '央行政策利率、景氣燈號、貨幣供給、公債殖利率、匯率、通膨與經濟成長率，每一項都與加權股價指數畫在同一個時間軸上，附逐期數據表。',
  path: '/macro',
  breadcrumbs: [
    { label: '首頁', to: '/' },
    { label: '總經特區', to: '/macro' }
  ]
})
</script>

<template>
  <div class="macro-index">
    <h1 class="macro-index__title">台股總經特區</h1>
    <StockBreadcrumb :items="breadcrumbs" />
    <!-- The zone index carries the rail too (added 2026-09-22 with the rail itself): it is one of
         the zone's pages, and a visitor landing here should be able to jump straight to an
         indicator rather than scrolling the table below to find the same seven links. Its INLINE
         copy is hidden here and only here — see the style block. -->
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

<style scoped>
.macro-index {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.macro-index__title {
  margin: 0;
  font-size: 1.5rem;
}

/* This page's own table IS the seven-link list, with a sentence explaining each one — so the nav's
   narrow-width pill row would print the same seven destinations twice, a few hundred pixels apart.
   Hidden via :deep() from here rather than through a prop on MacroNav: it is a layout decision
   belonging to this page alone, and MacroNav has two root elements, so a class passed from outside
   would not fall through to either of them. The RAIL copy is untouched and still renders at
   ≥1280px, where it sits in the reserved gutter and costs the table nothing. */
.macro-index :deep(.macro-nav--inline) {
  display: none;
}
</style>
