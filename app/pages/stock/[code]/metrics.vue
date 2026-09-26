<script setup lang="ts">
import { Check, Plus } from '@element-plus/icons-vue'
import type { StockNavNode } from '~/utils/stock-page-nav'
import { STOCK_METRIC_INDEX } from '~/utils/stock-page-nav'

// /stock/{code}/metrics — 這檔股票的指標目錄（2026-09-26「Sidebar 塞了這麼多面向還是太雜亂了。我需要
// 把這些東西從 sidebar 移除，開一個頁面專門找尋這幾類指標」）。
//
// 同一天早上才把六組放回側邊欄並加上 unique-opened，收合 10 列、展開最多 18 列——數字上成立，看起來
// 仍然雜亂。這一頁就是那個判斷的結論：**側邊欄和目錄是兩件事**。側邊欄回答「我現在在哪」，永遠四列；
// 這一頁回答「有哪些東西可以看」，一次全給。
//
// 形狀是站上既有的那一種：問句 <h2> → 一句答句 → 一張表（StockQuestionSection + seo-table），不是
// 卡片牆（「card-per-metric = 畫面髒亂」）。<h2> 用讀者的問題而不是「獲利能力」這種行話，分類名只出現在
// 表格的 caption 與 aria-label 裡。
//
// 每一列都是真的 <a href>：scripts/check-click-depth.mjs 用 regex 讀原始 HTML、不跑瀏覽器，而這一頁
// 現在是那 35 頁唯一的集中入口。分類與每一組的成員理由留在 stock-page-nav.ts，這裡只負責渲染。
//
// **noindex, follow；不進 sitemap，只進 scripts/check-stock-pages.mjs 的 FIXED_ROUTES。** 這一頁每一檔股票的 body
// 一字不差，唯一的差別是公司名——2339 個內容相同的 URL 進 sitemap 是典型的薄內容。走站上既有的
// 「可達但不宣傳」拆法（指標歷史、ETF／特別股專區同一條）：路由發布、站內連得到、爬蟲跟得下去，
// 只是不主動送上去要求收錄。要改成收錄的話，把 '/metrics' 加進 server/api/__sitemap__/stocks.get.ts
// 的 INDEXABLE_SUFFIXES 就好，一行。
//
// 附帶的代價要知道：那 35 頁原本在側邊欄，等於被該代號的每一頁連到；現在只剩這一頁連它們。站內連結
// 數大幅下降是把它們移出側邊欄的必然結果，不是這個 sitemap 決定造成的。
//
// 損益表那條鏈的 16 頁不在這裡，跟它們不在側邊欄是同一個決定：沒有人會在目錄裡「找」每股其他利益及
// 損失，讀者是在 /dividend-source 的表格上看到某一列才起了好奇心。那一頁的索引段是它們的入口。
const TOPIC = '指標總覽'

const route = useRoute()
const code = computed(() => String(route.params.code))
const { stock, profile, stockShortName, stockPending, isFavorite, toggleFavorite } = useStockDetailSummary(code)

// 巢狀的財報三率攤平進母組的同一張表：目錄要的是「一眼看完可以點什麼」，多一層標題只是多一道坎。
// 三率仍然讀得出來——「三率的關係」排在那四項的第一個，它自己的鉤子說明了它們是一組的。
const { pinnedSlugs, isPinned, isFull, toggle } = useStockPinnedMetrics()
const slugOf = (node: StockNavNode) => node.to!('_').split('/').pop()!

const flatten = (nodes: StockNavNode[]): StockNavNode[] =>
  nodes.flatMap(node => (node.children ? flatten(node.children) : [node]))

const sections = computed(() =>
  STOCK_METRIC_INDEX.map((group, index) => ({
    id: `stock-metric-index-${index}`,
    label: group.label,
    icon: group.icon,
    question: group.question ?? group.label,
    answer: group.answer ?? null,
    links: flatten(group.children ?? [])
  }))
)

const totalLinks = computed(() => sections.value.reduce((sum, section) => sum + section.links.length, 0))

const { breadcrumbs } = useStockPageSeo({
  code,
  shortName: stockShortName,
  topic: TOPIC,
  titleKeywords: '全部指標與它們回答的問題',
  pathSuffix: '/metrics',
  // noindex, follow（2026-09-26「metrics 這一頁面記得不要進 index，因為沒有資訊」）。這一頁每一檔
  // 股票的 body 一字不差，唯一的差別是公司名——2339 個內容相同的 URL 就是典型的薄內容。follow 保留，
  // 因為這一頁真正的價值是把爬蟲帶到底下那 41 個指標頁，那些頁面每一檔都有自己的數字。
  noindex: true,
  stock,
  summary: computed(() => null),
  description: computed(() =>
    clampDescription(
      `${stockShortName.value}（${code.value}）可以查的 ${totalLinks.value} 項財報指標，依 ${sections.value.length} 個問題分組：賺不賺錢、賺到的有沒有變成現金、有沒有在長大、撐不撐得住、會分多少給你、股價相當於公司的幾倍，以及原始財報怎麼查。`
    )
  ),
  sectorCode: computed(() => profile.value?.industry ?? null)
})
</script>

<template>
  <div v-loading="stockPending" class="stock-metric-index-page">
    <template v-if="stock">
      <StockSummaryCard :stock="stock" :is-favorite="isFavorite" :short-name="stockShortName" :topic="TOPIC" @toggle-favorite="toggleFavorite" />
      <StockPageNav :code="code" />
      <StockBreadcrumb :items="breadcrumbs" />

      <p class="stock-metric-index-page__lede">
        每一項都可以釘到左邊的側邊欄，跟著你的帳號走。目前釘了 {{ pinnedSlugs.length }} / {{ PINNED_METRIC_LIMIT }} 個。
      </p>

      <StockQuestionSection
        v-for="section in sections"
        :id="section.id"
        :key="section.id"
        :question="section.question"
        :answer="section.answer"
        :icon="section.icon"
      >
        <SharedTableScroll :label="`${section.label}指標`">
          <table class="seo-table" data-ssr-table>
            <caption class="visually-hidden">{{ section.label }}這一組的指標，以及每一項回答什麼</caption>
            <!-- 表頭視覺隱藏：七段各印一次「指標｜它回答什麼」是純噪音，會讓一份目錄讀起來像七張資料
                 表。欄名對輔助技術仍然存在，caption 也還在。 -->
            <thead class="visually-hidden">
              <tr>
                <th scope="col">指標</th>
                <th scope="col">它回答什麼</th>
                <th scope="col">釘選到側邊欄</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="link in section.links" :key="link.label">
                <th scope="row">
                  <NuxtLink :to="link.to!(code)" class="seo-table__link">{{ link.label }}</NuxtLink>
                </th>
                <td>{{ link.hook }}</td>
                <!-- 釘選（2026-09-26「指標要可以自選加入到左邊的 sidebar」）。表格右半邊那塊空白本來
                     就是留給它的，所以這裡不需要重排版面。

                     真的 <button>、aria-pressed 表達開關狀態、可及名稱帶上指標名——一整欄 35 個都叫
                     「釘選」的話，用螢幕閱讀器逐項瀏覽時分不出在釘哪一支。狀態不只靠顏色：文字本身就
                     會從「釘選」變成「已釘選」。 -->
                <td class="stock-metric-index-page__pin-cell">
                  <button
                    type="button"
                    class="stock-metric-index-page__pin"
                    :class="{ 'is-pinned': isPinned(slugOf(link)) }"
                    :aria-pressed="isPinned(slugOf(link))"
                    :aria-label="`${isPinned(slugOf(link)) ? '取消釘選' : '釘選'} ${link.label} 到側邊欄`"
                    :disabled="!isPinned(slugOf(link)) && isFull"
                    @click="toggle(slugOf(link))"
                  >
                    <!-- 圖示是加強，不是狀態的唯一線索：文字本身已經從「釘選」變成「已釘選」，顏色也
                         變，這裡只是讓一整欄 57 個按鈕掃起來更快。aria-hidden——按鈕自己的 aria-label
                         已經把狀態和指標名都講完了，圖示再被唸一次只是噪音。

                         不用 Star：StockSummaryCard 右上角的「已加最愛」已經用星號代表自選股，同一頁
                         兩種星號兩種意思會混淆。加號是「加到側邊欄」，打勾是「已經在那裡了」。 -->
                    <el-icon class="stock-metric-index-page__pin-icon" aria-hidden="true">
                      <component :is="isPinned(slugOf(link)) ? Check : Plus" />
                    </el-icon>{{ isPinned(slugOf(link)) ? '已釘選' : '釘選' }}</button>
                </td>
              </tr>
            </tbody>
          </table>
        </SharedTableScroll>
      </StockQuestionSection>
    </template>

    <el-result v-else-if="!stockPending" icon="warning" sub-title="請確認股票代號是否正確">
      <template #title>
        <h1 class="stock-not-found__title">找不到這檔股票</h1>
      </template>
      <template #extra>
        <el-button type="primary" @click="navigateTo('/')">回首頁</el-button>
      </template>
    </el-result>
  </div>
</template>

<style scoped>
.stock-metric-index-page__lede {
  margin: 0 0 24px;
  color: var(--el-text-color-secondary);
}

.stock-metric-index-page__pin-cell {
  width: 1%;
  white-space: nowrap;
  text-align: right;
}

.stock-metric-index-page__pin {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  /* ≥48px 是本站的觸控下限（高於 WCAG 的 24×24），跟側邊欄那些列同一條規則。 */
  min-height: 48px;
  min-width: 88px;
  padding: 0 16px;
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  background: var(--el-bg-color);
  color: var(--el-text-color-regular);
  font-size: 1rem;
  cursor: pointer;
}

.stock-metric-index-page__pin:hover:not(:disabled) {
  border-color: var(--el-color-primary);
  color: var(--el-color-primary);
}

.stock-metric-index-page__pin.is-pinned {
  /* 狀態不只靠顏色：文字已經從「釘選」變成「已釘選」，這裡的實心底只是加強，不是唯一線索。 */
  border-color: var(--el-color-primary);
  background: var(--el-color-primary);
  color: #fff;
}

.stock-metric-index-page__pin-icon {
  font-size: 1rem;
}

.stock-metric-index-page__pin:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 這一頁是目錄不是資料表，所以版面要讀起來像一份清單。三件事（2026-09-26「它看起來有點隨便」
   「間距甚麼的」）：

   1. 區塊之間要看得出來是分開的段落。原本上一張表的最後一列直接貼著下一個問句，七段連成一片。
   2. 答句貼著它自己的問句。上下等距會讓它讀起來像一個獨立段落，而不是那個問題的回答。
   3. 指標名那一欄貼齊內容寬度。原本它吃掉 35% 版面，說明從畫面中央才開始，眼睛每一列都要跳一大段。

   右邊空出來的位置是留的，不是浪費：之後要在這裡放自選的勾選與排序控制（「以後是要讓用戶自選要呈現
   甚麼指標的…比如甚麼指標要放前面 哪個區塊放前面」）。所以這裡不把表格收窄——收窄了之後那些控制項
   就沒有地方放，等於改兩次。 */
.stock-metric-index-page :deep(.stock-question-section) {
  /* .stock-page-section 是 column flex，預設 gap 24px——子元素的 margin 是「加在 gap 上」而不是取代
     它，所以只調 margin 會量到 4px 卻顯示 28px。要縮就得縮 gap。全站禁負 margin，這是唯一的槓桿。 */
  gap: 8px;
  margin-bottom: 48px;
}

.stock-metric-index-page :deep(.stock-question-section:last-of-type) {
  margin-bottom: 0;
}

.stock-metric-index-page :deep(.stock-answer) {
  /* gap 8 ＋ 這裡的 12 ＝ 答句與表格之間 20px，答句與問句之間 8px。答句要貼著它回答的那個問題。 */
  margin-bottom: 12px;
}

.stock-metric-index-page :deep(.seo-table th[scope='row']) {
  width: 1%;
  white-space: nowrap;
  padding-right: 32px;
}

/* 手機上名稱與說明改成上下兩行：並排時說明只剩十幾個字寬，每一列都會斷成三四行。 */
@media (max-width: 600px) {
  /* 表格本身也要脫離表格排版，否則 table-layout 仍會用內容算出一個比容器寬的寬度，說明就被
     SharedTableScroll 橫向捲走、右邊被切掉（實測：手機上「把 ROE 拆成三塊，看賺錢靠的是本業、週轉，
     還是借錢」只看得到前半）。儲存格改 block 不夠，table／tbody／tr 都要改。 */
  .stock-metric-index-page :deep(.seo-table),
  .stock-metric-index-page :deep(.seo-table tbody),
  .stock-metric-index-page :deep(.seo-table tr) {
    display: block;
    width: 100%;
  }

  .stock-metric-index-page :deep(.seo-table th[scope='row']) {
    width: auto;
    white-space: normal;
    padding-right: 0;
    padding-bottom: 0;
    border-bottom: 0;
    display: block;
  }

  .stock-metric-index-page :deep(.seo-table td) {
    display: block;
    padding-top: 2px;
    /* 全域的 .seo-table 儲存格是 nowrap（資料表要的是整齊的數字欄），說明文字照抄會被容器裁掉：
       實測手機上「把 ROE 拆成三塊，看賺錢靠的是本業、週轉，還是借錢」只看得到前 13 個字。 */
    white-space: normal;
  }

  /* 拆成兩行之後列數等於翻倍，手機從 3476px 長到 4794px。把列的上下留白收掉一些補回來——名稱與說明
     本來就是同一列的兩半，它們之間不需要跟「列與列之間」一樣的呼吸空間。 */
  .stock-metric-index-page :deep(.seo-table th[scope='row']) {
    padding-top: 10px;
  }

  .stock-metric-index-page :deep(.seo-table td) {
    padding-bottom: 10px;
  }
}
</style>
