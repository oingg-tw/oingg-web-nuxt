<script setup lang="ts">
// 個股頁的「通則區」：指標定義與怎麼看（2026-10-12，使用者：「我現在另外需要抓出來統一的是 "指標定義" "怎麼看"，這邊要讓
// 頁尾的連結有意義」；選了「統一元件，用 props 傳遞差異」「放在該頁面的頁尾之前」「關係頁一起做」）。
//
// 每一頁的順序都是：這家公司自己的數字 → 這個元件（任何公司都適用的通則）→ StockPageFooter。通則緊接在頁尾前面，頁尾的
// 「相關頁面」就是讀完怎麼看之後的下一步。
//
// 三段的結構沿用 2026-09-30 定案（量過不合併，理由在底下各段的註解）：
//   1. X是什麼？                        定義（可覆寫標題，例如填息的「為什麼填息重要？」），可附判定方式、文獻出處
//   2. X變大或變小代表什麼？              h3 數字變大／數字變小——只有前端寫了 reading 的指標才有，沒有就整段不出
//   3. X要跟誰比、什麼時候會看錯？         h3 跟誰比／什麼時候不適用／容易看錯的地方；沒有「跟誰比」時標題不承諾它
// 統一之前有兩套 markup（指標頁、徽章頁）加上四個關係頁各自用 el-card 包散文、小標叫 判定方式／限制／常見誤讀。
//
// 文字一律是純文字 props；`**粗體**` 是唯一的標記（現金循環、填息的散文要標關鍵詞），不用 v-html。

const props = withDefaults(defineProps<{
  // 段落 id：`${idPrefix}-definition`／`-howto`／`-reading`；小標用 `${idPrefix}-guide-*`，不跟頁面自己的段落 id 撞（dividend-fill 的 -limits 撞過）
  idPrefix: string
  topic: string
  // 第 2、3 段標題用的主詞，預設同 topic（指標頁有「近四季 EPS」這種帶期別的寫法）
  valueTopic?: string
  definitionQuestion?: string
  definitionAnswer?: string | null
  definition: string[]
  // 判定方式（有門檻的徽章，例如三率三升）
  rule?: string | null
  citation?: { author: string; url?: string | null } | null
  reading?: { up: string; down: string; compare?: string } | null
  limitations?: string[]
  misreadings?: string[]
}>(), {
  valueTopic: undefined,
  definitionQuestion: undefined,
  definitionAnswer: null,
  rule: null,
  citation: null,
  reading: null,
  limitations: () => [],
  misreadings: () => []
})

const subject = computed(() => props.valueTopic ?? props.topic)
// 標題隨內容變（2026-09-30）：沒有「跟誰比」的指標，標題不寫「要跟誰比」
const readingQuestion = computed(() => (props.reading?.compare ? `${subject.value}要跟誰比、什麼時候會看錯？` : `${subject.value}什麼時候會看錯？`))
const hasReadingSection = computed(() => !!props.reading?.compare || props.limitations.length > 0 || props.misreadings.length > 0)

const notes = computed(() => [
  { key: 'limits', title: '什麼時候不適用', items: props.limitations },
  { key: 'misreadings', title: '容易看錯的地方', items: props.misreadings }
].filter(note => note.items.length))

// `**粗體**` → <strong>，其餘是純文字節點
const Rich = (rich: { text: string }) => rich.text.split('**').map((value, index) => (index % 2 ? h('strong', value) : value))
</script>

<template>
  <StockQuestionSection v-if="definition.length" :id="`${idPrefix}-definition`" :question="definitionQuestion ?? `${topic}是什麼？`" :answer="definitionAnswer ?? undefined">
    <p v-for="paragraph in definition" :key="paragraph" class="stock-answer">
      <Rich :text="paragraph" />
    </p>
    <section v-if="rule" class="stock-metric-guide__note" :aria-labelledby="`${idPrefix}-guide-rule`">
      <h3 :id="`${idPrefix}-guide-rule`" class="stock-metric-guide__note-title">判定方式</h3>
      <p class="stock-answer">{{ rule }}</p>
    </section>
    <p v-if="citation" class="stock-metric-guide__citation">
      出處：{{ citation.author }}<template v-if="citation.url">・<a :href="citation.url" target="_blank" rel="noopener noreferrer">原始文獻（另開新視窗）</a></template>
    </p>
  </StockQuestionSection>

  <!-- 標題寫它在答什麼，不寫「要怎麼看」（2026-09-30「語意上似乎可以結合，你認為呢？」）。
       「要怎麼看」跟「要注意什麼」語意重疊，讀者看不出第二段不是第一段的續集。沒有合併成一段，
       是因為量過：合併後單一段落字數中位 266、最長 559（roe），底下小標中位 5 個——本站的文件
       優先原則偏好多個短問句段而不是一個長段，而且兩個 h2 是兩個不同的長尾問題。
       改名就解掉衝突：「變大或變小代表什麼」與「要跟誰比、什麼時候會看錯」是同一件事的正反面，
       誰都不像涵蓋對方。

       兩格是固定模板（變大／變小），不是自由文字——理由見 metric-copy.ts 的型別註解。
       只有前端有文案的指標才有這一段；沒有的就跳過，不會印半截。 -->
  <StockQuestionSection v-if="reading" :id="`${idPrefix}-howto`" :question="`${subject}變大或變小代表什麼？`">
    <div class="stock-metric-guide__notes">
      <section class="stock-metric-guide__note" :aria-labelledby="`${idPrefix}-guide-up`">
        <h3 :id="`${idPrefix}-guide-up`" class="stock-metric-guide__note-title">數字變大</h3>
        <p class="stock-answer">{{ reading.up }}</p>
      </section>
      <section class="stock-metric-guide__note" :aria-labelledby="`${idPrefix}-guide-down`">
        <h3 :id="`${idPrefix}-guide-down`" class="stock-metric-guide__note-title">數字變小</h3>
        <p class="stock-answer">{{ reading.down }}</p>
      </section>
    </div>
  </StockQuestionSection>

  <!-- 「跟誰比」從上面搬過來，當這一段的第一個小標（2026-09-30「數字變大 數字變小 跟誰比 仍是
       重要概念，放哪裡好」）。理由是量出來的：39 條 compare 逐條讀過，結構高度一致——第一句講
       跟誰比（跟同業 12、跟自己過去 16、跟另一支指標一起看 8、其他 3），第二句講哪種比法不行
       或要配什麼（38/39 條都有第二句）。那個第二句就是注意事項的內容，所以「跟誰比」實質上回答
       的是「什麼比法會看錯」，跟「什麼時候不適用」「容易看錯的地方」同一類。

       小標的名字用讀者的話而不是後端欄位名（限制／常見誤讀 → 什麼時候不適用／容易看錯的地方），
       跟文案本身重新登記過的那一套一致。 -->
  <StockQuestionSection v-if="hasReadingSection" :id="`${idPrefix}-reading`" :question="readingQuestion">
    <div class="stock-metric-guide__notes">
      <section v-if="reading?.compare" class="stock-metric-guide__note" :aria-labelledby="`${idPrefix}-guide-compare`">
        <h3 :id="`${idPrefix}-guide-compare`" class="stock-metric-guide__note-title">跟誰比</h3>
        <p class="stock-answer">{{ reading.compare }}</p>
      </section>
      <section v-for="note in notes" :key="note.key" class="stock-metric-guide__note" :aria-labelledby="`${idPrefix}-guide-${note.key}`">
        <h3 :id="`${idPrefix}-guide-${note.key}`" class="stock-metric-guide__note-title">{{ note.title }}</h3>
        <p v-if="note.items.length === 1" class="stock-answer">
          <Rich :text="note.items[0]!" />
        </p>
        <ul v-else class="stock-metric-guide__note-list">
          <li v-for="item in note.items" :key="item" class="stock-answer">
            <Rich :text="item" />
          </li>
        </ul>
      </section>
    </div>
  </StockQuestionSection>
</template>

<style scoped>
.stock-metric-guide__notes {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.stock-metric-guide__note + .stock-metric-guide__citation,
.stock-answer + .stock-metric-guide__note,
.stock-answer + .stock-answer {
  margin-top: 12px;
}

/* 小標比 h2 弱一階（2026-09-30「資產報酬率是什麼？以下的版面現在看起來有點髒」）。原本是
   font-weight 700 + 主要色，跟段落標題幾乎同重，掃描時像四個同級標題連著出現。
   **層級只靠字重與顏色，不靠縮字級**：本站的 16px 下限沒有例外（--el-font-size-base 全域改成
   16px 的那條規則），而這是正文不是密集的 UI 元件。一度寫成 0.9375rem，量到 15px 後改回來。 */
.stock-metric-guide__note-title {
  margin: 0 0 4px;
  font-size: 1rem;
  font-weight: 600;
  color: var(--el-text-color-secondary);
}

/* A real <ul>, not paragraphs with a bullet character: each caveat is an independent statement and
   a screen reader should announce how many there are. Generous line gap — these run 2–3 lines each
   at phone width and this audience needs the separation to see where one ends. */
.stock-metric-guide__note-list {
  margin: 0;
  padding-left: 1.5em;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* 文獻出處：字級與顏色退一階，跟定義本身分開 */
.stock-metric-guide__citation {
  margin: 12px 0 0;
  line-height: 1.7;
  color: var(--el-text-color-secondary);
}
</style>
