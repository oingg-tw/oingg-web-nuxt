<script setup lang="ts">
import { Check, Plus, Search } from '@element-plus/icons-vue'
import type { StockNavNode } from '~/utils/stock-page-nav'
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

// 「這些指標的數字是哪一期的？」那張表（期別對著型錄：負債比率、股價淨值比只有單季；本益比是近四季 EPS）
const PERIOD_RULES = [
  { kind: '損益表上的比率', examples: '毛利率、營業利益率', period: '近四季', reason: '單季會被淡旺季帶著走' },
  { kind: '成長年增率', examples: '營收、淨利', period: '單季，跟去年同一季比', reason: '不跟上一季比：很多產業第四季本來就比第三季旺' },
  { kind: '資產負債表上的數字', examples: '每股淨值、負債比率', period: '每季底那一天', reason: '是結算那一天的快照，沒有「近四季」' },
  { kind: '股價倍數', examples: '本益比、股價淨值比', period: '財報公告那天的收盤價', reason: '不是今天的股價' }
]

const route = useRoute()
const code = computed(() => String(route.params.code))
const { stock, profile, stockShortName, stockPending } = useStockDetailSummary(code)

const { isPinned, isFull, toggle } = useStockPinnedMetrics()
const slugOf = (node: StockNavNode) => node.to!('_').split('/').pop()!

const sections = computed(() =>
  STOCK_METRIC_INDEX.map((group, index) => ({
    id: `stock-metric-group-${index}`,
    label: group.label,
    answer: group.answer ?? null,
    links: group.children ?? []
  }))
)

const totalLinks = computed(() => sections.value.reduce((sum, section) => sum + section.links.length, 0))

// 搜尋（2026-09-28「希望加上一個 search 功能可以搜尋想要的指標」）。
//
// 2026-09-26 的側邊欄計畫寫過「不加搜尋框…知道指標名字的讀者最不需要幫助，等有人真的說找不到再加」。
// 條件到了，所以加。
//
// **有查詢字的時候不展開手風琴，改渲染平鋪清單。** 要在搜尋時展開對應的 <details> 得去寫 DOM 的
// `open`，而那是使用者自己的開合狀態；每打一個字就掃 DOM 去覆寫它，等於把讀者收起來的那幾組
// 硬推開。平鋪也是比較好的搜尋 UX——結果散在十一組裡要自己找。
//
// SSR 時 query 永遠是空字串，所以伺服器渲染出來的一定是手風琴版本、63 個 <a href> 全在原始 HTML
// 裡。check-click-depth.mjs 用 regex 讀原始 HTML、不跑瀏覽器，這一點不能破。
const query = ref('')
// 比對鍵見 utils/search-text.ts（「周轉」也找得到「週轉」，2026-10-23）
const normalizedQuery = computed(() => searchKey(query.value))

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
    const groupHit = searchKey(section.label).includes(q) || searchKey(section.answer ?? '').includes(q)
    for (const link of section.links) {
      const hit = searchKey(link.label).includes(q)
        || searchKey(link.hook ?? '').includes(q)
        || searchKey(link.perspective ?? '').includes(q)
        || slugOf(link).includes(q)
      if (hit) direct.push({ link, group: section.label })
      else if (groupHit) byGroup.push({ link, group: section.label })
    }
  }
  return [...direct, ...byGroup]
})

// 全部母項**預設展開**（2026-09-28，依 docs/2_knowledge 的導航樹研究）。
//
// 上一版是預設收合、桌機在 onMounted 才打開。那份研究直接反對這個形狀，兩個理由：
//   1. **終端層應放寬而非收緊**——讀者到達清單時正處於「急需確認目標」狀態，此時摺疊等於在認知
//      最需要釋放的位置設路障。
//   2. **加寬比加深便宜**（Hick-Hyman 對數 vs 每加一層線性疊加一次完整決策）。實例：16 個經視覺
//      組織的項目放在單層約 4.09b，拆成兩層各 4 個約 4.64b。摺疊是比較貴的形狀。
//
// 那份研究對這個規模的案例給的處方是「**以視覺分組處理，而非另建第二層點擊**」，所以：內容全開、
// 靠分隔線與標題做視覺分組、頂部給一列跳轉索引把「選一次就到位」的 Hick 成本壓成一次對數。
// <details> 保留，摺疊變成讀者可選而不是預設——收起看完的那幾組仍然有用。
//
// SSR 就渲染 open，所以手機桌機一致，也不需要 onMounted 去改 DOM（那一版還得跟 StockPageNav 的
// 斷點保持一致，現在連那個耦合都沒了）。
const { breadcrumbs } = useStockPageSeo({
  code,
  shortName: stockShortName,
  topic: TOPIC,
  titleKeywords: '所有指標按財報科目分組',
  pathSuffix: '/metrics',
  noindex: true,
  stock,
  summary: computed(() => null),
  description: computed(() =>
    clampDescription(
      `${stockShortName.value}（${code.value}）可以查的 ${totalLinks.value} 項財報指標，按 ${sections.value.length} 個財報科目分組：淨值、盈餘、營收、現金流、股利、負債等。每一組再按視角排列，組成、每股、成長率、佔比放在一起，手機上可以逐組展開。`
    )
  ),
  sectorCode: computed(() => profile.value?.sectorCode ?? null)
})
</script>

<template>
  <StockPageShell
    class="stock-metric-index-page"
    :code="code"
    :stock="stock"
    :pending="stockPending"
    :is-emerging="profile?.isEmerging ?? null"
    :short-name="stockShortName"
    :topic="TOPIC"
    :breadcrumbs="breadcrumbs"
    :footer="{ sources: [] }"
  >
    <StockQuestionSection
      id="stock-metric-index"
      :question="`${stockShortName}（${code}）有哪些數字可以看？`"
      :answer="normalizedQuery
        ? `搜尋「${query.trim()}」，${matches.length} 項符合。`
        : `共 ${totalLinks} 項，按財報科目分成 ${sections.length} 組，順序跟著三張報表走。上面的組名可以直接跳過去，或用搜尋找特定指標。`"
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
      <!-- 搜尋結果數唸出來（4.1.3）；答句裡的同一句話不是 live region -->
      <p v-if="normalizedQuery" class="visually-hidden" role="status">{{ matches.length }} 項符合</p>

      <!-- 跳轉索引：一次選擇就到位，Hick 成本是一次對數而不是「捲到找到」。真的 <a href="#…">，
           不靠 JS，爬蟲也讀得到。搜尋中不顯示——那時候結果已經是平鋪的。 -->
      <nav v-if="!normalizedQuery" class="stock-metric-index-page__jump" aria-label="跳到指標分組">
        <a v-for="section in sections" :key="section.id" :href="`#${section.id}`" class="stock-metric-index-page__jump-link">
          {{ section.label }}
        </a>
      </nav>

      <!-- 有查詢字：平鋪的結果表，母項當第一欄。不動手風琴的 open 狀態（見 script 的註解）。 -->
      <template v-if="normalizedQuery">
        <SharedTable v-if="matches.length" :label="`${stockShortName} ${code} 符合「${query.trim()}」的指標`" table-class="stock-metric-index-page__links" :ssr="false">
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
                  v-if="hasPinnableChart(slugOf(match.link))"
                  type="button"
                  class="stock-metric-index-page__pin"
                  :class="{ 'is-pinned': isPinned(slugOf(match.link)) }"
                  :aria-pressed="isPinned(slugOf(match.link))"
                  :aria-label="`${isPinned(slugOf(match.link)) ? '已釘選' : '釘選'}：${match.link.label}`"
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
        </SharedTable>
        <p v-else class="stock-answer">
          找不到「{{ query.trim() }}」。指標名、說明、視角（組成、每股、成長率…）和英文縮寫都可以搜，例如輸入 ROE 或 天數。
        </p>
      </template>

      <!-- 各組一個接一個（中間只有分隔線），包一層才不會吃到段落的間距 -->
      <div class="stock-metric-index-page__groups">
      <details
        v-for="section in sections"
        v-show="!normalizedQuery"
        :id="section.id"
        open
        :key="section.id"
        class="stock-metric-index-page__group app-disclosure"
      >
        <summary>
          <h3 class="stock-metric-index-page__group-title">{{ section.label }}</h3>
        </summary>
        <div class="stock-metric-index-page__group-body">
          <!-- 母項的說明句必須在展開後的 panel 裡，不能塞進 <summary>：11 個 summary × 48px
               ＝ 528px，加上上面的 h2 與答句剛好落在 375×812 扣掉瀏覽器 chrome 與底部導覽列之後的
               預算內。說明句塞進 summary 每列會變 72px，11 列就爆掉。 -->
          <p v-if="section.answer" class="stock-answer">{{ section.answer }}</p>
          <!-- 表頭視覺隱藏：11 段各印一次「指標｜它回答什麼」是純噪音。欄名對輔助技術仍然
               存在，caption 也還在。 -->
          <SharedTable :label="`${stockShortName} ${code} 的${section.label}指標`" table-class="stock-metric-index-page__links">
            <thead class="visually-hidden">
              <tr>
                <th scope="col">指標</th>
                <th scope="col">它回答什麼</th>
                <th scope="col">釘選到側邊欄</th>
              </tr>
            </thead>
            <!-- 視角（組成／每股／佔比…）**不顯示**（2026-09-28「組成 占比 甚麼字眼從 metrics
                 移除」）。欄位本身留在資料裡：它決定同一組裡的撰寫順序，也是搜尋的比對欄位之一，
                 只是不佔畫面。 -->
            <tbody>
              <tr v-for="link in section.links" :key="link.label">
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
                    v-if="hasPinnableChart(slugOf(link))"
                    type="button"
                    class="stock-metric-index-page__pin"
                    :class="{ 'is-pinned': isPinned(slugOf(link)) }"
                    :aria-pressed="isPinned(slugOf(link))"
                    :aria-label="`${isPinned(slugOf(link)) ? '已釘選' : '釘選'}：${link.label}`"
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
          </SharedTable>
        </div>
      </details>
      </div>
    </StockQuestionSection>

    <!-- 「釘選的指標會跟著我的帳號嗎？」一段（含上移／下移排序清單）2026-10-07 依直接指示拿掉。 -->
    <!-- 2026-10-23 從四條條列改成一張表（使用者：「stock-metric-timeframe 這邊也再設計下，現在看起來亂，沒整理過」）：種類｜看哪一期｜為什麼
         三欄對齊，一眼比得出差別。同時改正「比率類（負債比率）預設近四季」：負債比率是資產負債表的時點數字，型錄只有單季 -->
    <StockQuestionSection
      id="stock-metric-timeframe"
      question="這些指標的數字是哪一期的？"
      answer="看指標的性質而定，每一頁自己會寫清楚；共用的規則如下。"
    >
      <SharedTable label="各種指標的數字是哪一期的" table-class="stock-metric-index-page__periods" :ssr="false">
        <thead>
          <tr>
            <th scope="col">指標的種類</th>
            <th scope="col">看哪一期</th>
            <th scope="col">為什麼</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="rule in PERIOD_RULES" :key="rule.kind">
            <th scope="row">{{ rule.kind }}<span class="stock-metric-index-page__period-examples">{{ rule.examples }}</span></th>
            <td>{{ rule.period }}</td>
            <td>{{ rule.reason }}</td>
          </tr>
        </tbody>
      </SharedTable>
    </StockQuestionSection>
  </StockPageShell>
</template>

<style scoped>
/* 56px：el-input 的預設是 32/40px，而本站的觸控底線是 48px——搜尋框是這一頁最先被碰到的控制項，
   給它高於底線的高度。字級同步放大到 1.125rem，不然框變高、字還是原來的大小會顯得空。 */
/* 跟上下的距離由段落的節奏決定（.stock-page-section），這裡不另外留 */
.stock-metric-index-page__search {
  --el-input-height: 56px;
}

.stock-metric-index-page__search :deep(.el-input__wrapper) {
  padding: 0 16px;
}

.stock-metric-index-page__search :deep(.el-input__inner) {
  height: 56px;
  font-size: 1.125rem;
}

.stock-metric-index-page__search :deep(.el-input__prefix) {
  font-size: 1.125rem;
}

/* 搜尋結果列裡的母項名。放在指標名後面而不是另開一欄：手機那個兩欄 grid 只有名稱與說明兩列，
   多一欄就得重排；而讀者要的是「它在哪一組」這個脈絡，不是一個可以排序的欄位。 */
.stock-metric-index-page__match-group {
  margin-left: 8px;
  font-size: 1rem;
  font-weight: 400;
  color: var(--el-text-color-secondary);
}

/* 跳轉索引。chip 高度 ≥44px（站上的觸控底線），換行排列，手機一樣用。
   不顯示項目數（2026-09-28「這個數字對用戶沒意義可以隱藏」）。它原本的用途是「收合狀態下判斷這一組
   值不值得展開」，而同一天改成預設全開之後那個用途就消失了——內容就在下面，數字只是重複一次。 */
.stock-metric-index-page__jump {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.stock-metric-index-page__jump-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 44px;
  padding: 0 14px;
  border: 1px solid var(--el-border-color);
  border-radius: 999px;
  color: var(--el-text-color-primary);
  text-decoration: none;
  font-size: 1rem;
}

.stock-metric-index-page__jump-link:hover {
  border-color: var(--el-color-primary);
  color: var(--el-color-primary);
}

/* 不用 main.css 的 .hub-details（2026-09-28「如果要用類似表格的形式呈現，那就不需要放在卡片中，
   這樣版面更乾淨」）。那一支給的是卡片外觀——外框、圓角、底色、四邊 16px 內距——而這一頁的內容
   本來就是表格，卡片只是多一層框。這裡只留「一條分隔線 + 可點的標題列」，內容齊左貼齊表格。 */
/* 分隔線是全站表格那一條淡的（--app-divider，2026-10-23；原本是元件外框那個 3:1 的深灰）；第一組上面也一條，整串上下對稱 */
.stock-metric-index-page__group {
  border-bottom: 1px solid var(--app-divider);
  /* 跟 StockQuestionSection 同一條：跳轉過來時標題不要被固定頁首蓋住 */
  scroll-margin-top: calc(var(--app-header-height) + var(--app-banner-height) + 16px);
}

.stock-metric-index-page__groups {
  border-top: 1px solid var(--app-divider);
}

/* 標題列（箭頭、44px、hover／focus）是 .app-disclosure（main.css）——2026-10-22 方案頁 1B 起加上箭頭，看得出可以收起來。
   展開的內容：說明句與表格之間 12px，下面留 16px 再接分隔線 */
.stock-metric-index-page__group-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 0 0 16px;
}

.stock-metric-index-page__group-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}

/* 期別表：說明要折行（.seo-table 預設不折），手機才不會整張左右捲；例子在種類下面一行、灰一階 */
.stock-metric-index-page__periods th,
.stock-metric-index-page__periods td {
  white-space: normal;
}

.stock-metric-index-page__period-examples {
  display: block;
  font-weight: 400;
  color: var(--el-text-color-secondary);
}

/* 手機：三欄擠在 343px 裡每格折好幾行，改成每一種兩行——種類（例子接在後面），下一行是看哪一期（粗）與為什麼。表頭只是看不見，
   報讀照舊有欄名 */
@media (max-width: 600px) {
  .stock-metric-index-page__periods thead {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }

  /* <table> 是 SharedTable 畫的，對表格本身要用 :deep（從帶著這一頁屬性的卡片往下找）；tbody／tr 是這一頁的插槽內容，直接寫就好 */
  :deep(.stock-metric-index-page__periods),
  .stock-metric-index-page__periods tbody {
    display: block;
  }

  .stock-metric-index-page__periods tr {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 4px 12px;
    padding: 10px 16px;
    border-bottom: 1px solid var(--app-divider);
  }

  .stock-metric-index-page__periods tr:last-child {
    border-bottom: 0;
  }

  .stock-metric-index-page__periods th,
  .stock-metric-index-page__periods td {
    padding: 0;
    border: 0;
  }

  .stock-metric-index-page__periods th[scope='row'] {
    grid-column: 1 / -1;
    position: static;
    background: transparent;
  }

  .stock-metric-index-page__period-examples {
    display: inline;
    margin-left: 8px;
  }

  .stock-metric-index-page__periods td:first-of-type {
    font-weight: 600;
  }

  .stock-metric-index-page__periods td:last-of-type {
    color: var(--el-text-color-regular);
  }
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
  /* 擋換行要寫在按鈕上，不能只靠 .pin-cell。這一頁為了讓說明文字換行加了
     `:deep(.seo-table td) { white-space: normal }`，特異性 0,2,0 高過 .pin-cell 的 0,1,0，而釘選格
     本身就是一個 td——結果「已釘選」在 88px 的按鈕裡折成兩行，那一列跟著變高（實測 65px vs 48px）。
     min-width 是地板不是天花板，所以 nowrap 之後按鈕會自己長到裝得下。 */
  white-space: nowrap;
  gap: 6px;
  /* ≥48px 是本站的觸控底線，比 WCAG 的 24×24 高。 */
  min-height: 48px;
  /* 104px 是「✓ 已釘選」量到的寬度（比「＋ 釘選」多一個字）。兩個狀態都用它，否則按下去按鈕會從
     88 長到 104、整欄跟著跳一下。手機是純圖示 48×48，下面的 media query 會蓋掉這個值。 */
  min-width: 104px;
  padding: 0 16px;
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  background: var(--el-fill-color-blank);
  color: var(--el-text-color-primary);
  font-size: 1rem;
  cursor: pointer;
}

/* hover 要排除已釘選的狀態。第一版只寫 `:hover:not(:disabled)`，特異性 0,3,0 蓋過 .is-pinned 的
   0,1,0，於是把白字改成強調色——而底色仍然是 .is-pinned 的強調色，**金字印在金底上，對比 1.00**
   （實測 rgb(138,104,35) on rgb(138,104,35)，文字整個消失）。
   已釘選的 hover 改成加深底色，字維持白的。 */
.stock-metric-index-page__pin:hover:not(:disabled):not(.is-pinned) {
  border-color: var(--el-color-primary);
  color: var(--el-color-primary);
}

.stock-metric-index-page__pin.is-pinned:hover:not(:disabled) {
  background: var(--el-color-primary-dark-2);
  border-color: var(--el-color-primary-dark-2);
}

.stock-metric-index-page__pin.is-pinned {
  background: var(--el-color-primary);
  border-color: var(--el-color-primary);
  color: var(--app-on-primary);
}

.stock-metric-index-page__pin-icon {
  font-size: 1rem;
}

.stock-metric-index-page__pin:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 指標清單（搜尋結果與各組的表，.stock-metric-index-page__links）自己的版面。只寫這個 class，不寫 .seo-table：原本寫的是整個
   .seo-table，2026-10-23 加的期別表也被改成兩欄格子、手機上整張散掉。
   全域的 .seo-table 把每一格設成 white-space: nowrap（數字欄要的就是那個），在這一頁會把說明文字切掉，只在這裡覆寫。 */
.stock-metric-index-page__links td,
.stock-metric-index-page__links th[scope='row'] {
  white-space: normal;
}

.stock-metric-index-page__links th[scope='row'] {
  width: 1%;
  white-space: nowrap;
  padding-right: 32px;
}

/* 段落裡的間距（標題、答句、搜尋框、跳轉、表格）是全站問句段落的節奏（main.css 的 .stock-page-section），2026-10-23 拿掉這一頁
   自己的覆寫（gap 8px、答句下 12px）：同一頁上下兩段距離不一樣，使用者：「間距甚麼的似是隨意」 */

/* 手機：整列改成兩欄 grid，釘選鈕跨兩列擺右邊。
   改版前這裡只把 table/tr/td 設成 display: block，而 .pin-cell 一條覆寫都沒有，於是那顆
   88×48 的按鈕變成獨立的一整橫列——量到的列高 132px，六成是它造成的。 */
@media (max-width: 600px) {
  :deep(.stock-metric-index-page__links),
  .stock-metric-index-page__links tbody {
    display: block;
    width: 100%;
  }

  /* 列與列之間的線是全站表格那一條淡的；左右 16px 跟卡片邊切齊 */
  .stock-metric-index-page__links tr {
    display: grid;
    grid-template-columns: 1fr 48px;
    grid-template-areas: 'name pin' 'hook pin';
    align-items: center;
    column-gap: 8px;
    padding: 6px 12px 6px 16px;
    border-bottom: 1px solid var(--app-divider);
  }

  .stock-metric-index-page__links tr:last-child {
    border-bottom: 0;
  }

  .stock-metric-index-page__links th[scope='row'] {
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

  /* 圖示按鈕：觸控面積 44×44，文字進 aria-label。文字節點留著只是被藏起來，不是移除。
     沒有框（2026-10-22，使用者：「手機版本 個股 指標總覽 看起來髒髒的 有不必要的裝飾」，方案頁選 1B）：只剩 ＋，已釘選是實心圓裡的 ✓ */
  .stock-metric-index-page__pin,
  .stock-metric-index-page__pin.is-pinned,
  .stock-metric-index-page__pin.is-pinned:hover:not(:disabled) {
    min-width: 44px;
    width: 44px;
    min-height: 44px;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--el-color-primary);
  }

  .stock-metric-index-page__pin .stock-metric-index-page__pin-icon {
    width: 26px;
    height: 26px;
    border-radius: 999px;
  }

  .stock-metric-index-page__pin.is-pinned .stock-metric-index-page__pin-icon {
    background: var(--el-color-primary);
    color: var(--app-on-primary);
  }

  /* 拿掉框線、底線與底色（1B）：表格不另塗底色、一列只留 tr 那一條線（原本 td 自己的線跟它錯開成兩條，沒有釘選鈕的那一列剩一小段），
     名稱用主色加粗表示可以點、不加底線（整頁是一份連結清單） */
  :deep(.stock-metric-index-page__links),
  .stock-metric-index-page__links th[scope='row'] {
    background: transparent;
  }

  .stock-metric-index-page__links td {
    border-bottom: 0;
  }

  .stock-metric-index-page__links .seo-table__link {
    font-weight: 600;
    text-decoration: none;
  }

  /* 分組跳轉：三欄的文字連結，不是 11 顆有框的膠囊 */
  .stock-metric-index-page__jump {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0 8px;
  }

  .stock-metric-index-page__jump-link {
    padding: 0;
    border: 0;
    border-radius: 0;
    color: var(--el-color-primary-dark-2);
    font-weight: 600;
  }

  .stock-metric-index-page__pin-text {
    display: none;
  }

  /* 全域讓 .seo-table 的第一個 th 黏在左邊（寬資料表要的），目錄頁不需要，而且 th 在這裡已經是
     display: block，黏著本來就失效。明寫出來免得以後有人以為它還在作用。 */
  .stock-metric-index-page__links tbody th:first-child {
    position: static;
  }
}
</style>
