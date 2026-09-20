<script setup lang="ts">
// 亮點與風險 — 破格排版試作版（2026-09-20）。A/B 比較用的實驗頁，不是正式頁面：直接對照
// /stock/{code} 上現行的 StockFinancialHighlightsRisksCard（一張分組表格）。
//
// 依據兩份文件實作：
//   docs/0_researches/退休族群數位介面的破格排版工程與資訊架構實踐.md  → 版面
//   docs/3_audiences/前端工程師/個股瀏覽/亮點與風險總覽.md              → 內容與合規
//
// ⚠ 兩份文件在這一頁上直接衝突：內容文件第 4 節明寫「本頁三區塊為並排卡片網格，**不適用**
// 破格排版」。這頁是使用者指定要做的對照實驗，刻意違反那一條以便實際比較，不是沒看到。
// 若比較後決定採用，第 4 節需要一併修訂（那份文件在別的 repo，不由這裡改）。
//
// 版面遵守破格文件的「雙層解耦」：裝飾層（.lab-hr__decor）全部 aria-hidden + pointer-events:
// none，破格只發生在那一層；功能層維持 DOM 順序＝閱讀順序，沒有用 CSS order／絕對定位搬動
// 任何內容（WCAG 1.3.2／2.4.3）。所有位移用 rem/clamp()，不用純 vw，避免 200% 放大時錯位
// 重疊（該文件第 109–111 行點名的崩潰來源）。
//
// 內容遵守合規文件：分類只呈現 N/M 計數、不加形容詞、不跨分類加總、市場評價獨立第三區且只給
// 百分位（第 1.2 節：高分位是好是壞取決於投資風格，歸類即替使用者選邊）。
useSeoMeta({ title: '亮點與風險：破格排版試作 — 內部比較用', robots: 'noindex, nofollow' })

const codeInput = ref('2330')
const code = ref('2330')
function applyCode() {
  const next = codeInput.value.trim()
  if (/^\d{4}$/.test(next)) code.value = next
}

const { stock, stockShortName, stockPending } = useStockDetailSummary(code)
// 同 /stock/[code]/index.vue：目錄先 await 一次，避免多個子元件同時打同一把 key（見
// feedback_useasyncdata_shared_key_race）。
await useFilterSchema()
const { digest, series } = await useStockPageDigest(code, 'index', { shortName: stockShortName })

// 市場評價的 categoryKey（guru-badges.ts 的 METRIC_CATEGORY_KEY_TO_DISPLAY: valuation → 市場評價）。
// 這一類不進亮點/風險，理由見檔頭引用的合規文件第 1.2 節。
const VALUATION_KEY = 'valuation'

interface CategoryCount {
  key: string
  name: string
  passed: number
  total: number
}

// 只算「已評定」的徽章：passed === null 是「這家公司沒有這項資料」，既不是通過也不是未通過，
// 計入分母會讓 N/M 讀起來像未通過（同 StockFinancialHighlightsRisksCard 的 null 處理紀律）。
const categories = computed<CategoryCount[]>(() =>
  (series.value?.badges?.categories ?? [])
    .map(category => {
      const evaluated = category.badges.filter(badge => badge.passed !== null)
      return {
        key: category.categoryKey,
        name: category.categoryDisplayName || category.categoryKey,
        passed: evaluated.filter(badge => badge.passed === true).length,
        total: evaluated.length
      }
    })
    .filter(category => category.total > 0)
)

// 合規文件第 1.1 節：達標計數 ≥ 分母的一半歸亮點，否則歸風險；全站統一，不逐檔調整邊界。
// 0/N 與 N/N 兩個極端不做特殊處理。
const scored = computed(() => categories.value.filter(category => category.key !== VALUATION_KEY))
const highlights = computed(() => scored.value.filter(category => category.passed * 2 >= category.total))
const risks = computed(() => scored.value.filter(category => category.passed * 2 < category.total))
const valuation = computed(() => categories.value.find(category => category.key === VALUATION_KEY) ?? null)

// 第 5 節：計數同時給一句文字化描述，螢幕閱讀器與 SEO 共用。用阿拉伯數字而非國字，資訊等價
// 而少一層轉換程式碼。
function countLabel(category: CategoryCount): string {
  return `${category.name}，${category.total} 項指標中通過 ${category.passed} 項`
}

// 市場評價區塊：只拿百分位，不拿通過與否。bandLabel 是統計區間描述（「最高20%區間」），不是
// 方向詞——第 2 節禁止的是「偏高」「相對貴」這類評價語，實測目前的 bandLabel 不含那些字。
const valuationRows = computed(() => digest.value?.percentiles ?? [])

const hasData = computed(() => !stockPending.value && categories.value.length > 0)
</script>

<template>
  <div class="lab-hr">
    <!-- 裝飾層：破格只發生在這裡。aria-hidden + pointer-events:none，輔助技術完全略過，
         點擊也不會被這層攔截（破格文件第 35 行的硬性要求）。 -->
    <div class="lab-hr__decor" aria-hidden="true">
      <span class="lab-hr__decor-block lab-hr__decor-block--a" />
      <span class="lab-hr__decor-block lab-hr__decor-block--b" />
    </div>

    <header class="lab-hr__head">
      <h1 class="lab-hr__title">亮點與風險：破格排版試作</h1>
      <p class="lab-hr__note">
        這是比較用的實驗頁。現行版本在
        <NuxtLink :to="`/stock/${code}`" class="lab-hr__inline-link">/stock/{{ code }}</NuxtLink>
        的「財報亮點與風險」區塊，兩邊資料來源相同。
      </p>

      <div class="lab-hr__picker">
        <label class="lab-hr__picker-label" for="lab-hr-code">股票代號</label>
        <input
          id="lab-hr-code"
          v-model="codeInput"
          class="lab-hr__picker-input"
          inputmode="numeric"
          maxlength="4"
          @keyup.enter="applyCode"
        >
        <button type="button" class="lab-hr__picker-button" @click="applyCode">套用</button>
      </div>
    </header>

    <p v-if="stockPending" class="lab-hr__status">載入中…</p>
    <p v-else-if="!stock" class="lab-hr__status">找不到這檔股票，請確認代號。</p>
    <p v-else-if="!hasData" class="lab-hr__status">目前沒有這檔股票的徽章資料。</p>

    <template v-else>
      <h2 class="lab-hr__subject">{{ stockShortName }} {{ code }} — 分類達標計數</h2>

      <!-- 功能層。DOM 順序＝閱讀順序：亮點 → 風險 → 市場評價，與視覺上下順序一致；階梯錯位
           只靠 margin-block-start，不靠 order/絕對定位。 -->
      <div class="lab-hr__grid">
        <section class="lab-hr__card lab-hr__card--highlight" aria-labelledby="lab-hr-highlights">
          <h3 id="lab-hr-highlights" class="lab-hr__card-title">
            <span class="lab-hr__mark lab-hr__mark--pass" aria-hidden="true">✓</span>亮點（已通過項目）
          </h3>
          <ul v-if="highlights.length" class="lab-hr__list">
            <li v-for="category in highlights" :key="category.key" class="lab-hr__row">
              <span class="lab-hr__row-name">{{ category.name }}</span>
              <span class="lab-hr__row-count" :aria-label="countLabel(category)">{{ category.passed }}/{{ category.total }}</span>
            </li>
          </ul>
          <p v-else class="lab-hr__empty">目前沒有達標過半的分類。</p>
        </section>

        <section class="lab-hr__card lab-hr__card--risk" aria-labelledby="lab-hr-risks">
          <h3 id="lab-hr-risks" class="lab-hr__card-title">
            <span class="lab-hr__mark lab-hr__mark--fail" aria-hidden="true">⚠</span>風險（未通過項目）
          </h3>
          <ul v-if="risks.length" class="lab-hr__list">
            <li v-for="category in risks" :key="category.key" class="lab-hr__row">
              <span class="lab-hr__row-name">{{ category.name }}</span>
              <span class="lab-hr__row-count" :aria-label="countLabel(category)">{{ category.passed }}/{{ category.total }}</span>
            </li>
          </ul>
          <p v-else class="lab-hr__empty">目前沒有未達標過半的分類。</p>
        </section>
      </div>

      <!-- 第三區：市場評價。刻意不貼亮點/風險標籤，只給百分位。 -->
      <section class="lab-hr__breakout" aria-labelledby="lab-hr-valuation">
        <h3 id="lab-hr-valuation" class="lab-hr__card-title lab-hr__card-title--plain">市場評價坐標</h3>
        <p class="lab-hr__valuation-note">
          分位數是事實，高低對應的意義取決於投資風格，因此這一區不歸入亮點或風險。
          <template v-if="valuation">（本類徽章 {{ valuation.passed }}/{{ valuation.total }} 通過，計數不參與上方分區。）</template>
        </p>
        <table v-if="valuationRows.length" class="lab-hr__table">
          <caption class="visually-hidden">{{ stockShortName }} {{ code }} 的市場評價分位</caption>
          <thead>
            <tr>
              <th scope="col">指標</th>
              <th scope="col">目前數值</th>
              <th scope="col">分位區間</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in valuationRows" :key="row.code">
              <th scope="row">{{ row.label }}</th>
              <td>{{ row.current.toFixed(2) }} 倍</td>
              <td>{{ row.windowLabel }}第 {{ row.percentile }} 百分位（{{ row.bandLabel }}）</td>
            </tr>
          </tbody>
        </table>
        <p v-else class="lab-hr__empty">目前沒有這檔股票的分位資料。</p>
      </section>

      <p class="lab-hr__foot">
        每個分類只顯示通過計數，不跨分類加總、不附評語。細項請看
        <NuxtLink :to="`/stock/${code}`" class="lab-hr__inline-link">{{ stockShortName }} {{ code }} 的財報亮點與風險</NuxtLink>。
      </p>
    </template>
  </div>
</template>

<style scoped>
.lab-hr {
  position: relative;
  width: 100%;
  /* 破格文件：退休族介面內文拉大到 18–20px，行高 1.6–1.8。這頁刻意用 18px 當基準，比全站
     16px 底線更寬鬆，是這次要比較的變因之一。 */
  font-size: 1.125rem;
  line-height: 1.7;
}

/* ---- 裝飾層（破格只在這裡發生） ---- */
.lab-hr__decor {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  z-index: 0;
}

.lab-hr__decor-block {
  position: absolute;
  display: block;
  border-radius: 24px;
  /* 明度壓得很低：破格文件的反模式表第一條就是「裝飾色塊明度過高干擾前景視讀」。 */
  background: var(--el-color-primary-light-9);
  opacity: 0.55;
}

.lab-hr__decor-block--a {
  inset-block-start: 6rem;
  inset-inline-start: clamp(-6rem, -8vw, -2rem);
  width: clamp(12rem, 34vw, 26rem);
  height: 18rem;
}

.lab-hr__decor-block--b {
  inset-block-start: 26rem;
  inset-inline-end: clamp(-6rem, -8vw, -2rem);
  width: clamp(10rem, 28vw, 22rem);
  height: 14rem;
  background: var(--el-fill-color);
}

/* 功能層一律疊在裝飾層之上 */
.lab-hr__head,
.lab-hr__subject,
.lab-hr__grid,
.lab-hr__breakout,
.lab-hr__foot,
.lab-hr__status {
  position: relative;
  z-index: 1;
}

.lab-hr__title {
  /* 破格文件：H1/H2 拉到 32–44px 建立高反差階層 */
  margin: 0 0 12px;
  font-size: clamp(2rem, 4vw, 2.75rem);
  line-height: 1.25;
  color: var(--el-text-color-primary);
}

.lab-hr__note,
.lab-hr__valuation-note,
.lab-hr__foot {
  max-width: 40em;
  margin: 0 0 16px;
  color: var(--el-text-color-regular);
}

.lab-hr__inline-link {
  color: var(--el-color-primary-dark-2);
  text-decoration: underline;
  text-underline-offset: 3px;
}

/* ---- 代號切換 ---- */
.lab-hr__picker {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin-bottom: 32px;
}

.lab-hr__picker-label {
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.lab-hr__picker-input {
  width: 7rem;
  min-height: 48px;
  padding: 0 12px;
  font: inherit;
  font-variant-numeric: tabular-nums;
  color: var(--el-text-color-primary);
  background: var(--el-bg-color);
  border: 2px solid var(--el-border-color);
  border-radius: 8px;
}

/* 破格文件：主要操作 48×48 起跳，相鄰可點元件間距 ≥16px（上面 gap: 12px 之外再補 padding，
   實際按鈕外緣間距 > 16px）。 */
.lab-hr__picker-button {
  min-height: 48px;
  padding: 0 24px;
  font: inherit;
  font-weight: 600;
  color: #fff;
  background: var(--el-color-primary);
  border: 2px solid var(--el-color-primary);
  border-radius: 8px;
  cursor: pointer;
}

.lab-hr__subject {
  margin: 0 0 20px;
  font-size: clamp(1.5rem, 2.5vw, 2rem);
  color: var(--el-text-color-primary);
}

/* ---- 階梯錯位網格 ---- */
.lab-hr__grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 24px;
  margin-bottom: 40px;
}

@media (min-width: 900px) {
  .lab-hr__grid {
    /* 非對稱軌道：破格文件說的「不規則寬度 fr 通道」，但兩欄都夠寬到不擠壓內容 */
    grid-template-columns: 1.15fr 1fr;
    gap: 32px;
  }

  /* 單向階梯錯位。位移用 clamp()＋rem，不用純 vw——200% 放大時會自動收斂，不會壓到隔壁
     （破格文件第 111 行給的正是這個寫法）。位移上限 2.5rem 遠小於卡片高度的 15%。 */
  .lab-hr__grid > :nth-child(2) {
    margin-block-start: clamp(1rem, 3vw, 2.5rem);
  }
}

/* ---- 卡片 ---- */
.lab-hr__card {
  /* 實心外框 2px（文件要求 1.5–2px 且對背景 ≥3:1）＋ 擴散微陰影，讓卡片在破格背景上仍有
     明確邊界，不會「融進背景」。 */
  padding: 24px;
  background: var(--el-bg-color);
  border: 2px solid var(--el-border-color);
  border-radius: 16px;
  box-shadow: 0 8px 24px rgb(0 0 0 / 8%);
}

/* 亮點/風險的區隔是「位置＋圖示＋文字」三重編碼（合規文件第 5 節）：左右分欄、✓/⚠ 形狀不同、
   標題有文字。左側色軌只是第四層冗餘，不是唯一線索。 */
.lab-hr__card--highlight {
  border-inline-start: 6px solid var(--el-color-primary);
}

.lab-hr__card--risk {
  border-inline-start: 6px solid var(--el-text-color-secondary);
}

.lab-hr__card-title {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 0 16px;
  font-size: 1.375rem;
  color: var(--el-text-color-primary);
}

.lab-hr__card-title--plain {
  margin-bottom: 8px;
}

/* ✓ / ⚠ 用形狀區分（實心圓 vs 空心圓），不是只有顏色——色弱使用者也分得出來。 */
.lab-hr__mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  border-radius: 50%;
  border: 2px solid transparent;
  font-size: 1rem;
  font-weight: 700;
}

.lab-hr__mark--pass {
  color: #fff;
  background: var(--el-color-primary);
}

.lab-hr__mark--fail {
  color: var(--el-text-color-primary);
  background: transparent;
  border-color: var(--el-text-color-primary);
}

.lab-hr__list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.lab-hr__row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
  /* 行高下限：文件對資料列要求 56px 起跳，這裡用 padding 撐到同等級 */
  min-height: 56px;
  padding: 12px 0;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.lab-hr__row:last-child {
  border-bottom: 0;
}

.lab-hr__row-name {
  color: var(--el-text-color-primary);
}

.lab-hr__row-count {
  font-size: 1.5rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--el-text-color-primary);
}

.lab-hr__empty,
.lab-hr__status {
  margin: 0;
  color: var(--el-text-color-secondary);
}

/* ---- 第三區：容器突圍 ---- */
/* 受控突圍。第一版寫成 `margin-inline: clamp(-2.5rem, calc(50% - 50vw), 0rem)`（經典 full-bleed
   寫法），實測在 1440 寬造成 9px 水平溢位：100vw 含捲軸寬、內容區不含，差額就是那 9px。破格
   文件本來就禁止用 vw 算位移（「必須嚴格採用相對長度單位 rem、em 或 ch」），那行是我寫錯。
   改用純 rem，而且只在「真的有餘裕」時才突圍——本站 --app-content-max-width 是 1440px，所以
   ≤1440 的視窗裡內容欄就等於整個視窗，沒有任何空間可以往外擴，硬擴就是溢位。這也是這次比較
   的一個實質結論：這個 shell 的全寬突圍只有在超寬螢幕上才成立。 */
.lab-hr__breakout {
  padding: 24px clamp(1rem, 4vw, 2.5rem);
  background: var(--el-fill-color-light);
  border-block: 2px solid var(--el-border-color);
  border-radius: 16px;
}

/* 1440（內容欄上限）+ 2×2.5rem 的餘裕之後才突圍，低於這個寬度維持切齊，零溢位。 */
@media (min-width: 1560px) {
  .lab-hr__breakout {
    margin-inline: -2.5rem;
  }
}

.lab-hr__table {
  width: 100%;
  border-collapse: collapse;
  font-variant-numeric: tabular-nums;
}

.lab-hr__table th,
.lab-hr__table td {
  padding: 16px 12px;
  text-align: left;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.lab-hr__table thead th {
  font-weight: 700;
  color: var(--el-text-color-primary);
  border-bottom: 2px solid var(--el-border-color);
}

/* 斑馬紋：文件要求相鄰列明度差 5–8%，防止老花視線跨行跳讀 */
.lab-hr__table tbody tr:nth-child(even) {
  background: var(--el-fill-color);
}

.lab-hr__foot {
  margin-top: 32px;
}

/* 前庭神經：全域尊重 reduced-motion（這頁沒有動效，裝飾層也是靜態，這條是防未來加動畫） */
@media (prefers-reduced-motion: reduce) {
  .lab-hr *,
  .lab-hr *::before,
  .lab-hr *::after {
    transition: none !important;
    animation: none !important;
  }
}
</style>
