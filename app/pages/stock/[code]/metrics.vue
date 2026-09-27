<script setup lang="ts">
import { Check, Plus, Search } from '@element-plus/icons-vue'
import type { StockNavNode } from '~/utils/stock-page-nav'
import { STOCK_METRIC_INDEX } from '~/utils/stock-page-nav'

// /stock/{code}/metrics — 這檔股票的指標目錄。
//
// 2026-09-27 改版（「先捨棄『這家公司賺不賺錢？』這種分類…以淨值為母項，底下再區分出 組成 成長率
// 每股 每股成長率 等等」「這版本手機版是壞掉的，所以新版本希望確實的 Mobile First 去設計」）。
//
// ## 手機壞在哪（量的，不是推的）
//
// 改版前 375px 下 `document.scrollHeight = 11,514px`，約 14 個螢幕。62 列、每列 **132px**。沒有
// 橫向捲動——壞的不是版面溢出，是長度。132px 的成因有二：
//   1. `@media (max-width: 600px)` 把 table/tr/td 全改成 display: block，三格垂直堆疊
//   2. **`.pin-cell` 在那個 media query 裡一條覆寫都沒有**，還留著 width: 1% / nowrap / 靠右，
//      於是 88×48 的按鈕獨佔一整行
//
// 這一版：11 個母項預設收合，列改成兩欄 grid（名稱與說明各一行，釘選鈕 48×48 跨兩列擺右邊）。
//
// ## 手風琴為什麼是原生 <details>
//
// 重用 main.css 既有的 `.hub-details`（index.vue 與 industry/[sector].vue 已在用），它的註解自己
// 寫明「收合狀態也完整在 SSR HTML 裡，爬蟲與 check-click-depth.mjs 的 regex 兩種狀態都讀得到」。
// 這是整個選型的唯一理由：**check-click-depth.mjs 用 regex 讀原始 HTML、不跑瀏覽器**，而這一頁是
// 那 60 幾頁唯一的集中入口。SharedExpandToggle 的內容是 v-if，收合時連結根本不在 HTML 裡，會直接
// 斷鏈；el-collapse 同樣的問題再加一組 role="button" 的 div。
//
// ## 問句 <h2> 為什麼還在
//
// 捨棄的是**用問句當分類名**，不是頁面上不能有問句。站台檢查要求每頁至少三個結尾為「？」的 <h2>
// （check-stock-pages.mjs:106,136），而下面這三段都是這一頁本來就欠讀者的答案：目錄本身、釘選會不會
// 跟著帳號、以及這些數字是哪一期的（最後一段是 60 幾頁共用的規則，現在散在每一頁的開頭句、沒有一處
// 總說）。母項標題降為 <h3> 放在 <summary> 裡，大綱是 h1 → h2×3 → h3×11。
//
// **noindex, follow；不進 sitemap，只進 check-stock-pages.mjs 的 FIXED_ROUTES。** 這一頁每一檔
// 股票的 body 一字不差，唯一的差別是公司名——2339 個內容相同的 URL 進 sitemap 是典型的薄內容。
// 走站上既有的「可達但不宣傳」拆法。要改成收錄的話，把 '/metrics' 加進
// server/api/__sitemap__/stocks.get.ts 的 INDEXABLE_SUFFIXES 就好，一行。
const TOPIC = '指標總覽'

const route = useRoute()
const code = computed(() => String(route.params.code))
const { stock, profile, stockShortName, stockPending, isFavorite, toggleFavorite } = useStockDetailSummary(code)

const { pinnedSlugs, isPinned, isFull, toggle } = useStockPinnedMetrics()
const slugOf = (node: StockNavNode) => node.to!('_').split('/').pop()!

// 視角分群：**相鄰分群，不排序**。資料若沒照 MetricPerspective 的宣告順序寫，結果是同一個視角標題
// 出現兩次——看得見、無害、改資料就好，不值得為它寫防禦性程式碼。
const groupsOf = (links: StockNavNode[]) =>
  links.reduce<{ perspective: string; links: StockNavNode[] }[]>((acc, link) => {
    const last = acc.at(-1)
    if (last && last.perspective === link.perspective) last.links.push(link)
    else acc.push({ perspective: link.perspective ?? '', links: [link] })
    return acc
  }, [])

const sections = computed(() =>
  STOCK_METRIC_INDEX.map((group, index) => ({
    id: `stock-metric-group-${index}`,
    label: group.label,
    answer: group.answer ?? null,
    links: group.children ?? [],
    groups: groupsOf(group.children ?? [])
  }))
)

const totalLinks = computed(() => sections.value.reduce((sum, section) => sum + section.links.length, 0))

// 搜尋（2026-09-28「希望加上一個 search 功能可以搜尋想要的指標」）。
//
// 2026-09-26 的側邊欄計畫寫過「不加搜尋框…知道指標名字的讀者最不需要幫助，等有人真的說找不到再加」。
// 條件到了，所以加。
//
// **有查詢字的時候不展開手風琴，改渲染平鋪清單。** 要在搜尋時展開對應的 <details> 得去寫 DOM 的
// `open`，而那是這一頁刻意只在 onMounted 做一次的事（見上面的註解）；每打一個字就掃 DOM 會把那個
// 單次動作變成持續的副作用。平鋪也是比較好的搜尋 UX——結果散在十一個手風琴裡要自己找。
//
// SSR 時 query 永遠是空字串，所以伺服器渲染出來的一定是手風琴版本、63 個 <a href> 全在原始 HTML
// 裡。check-click-depth.mjs 用 regex 讀原始 HTML、不跑瀏覽器，這一點不能破。
const query = ref('')
const normalizedQuery = computed(() => query.value.trim().toLowerCase())

// 比對六個欄位：label、hook、視角、母項名、母項說明句、slug。
//
// slug 在裡面是為了讓「roe」「bvps」這種英文縮寫打得到——中文名叫「股東權益報酬率」，但讀者會打 ROE。
// 母項說明句在裡面是實測補的：「稀釋」這兩個字只出現在盈餘與淨值兩組的說明句裡，不在任何 label 或
// hook，而搜尋那兩個字的人要找的正是那兩組的成長率頁。
const matches = computed(() => {
  const q = normalizedQuery.value
  if (!q) return []
  // 兩級比對。直接命中（指標自己的名字、說明、視角、slug）排前面，母項層級命中（組名或組的說明句）
  // 排後面——後者會讓整組的成員都算命中，不分開排的話一個常見字就會把一整組推到最前面，把真正
  // 打中名字的那一項淹掉。實測：「現金」直接命中 4 項、整組命中 11 項；「稀釋」只有整組命中。
  const direct: { link: StockNavNode; group: string }[] = []
  const byGroup: { link: StockNavNode; group: string }[] = []
  for (const section of sections.value) {
    const groupHit = section.label.toLowerCase().includes(q) || (section.answer ?? '').includes(q)
    for (const link of section.links) {
      const hit = link.label.toLowerCase().includes(q)
        || (link.hook ?? '').toLowerCase().includes(q)
        || (link.perspective ?? '').includes(q)
        || slugOf(link).includes(q)
      if (hit) direct.push({ link, group: section.label })
      else if (groupHit) byGroup.push({ link, group: section.label })
    }
  }
  return [...direct, ...byGroup]
})

// 桌機預設全開。直接寫 DOM 的 `open` 屬性而不是綁 `:open`：釘選會改 reactive 狀態、因此會重新
// render，綁了 `:open` 又沒同時接管 `@toggle` 的話，使用者關掉的母項會在下次 render 被重新打開。
// `open` 是 UA 狀態、Vue 不擁有它，所以這裡沒有真正的衝突。
//
// 斷點跟 StockPageNav.vue / layouts/default.vue 同一條（含平板橫向）——那邊的註解寫明「八處必須
// 一致」。SSR 不知道視寬，所以這件事只能在 onMounted 做；不能在 render 時依 isWide 選 markup，那是
// 2026-09-19 記錄在案不能再犯的錯（cookie-less layout swap）。
const root = ref<HTMLElement | null>(null)
onMounted(() => {
  if (!window.matchMedia('(min-width: 1280px), (min-width: 1024px) and (orientation: landscape)').matches) return
  root.value?.querySelectorAll('details').forEach(el => { el.open = true })
})

const { breadcrumbs } = useStockPageSeo({
  code,
  shortName: stockShortName,
  topic: TOPIC,
  titleKeywords: '全部指標，按財報科目分組',
  pathSuffix: '/metrics',
  noindex: true,
  stock,
  summary: computed(() => null),
  description: computed(() =>
    clampDescription(
      `${stockShortName.value}（${code.value}）可以查的 ${totalLinks.value} 項財報指標，按 ${sections.value.length} 個財報科目分組：淨值、盈餘、營收、現金流、股利、負債等。每一組再按視角排列，組成、每股、成長率、佔比放在一起，手機上可以逐組展開。`
    )
  ),
  sectorCode: computed(() => profile.value?.industry ?? null)
})
</script>

<template>
  <div ref="root" v-loading="stockPending" class="stock-metric-index-page">
    <template v-if="stock">
      <StockSummaryCard :stock="stock" :is-favorite="isFavorite" :short-name="stockShortName" :topic="TOPIC" @toggle-favorite="toggleFavorite" />
      <StockPageNav :code="code" />
      <StockBreadcrumb :items="breadcrumbs" />

      <StockQuestionSection
        id="stock-metric-index"
        :question="`${stockShortName}（${code}）有哪些數字可以看？`"
        :answer="normalizedQuery
          ? `搜尋「${query.trim()}」，${matches.length} 項符合。`
          : `共 ${totalLinks} 項，按財報科目分成 ${sections.length} 組。同一個科目的不同看法排在一起——組成、每股、成長率、佔比。`"
      >
        <!-- aria-label 是必要的，不是保險：el-input 的 placeholder 不構成可及名稱。 -->
        <el-input
          v-model="query"
          class="stock-metric-index-page__search"
          clearable
          placeholder="搜尋指標，例如 ROE、天數、每股"
          aria-label="搜尋指標名稱或說明"
        >
          <template #prefix>
            <el-icon aria-hidden="true"><Search /></el-icon>
          </template>
        </el-input>

        <!-- 有查詢字：平鋪的結果表，母項當第一欄。不動手風琴的 open 狀態（見 script 的註解）。 -->
        <template v-if="normalizedQuery">
          <SharedTableScroll v-if="matches.length" label="搜尋結果">
            <table class="seo-table">
              <caption class="visually-hidden">符合「{{ query.trim() }}」的指標</caption>
              <thead class="visually-hidden">
                <tr>
                  <th scope="col">指標</th>
                  <th scope="col">它回答什麼</th>
                  <th scope="col">釘選到側邊欄</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="match in matches" :key="match.link.label">
                  <th scope="row">
                    <NuxtLink :to="match.link.to!(code)" class="seo-table__link">{{ match.link.label }}</NuxtLink>
                    <span class="stock-metric-index-page__match-group">{{ match.group }}</span>
                  </th>
                  <td class="stock-metric-index-page__hook">{{ match.link.hook }}</td>
                  <td class="stock-metric-index-page__pin-cell">
                    <button
                      type="button"
                      class="stock-metric-index-page__pin"
                      :class="{ 'is-pinned': isPinned(slugOf(match.link)) }"
                      :aria-pressed="isPinned(slugOf(match.link))"
                      :aria-label="`${isPinned(slugOf(match.link)) ? '取消釘選' : '釘選'} ${match.link.label} 到側邊欄`"
                      :disabled="!isPinned(slugOf(match.link)) && isFull"
                      @click="toggle(slugOf(match.link))"
                    >
                      <el-icon class="stock-metric-index-page__pin-icon" aria-hidden="true">
                        <component :is="isPinned(slugOf(match.link)) ? Check : Plus" />
                      </el-icon><span class="stock-metric-index-page__pin-text">{{ isPinned(slugOf(match.link)) ? '已釘選' : '釘選' }}</span>
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </SharedTableScroll>
          <p v-else class="stock-answer">
            找不到「{{ query.trim() }}」。指標名、說明、視角（組成、每股、成長率…）和英文縮寫都可以搜，例如輸入 ROE 或 天數。
          </p>
        </template>

        <details
          v-for="section in sections"
          v-show="!normalizedQuery"
          :id="section.id"
          :key="section.id"
          class="hub-details stock-metric-index-page__group"
        >
          <summary>
            <h3 class="stock-metric-index-page__group-title">{{ section.label }}</h3>
            <span class="stock-metric-index-page__group-count">{{ section.links.length }}</span>
          </summary>
          <div>
            <!-- 母項的說明句必須在展開後的 panel 裡，不能塞進 <summary>：11 個 summary × 48px
                 ＝ 528px，加上上面的 h2 與答句剛好落在 375×812 扣掉瀏覽器 chrome 與底部導覽列之後的
                 預算內。說明句塞進 summary 每列會變 72px，11 列就爆掉。 -->
            <p v-if="section.answer" class="stock-answer">{{ section.answer }}</p>
            <SharedTableScroll :label="`${section.label}的指標`">
              <table class="seo-table" data-ssr-table>
                <caption class="visually-hidden">{{ section.label }}這一組的指標，以及每一項回答什麼</caption>
                <!-- 表頭視覺隱藏：11 段各印一次「指標｜它回答什麼」是純噪音。欄名對輔助技術仍然
                     存在，caption 也還在。 -->
                <thead class="visually-hidden">
                  <tr>
                    <th scope="col">指標</th>
                    <th scope="col">它回答什麼</th>
                    <th scope="col">釘選到側邊欄</th>
                  </tr>
                </thead>
                <!-- 一個視角一個 tbody。單一視角的母項（業外損益、現金流、股價的倍數、原始財報）
                     不渲染標題列——那一列不帶任何資訊。 -->
                <tbody v-for="group in section.groups" :key="group.perspective">
                  <tr v-if="section.groups.length > 1" class="stock-metric-index-page__perspective">
                    <th scope="rowgroup" colspan="3">{{ group.perspective }}</th>
                  </tr>
                  <tr v-for="link in group.links" :key="link.label">
                    <th scope="row">
                      <NuxtLink :to="link.to!(code)" class="seo-table__link">{{ link.label }}</NuxtLink>
                    </th>
                    <td class="stock-metric-index-page__hook">{{ link.hook }}</td>
                    <!-- 真的 <button>、aria-pressed 表達開關狀態、可及名稱帶上指標名——一整欄
                         60 幾個都叫「釘選」的話，用螢幕閱讀器逐項瀏覽時分不出在釘哪一支。
                         手機上文字被 CSS 藏起來，可及名稱仍然完整（來自 aria-label 不是文字節點）。

                         不用 Star：StockSummaryCard 右上角的「已加最愛」已經用星號代表自選股，
                         同一頁兩種星號兩種意思會混淆。加號是「加到側邊欄」，打勾是「已經在那裡了」。 -->
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
                        <el-icon class="stock-metric-index-page__pin-icon" aria-hidden="true">
                          <component :is="isPinned(slugOf(link)) ? Check : Plus" />
                        </el-icon><span class="stock-metric-index-page__pin-text">{{ isPinned(slugOf(link)) ? '已釘選' : '釘選' }}</span>
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </SharedTableScroll>
          </div>
        </details>
      </StockQuestionSection>

      <StockQuestionSection
        id="stock-metric-pinning"
        question="釘選的指標會跟著我的帳號嗎？"
        :answer="`會，登入的話。目前釘了 ${pinnedSlugs.length} / ${PINNED_METRIC_LIMIT} 個，釘選的順序就是側邊欄的順序。`"
      >
        <p class="stock-answer">
          上限 {{ PINNED_METRIC_LIMIT }} 個不是為了省儲存空間，是為了讓側邊欄維持是側邊欄——它固定四列，再加十二列就已經是手機底部抽屜裝不下的長度。沒有登入也可以釘，但只存在這個分頁裡，重新整理就沒了。
        </p>
      </StockQuestionSection>

      <StockQuestionSection
        id="stock-metric-timeframe"
        question="這些指標的數字是哪一期的？"
        answer="看指標的性質而定，每一頁自己會寫清楚，這裡先講共用的規則。"
      >
        <ul class="stock-metric-index-page__note-list">
          <li>比率類（毛利率、負債比率等）預設看近四季合計，因為單季會被淡旺季帶著走。</li>
          <li>成長年增率一律是單季對去年同一季，不是跟上一季比——很多產業第四季本來就比第三季旺。</li>
          <li>資產負債表的數字（每股淨值、負債比率）是每季結算那一天的快照，沒有「近四季」這個概念。</li>
          <li>倍數類（本益比、股價淨值比）用的是財報公告那天的收盤價，不是今天的股價。</li>
        </ul>
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
.stock-metric-index-page__search {
  margin-bottom: 16px;
}

/* 搜尋結果列裡的母項名。放在指標名後面而不是另開一欄：手機那個兩欄 grid 只有名稱與說明兩列，
   多一欄就得重排；而讀者要的是「它在哪一組」這個脈絡，不是一個可以排序的欄位。 */
.stock-metric-index-page__match-group {
  margin-left: 8px;
  font-size: 0.9375rem;
  font-weight: 400;
  color: var(--el-text-color-secondary);
}

.stock-metric-index-page__group + .stock-metric-index-page__group {
  margin-top: 8px;
}

.stock-metric-index-page__group-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}

/* 母項的項目數。不是裝飾——收合狀態下它是唯一能讓讀者判斷「這一組值不值得展開」的線索。 */
.stock-metric-index-page__group-count {
  margin-left: auto;
  font-weight: 400;
  color: var(--el-text-color-secondary);
  font-variant-numeric: tabular-nums;
}

.stock-metric-index-page__perspective th {
  padding-top: 16px;
  font-size: 0.9375rem;
  color: var(--el-text-color-secondary);
  font-weight: 600;
}

.stock-metric-index-page__note-list {
  margin: 0;
  padding-left: 1.5em;
  display: flex;
  flex-direction: column;
  gap: 8px;
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
  /* ≥48px 是本站的觸控底線，比 WCAG 的 24×24 高。 */
  min-height: 48px;
  min-width: 88px;
  padding: 0 16px;
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  background: var(--el-fill-color-blank);
  color: var(--el-text-color-primary);
  font-size: 1rem;
  cursor: pointer;
}

.stock-metric-index-page__pin:hover:not(:disabled) {
  border-color: var(--el-color-primary);
  color: var(--el-color-primary);
}

.stock-metric-index-page__pin.is-pinned {
  background: var(--el-color-primary);
  border-color: var(--el-color-primary);
  color: #fff;
}

.stock-metric-index-page__pin-icon {
  font-size: 1rem;
}

.stock-metric-index-page__pin:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 全域的 .seo-table 把每一格設成 white-space: nowrap（數字欄要的就是那個），在這一頁會把說明文字
   切掉。不改全域——41 處 data-ssr-table 在吃它——只在這一頁覆寫。 */
:deep(.seo-table td),
:deep(.seo-table th[scope='row']) {
  white-space: normal;
}

:deep(.seo-table th[scope='row']) {
  width: 1%;
  white-space: nowrap;
  padding-right: 32px;
}

:deep(.stock-question-section) {
  gap: 8px;
}

:deep(.stock-answer) {
  margin-bottom: 12px;
}

/* 手機：整列改成兩欄 grid，釘選鈕跨兩列擺右邊。
   改版前這裡只把 table/tr/td 設成 display: block，而 .pin-cell 一條覆寫都沒有，於是那顆
   88×48 的按鈕變成獨立的一整橫列——量到的列高 132px，六成是它造成的。 */
@media (max-width: 600px) {
  .seo-table,
  .seo-table tbody {
    display: block;
    width: 100%;
  }

  .seo-table tr {
    display: grid;
    grid-template-columns: 1fr 48px;
    grid-template-areas: 'name pin' 'hook pin';
    align-items: center;
    column-gap: 8px;
    padding: 6px 0;
    border-bottom: 1px solid var(--el-border-color-lighter);
  }

  /* 視角標題列只有一格，不吃上面那個兩欄版面 */
  .seo-table tr.stock-metric-index-page__perspective {
    display: block;
    border-bottom: 0;
    padding-bottom: 0;
  }

  :deep(.seo-table th[scope='row']) {
    grid-area: name;
    display: block;
    width: auto;
    white-space: normal;
    padding: 0;
    border-bottom: 0;
  }

  .stock-metric-index-page__hook {
    grid-area: hook;
    display: block;
    padding: 2px 0 0;
    white-space: normal;
  }

  .stock-metric-index-page__pin-cell {
    grid-area: pin;
    display: block;
    width: auto;
    text-align: center;
    white-space: normal;
    padding: 0;
  }

  /* 圖示按鈕：觸控面積維持 48×48，文字進 aria-label。文字節點留著只是被藏起來，不是移除。 */
  .stock-metric-index-page__pin {
    min-width: 48px;
    width: 48px;
    padding: 0;
  }

  .stock-metric-index-page__pin-text {
    display: none;
  }

  /* 全域讓 .seo-table 的第一個 th 黏在左邊（寬資料表要的），目錄頁不需要，而且 th 在這裡已經是
     display: block，黏著本來就失效。明寫出來免得以後有人以為它還在作用。 */
  :deep(.seo-table tbody th:first-child) {
    position: static;
  }
}
</style>
