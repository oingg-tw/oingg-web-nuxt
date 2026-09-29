<script setup lang="ts">
// 配息從哪來的互動拆解（2026-09-25「第二步我希望營收那條依舊存在…按下第三步時，營收才消失，毛利依舊
// 存在，同時拉出營業費用淨額與營業利益」）.
//
// EVERY STEP SHOWS ONE THING BEING SPLIT AND THE TWO PIECES IT SPLITS INTO. Nine bars sit on one
// track in chain order — remainder, cut, remainder, cut, … — and a window of three slides along it
// two slots per press:
//
//   step 1   [每股營收]                                centred, not full width
//   step 2   [每股營收 | 營業成本     | 毛利]
//   step 3   [毛利     | 營業費用淨額 | 營業利益]
//   step 4   [營業利益 | 本業以外與稅 | EPS]
//   step 5   [EPS      | 留在公司     | 每股股利]
//
// A TRACK, not three slots that morph. 毛利 is the rightmost bar at step 2 and the leftmost at
// step 3, so on a track it physically travels right-to-left while the two new bars arrive from the
// right — which is what「毛利依舊存在」looks like on screen. Three fixed slots would instead morph
// all three at once, which is the wholesale switch this interaction was built to replace.
//
// No reserved slots and no ghost preview, both of which the previous version had:「圖表不需要不斷
// 提醒後面還有幾個步驟」. The「第 N 步，共 M 步」line below stays — it was explicitly kept.
//
// The window's three roles carry three fills: the parent is faded（it has already been split）, the
// cut sits between, the new remainder is solid. No is-new class is needed any more — the middle
// slot IS always the cut just made.
//
// No <Transition>/<TransitionGroup>: the repo's convention is CSS class toggles on always-rendered
// elements, and it is SEO-load-bearing — check-click-depth.mjs regex-reads raw HTML.
const props = defineProps<{
  revenuePerShare: number | null
  grossProfit: number | null
  operatingIncome: number | null
  eps: number | null
  dividendPerShare: number | null
  operatingExpense?: number | null
  otherOperatingIncome?: number | null
  researchExpense?: number | null
  // 民國年。口徑只寫在兩個地方——靜態標題與進度列——而不是每一步的文字裡：五步重複同一個年度是雜訊，
  // 而讀者需要的是「圖上這些數字是哪一年的」這個答案存在，不是它出現五次。
  rocYear: number | null
}>()

const partition = computed(() => dividendSourcePartition(props))
const steps = computed(() => partition.value?.steps ?? [])
const revenue = computed(() => partition.value?.revenue ?? 0)
// Single source of truth, shared with the page — see dividend-source-partition.ts on why the two
// used to disagree and what that printed.
const usable = computed(() => partition.value?.usable ?? false)

// 第六步（自動重播整條拆解後留下五塊）拆掉了 2026-09-25，同一天加上的——「第六步先不要做。前面五
// 步驟都搞不定了」。步數就是 steps 的長度，沒有第二個來源。
const index = ref(0)
// Without JS nothing can toggle, so every bar and every explanation must already be readable.
const interactive = ref(false)
onMounted(() => { interactive.value = true })

const step = computed(() => steps.value[index.value] ?? null)
const atStart = computed(() => index.value === 0)
const atEnd = computed(() => index.value >= steps.value.length - 1)

const money = (value: number): string => `${value.toFixed(2)} 元`

// 分母是**這一步的母項**，不是每股營收（2026-09-28「配息從哪來 這一頁當公司的毛利是低的時候，後面
// 第三四五步驟都變成超扁的一條線，這個能讓他下一步的時候長高再切嗎？」）。低毛利的公司第三步起的母項
// 只有營收的幾個百分點。2317 的 114 年度（頁面上的數字，不是估的）：每股營收 582.42、毛利 35.81、
// 營業利益 18.63、EPS 13.61、每股股利 7.17。用營收當分母時第三步那三條各佔 6.15%／2.95%／3.20%、
// 第五步 2.34%／1.11%／1.23%——全部貼在地上，看不出哪一條比較大，而那正是那一步唯一在問的事。
//
// 代價是**跨步之間的高度不再可比**：毛利在第二步是一小條、在第三步是滿高的母項。那是使用者要的「長高
// 再切」，而且每一步各自的比例才是那一步的主題；跨步的比例由每條上面的金額與下面的表格承接。動畫免費
// ——height／width 本來就在 :492 那份 transition 清單裡，母項會「長高」而不是跳上去。
const scale = computed(() => {
  // usable 保證每個 part.amount > 0，所以母項一定是正數；仍然留一道 > 0，因為分母為零會讓整張圖變成
  // NaN%（CSS 會整條規則丟掉，那是看起來像元件壞了的失敗方式）。
  const parent = index.value === 0 ? revenue.value : track.value[2 * (index.value - 1)]?.amount
  return parent && parent > 0 ? parent : revenue.value
})
// Share of the current step's parent, floored so a sliver stays visible rather than vanishing.
const sizeOf = (value: number): string => `${Math.max((value / scale.value) * 100, 0.8)}%`
// NOT floored. The floor exists so a tiny slice is still drawn; a base of 0 means「on the ground」,
// and flooring it to 0.8% left every grounded bar hovering ~1.8px above the baseline — on a chart
// whose whole claim is that only 每股股利 is still standing on it.
const baseOf = (value: number): string => `${(value / scale.value) * 100}%`

type BarRole = 'parent' | 'cut' | 'rest' | 'past' | 'future'

interface TrackBar {
  label: string
  amount: number
  base: number
}

// Interleaved: remainder[0], cut[0], remainder[1], cut[1], … remainder[4]. Slot 2i is what is left
// after i cuts, slot 2i+1 is the (i+1)-th cut. Both come straight out of the partition; the track
// only orders them.
const track = computed<TrackBar[]>(() => {
  const source = partition.value
  if (!source) return []
  const bars: TrackBar[] = []
  source.steps.forEach((item, i) => {
    bars.push({ label: item.term, amount: item.to, base: 0 })
    const cut = source.parts[i]
    if (cut && i < source.steps.length - 1) bars.push({ label: cut.label, amount: cut.amount, base: cut.after })
  })
  return bars
})

// Back to「被拆解的項目成為核心」（2026-09-25）: one split at a time, nothing accumulating. The
// accumulating version this replaces was the user's own idea and they withdrew it after seeing it —
//「項目變的雜亂與失焦」. What has already been split does not merely vanish: it is `past`, and past
// slides out of the chart to the left, while `future` waits behind the bar it will come out of.
const roleOf = (slot: number): BarRole => {
  if (index.value === 0) return slot === 0 ? 'rest' : 'future'
  const parent = 2 * (index.value - 1)
  if (slot < parent) return 'past'
  if (slot === parent) return 'parent'
  if (slot === parent + 1) return 'cut'
  if (slot === parent + 2) return 'rest'
  return 'future'
}

const isHidden = (slot: number): boolean => {
  const role = roleOf(slot)
  return role === 'past' || role === 'future'
}

// Which way the last press went. CSS cannot tell a forward class change from a backward one — both
// are the same swap of the same classes — so the two beats（版面先走完，新的兩條才從父項底下滑出）
// would run in the forward order however you got there.「先滑入重疊，再移到右邊」: this flips which
// beat waits for which.
const back = ref(false)

// 連點鎖（2026-09-26「配息從哪來 圖表不要讓用戶可以連按兩下 動畫會壞掉」）。這裡的動畫是三拍編排
// ——版面先走完，新的兩條才從父項底下滑出，然後才推到定位——三拍靠的是 transition-delay 互相接力，
// 不是 JS 排程。飛行中改 index，等於在第二拍開始前就把第一拍的目標換掉，兩拍從此對不齊，而且 back
// 的方向也可能中途翻面，於是「逆行」的那一套 delay 套在正向的位移上。所以擋的是輸入，不是動畫。
//
// 鎖的長度**從 CSS 變數算出來**，JS 裡不另寫一份：改了 --settle／--emerge 這裡自動跟上。第一拍
// settle，第二拍 reveal 後 emerge，第三拍再一個 emerge，總長就是這四段相加。
//
// 按鈕不加 disabled：那會讓鍵盤使用者在動畫中途失去焦點（焦點掉回 body），而且按鈕會閃一下。改成
// 在處理函式裡擋——動畫本身就是「系統有反應」的回饋，不需要再讓按鈕變灰。
const rootEl = ref<HTMLElement | null>(null)
const busy = ref(false)
let unlockTimer: ReturnType<typeof setTimeout> | null = null

function cycleMs(): number {
  const el = rootEl.value
  if (!el || typeof window === 'undefined') return 0
  // 偏好減少動態的人不該被鎖：那時 transition 是 none，位移瞬間完成，沒有可以壞掉的飛行狀態。
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 0
  const style = getComputedStyle(el)
  const read = (name: string): number => Number.parseFloat(style.getPropertyValue(name)) || 0
  return (read('--settle') + read('--reveal') + read('--emerge') * 2) * 1000
}

function lock() {
  const ms = cycleMs()
  if (ms <= 0) return
  busy.value = true
  if (unlockTimer) clearTimeout(unlockTimer)
  unlockTimer = setTimeout(() => { busy.value = false }, ms)
}

onBeforeUnmount(() => {
  if (unlockTimer) clearTimeout(unlockTimer)
})

function goPrev() {
  if (busy.value || atStart.value) return
  back.value = true
  index.value -= 1
  lock()
}

function goNext() {
  if (busy.value || atEnd.value) return
  back.value = false
  index.value += 1
  lock()
}

// 這一步在算什麼——用圖上那三個數字講一次（2026-09-29「希望可以把圖表中的數字都分段說清楚」）。
// 原本說明只有餐廳比喻，沒有一個數字；讀者看著 582.42 減 546.61 等於 35.81 的圖，而文字在講食材與
// 水電。兩段分開：這一段是算式（看得到的數字），下一段是它代表什麼（比喻）。
//
// 值全部取自 track，不另外算：它就是圖上那幾根柱子的來源，所以文字與圖不可能對不起來。
// 取任一步的算式，不只當前那一步：無 JS 版把五步同時列出來，而它原本只有比喻沒有數字——圖在那個
// 模式下只畫得出第一根柱子（isHidden 依 index 判斷，沒有 JS 就停在第 0 步），所以其餘四步的數字
// 在整個頁面上一個字都沒有。2026-09-30 查無障礙重複資訊時發現的，跟那件事同一個根：數字到底寫在
// 哪裡。
function figuresAt(i: number): string | null {
  if (i === 0) {
    const first = track.value[0]
    return first ? `${first.label} ${money(first.amount)}。` : null
  }
  const parent = track.value[2 * (i - 1)]
  const cut = track.value[2 * (i - 1) + 1]
  const rest = track.value[2 * (i - 1) + 2]
  if (!parent || !cut || !rest) return null
  return `${parent.label} ${money(parent.amount)}，扣掉${cut.label} ${money(cut.amount)}，剩下${rest.label} ${money(rest.amount)}。`
}

const figures = computed<string | null>(() => figuresAt(index.value))

</script>

<template>
  <div v-if="usable" ref="rootEl" class="segline" :class="{ 'segline--interactive': interactive, 'segline--single': interactive && index === 0, 'segline--back': back }">
    <p class="segline__title">{{ interactive ? step?.title : `${rocYear === null ? '' : `${rocYear} 年度`}每股營收怎麼一路分到股利` }}</p>

    <!-- `clip`, never `hidden`: a transformed child still contributes scrollable overflow — this
         repo measured scrollWidth 750 at a 390px viewport once and got a horizontal scrollbar for
         it（layouts/default.vue:96-106）— and `hidden` would additionally make this a scroll
         container, which changes `position: sticky` and fragment links inside it AND is what axe's
         scrollable-region-focusable rule walks. The track advances by button only, so it gets no
         tabindex and no role="region"; those belong to regions a user can scroll. -->
    <!-- 無障礙：這張圖對螢幕閱讀器是**裝飾**（2026-09-30 使用者問「圖表內容與下面的說明，對語音
         朗讀來說是不是重複資訊？」——實測是，逐步量過五步）。原本是 role="img" 加 aria-label，而那個
         標籤跟下面的算式段帶著同樣三個標籤、同樣三個數字，只差連接詞：

             img   每股營收 146.92 元 分成 營業成本 58.93 元、毛利 87.99 元
             live  每股營收 146.92 元，扣掉營業成本 58.93 元，剩下毛利 87.99 元。

         留算式段而不是留圖的標籤：它是完整的句子（「扣掉…剩下…」講出了這一步在做什麼），圖的標籤
         只是把三個數字並列；而且算式段是 aria-live，換步驟會自己播報，aria-label 不會。

         無 JS 模式本來靠這個 aria-label，但它其實只說得出第一個數字（isHidden 依 index 判斷，沒有
         JS 就停在第 0 步，圖上也真的只有一根柱子）。所以那一段改成五步的說明各自帶自己的算式——
         數字補齊了，圖在兩種模式下就都可以是裝飾。子樹裡沒有可聚焦元素（全是 div），aria-hidden
         不會製造 axe 的 aria-hidden-focus 問題。 -->
    <div class="segline__viewport" aria-hidden="true">
      <div class="segline__track">
        <div
          v-for="(bar, slot) in track"
          :key="slot"
          class="segline__part"
          :class="[`is-${roleOf(slot)}`, { 'is-hidden': isHidden(slot) }]"
          :style="{ '--size': sizeOf(bar.amount), '--base': baseOf(bar.base) }"
        >
          <div class="segline__slot"><div class="segline__bar" /></div>
          <p class="segline__part-label">
            <span class="segline__part-name">{{ bar.label }}</span>
            <span class="segline__part-amount">{{ bar.amount.toFixed(2) }}</span>
          </p>
        </div>
      </div>
    </div>

    <!-- 說明在下方，而且帶著去處（「讓用戶知道每一個環節的細項拆解去哪裡找」）. This page is the
         teaching AND index page, so each step routes to where its own link of the chain is answered
         in full. Navigation, not a caption. -->
    <!-- 比喻要標明（2026-09-25「我擔心用戶認知模糊，以為是台積電但是文案卻搞錯顯示餐廳」）。說明從
         第二步起就直接用餐廳的語言（食材、外場、舊烤箱），而我原本以為「步驟只能從第一步點進去」
         就夠——無 JS 版不是，它把五步的說明同時列出來，其中三步完全沒有標記。所以標記放在這裡：
         兩種模式共用、只出現一次。後半句是重點，它回答的是「那數字是不是也是編的」。 -->
    <!-- 高度由「最長的那一步」撐出來，不是寫死的常數（2026-09-30「希望這一塊統一高度，不然上下一步
         UI 跳動」）。先前用量出來的 min-height，但那是照 2317 量的，而說明文案逐檔不同——2330 第三步
         多一句研發費用，實測就超出：1440px 93→117、768px 117→171、375px 226→361，按鈕跟著跳 136px。
         照一檔量的常數註定會被下一檔打破。

         做法是把五步都放進同一個 grid 格子，只有當前那一步看得見：格子的高度自然等於最高的那一步，
         每個寬度、每個代號、文字放大之後都自己對。佔位層 visibility:hidden ＋ aria-hidden，所以
         不進無障礙樹；而且它們在 v-if="interactive" 裡，SSR 的 HTML 不含這一份，不會變成重複內容。
         aria-live 仍然只掛在真正那一層，播報行為跟先前量到的一樣。 -->
    <div v-if="interactive" class="segline__note segline__note--stack">
      <div class="segline__note-layer">
        <p class="segline__figures" aria-live="polite">{{ figures }}</p>
        <p class="segline__explain" aria-live="polite">{{ step?.explain }}</p>
      </div>
      <div v-for="(item, i) in steps" :key="item.title" class="segline__note-layer segline__note-ghost" aria-hidden="true">
        <p class="segline__figures">{{ figuresAt(i) }}</p>
        <p class="segline__explain">{{ item.explain }}</p>
      </div>
    </div>
    <div v-else class="segline__note">
      <div v-for="(item, i) in steps" :key="item.title" class="segline__note-all">
        <p class="segline__explain"><strong>{{ item.title }}</strong>：{{ figuresAt(i) }}{{ item.explain }}</p>
      </div>
    </div>

    <div class="segline__controls">
      <el-button :disabled="atStart" @click="goPrev">上一步</el-button>
      <!-- 口徑掛在進度列上，不另開一個元素（2026-09-25）. 這一頁的主句是盈餘所屬年度（台積電 114
           年度 EPS 66.26 元），圖上的 EPS 卻是近四季的 86.27——同一個標籤兩個數字。整頁改成年度之後
           兩者不再衝突，但年度仍然要寫出來：讀者需要知道圖上這些數字是哪一年的，而互動模式的標題是
           各步驟自己的句子，沒有地方放。 -->
      <p class="segline__progress">{{ rocYear === null ? '' : `${rocYear} 年度 · ` }}第 {{ index + 1 }} 步，共 {{ steps.length }} 步</p>
      <el-button type="primary" :disabled="atEnd" @click="goNext">下一步</el-button>
    </div>

  </div>
</template>

<style scoped>
.segline {
  display: flex;
  flex-direction: column;
  gap: 24px;
  /* Two beats, not one（「他真的是圖層交疊嗎？」2026-09-25）. Measured, the one-beat version had the
     parent travelling 400px during the same 0.6s the pair was emerging — 毛利 went x=813→411 while
     its own two pieces came out, so the curtain ran away with what it was meant to hide and the
     overlap fell from 67% to 0 by 282ms. There is no「behind」while the thing in front is moving.
     --settle is the layout finding its new place; --emerge starts only once it has. */
  /* 每一拍 0.45s，不是整段 0.45s。研究的 400–600ms 是「每個動作」的建議值，而兩拍中間有 0.12 秒
     完全靜止——那是兩個分開的知覺事件，各自吃自己的預算（文件裡唯一的「序列總時長 ≤500ms」是講列表
     交錯載入的，不是這種）。
     先前砍到 0.25s 是把規範套過頭：位移規則的目的是限制視網膜滑移速率，而距離被版面決定了不能改，
     所以唯一的槓桿是時間。砍短時長讓峰值從 8700 升到更高，違背了那條規則自己的目的。分拍實測，
     0.25s 時每一拍的實際移動只有 200 毫秒出頭，低於建議下限。 */
  --settle: 0.45s;
  /* The pair fades in while it is still COMPLETELY under the parent, and only then moves. Sharing a
     start with --emerge put it at 0.22 opacity when it was already 58% clear of the parent — a
     ghost crossing the chart. Nothing is seen during this beat; it exists so nothing is. */
  --reveal: 0.12s;
  --emerge: 0.45s;
  /* 兩條曲線分開選，而且第一拍「刻意不照」高齡研究點名的那條——理由是實測，不是偏好。
     研究建議摺疊／選單用 cubic-bezier(0.25, 1, 0.5, 1)，前段陡、後段平，短距離移動時那個陡起步
     正是「按了有反應」的回饋。但我們第一拍要把三欄一起甩過 564px，同一條曲線在同樣時長下量到
     4980 px/s，是最平緩選項的 2.2 倍：

       cubic-bezier(0.25, 1, 0.5, 1)    4980 px/s   ← 研究建議
       cubic-bezier(0.4, 0, 0.2, 1)     3960 px/s
       ease-in-out                      2520 px/s
       cubic-bezier(0.33, 0, 0.67, 1)   2220 px/s   ← 採用（正弦）

     研究反對對稱曲線的理由是「中間速度峰值過高會突破 DVA 追蹤閾值」，而它真正要限制的量就是滑移
     速率。在長距離上，前段陡的曲線峰值反而更高——照字面套會違背它自己的目的。距離被版面決定不能
     改（使用者要求三欄占滿版面、兩段式與從父項後面滑出都必須保留），所以只剩時間與曲線兩個槓桿，
     兩個都用滿。
     第二拍與第三拍維持研究的減速曲線：它們現在各只走一個欄距（拆成兩段之後），短距離正是那條曲線
     適用的場合。 */
  --settle-ease: cubic-bezier(0.33, 0, 0.67, 1);
  --emerge-ease: cubic-bezier(0, 0, 0.2, 1);
  /* 退場跟版面重排同時發生，所以跟 --settle 同長。先前是 0.6s，比整段預算還久。 */
  --exit-duration: 0.45s;
  /* 三段式（2026-09-25，使用者定稿）：
       第一拍  版面重排，父項站定，另外兩條躲在它後面
       第二拍  切塊與餘額「一起」推到中間——兩條疊在同一格，還是一整段
       第三拍  餘額再被推到最右，切塊留在中間，這時才分成兩塊
     收回就是它的逆運算，而且逆運算才是這個設計的來源（「收回的方式更好，就是先合成一整段再被初始
     柱狀圖覆蓋」）：餘額先退回中間跟切塊合成一整段，兩條再一起被父項蓋住，版面最後才移動。
     一起走、不錯開，是因為「合成一整段」要求它們在中間那一刻是重疊的；錯開就沒有那一刻。 */
  --emerge-delay: calc(var(--settle) + var(--reveal));
  /* 第三拍緊接第二拍，中間不留空檔——兩條重疊的那一刻是瞬間，不是停頓。 */
  --push-delay: calc(var(--settle) + var(--reveal) + var(--emerge));
  /* 父項變暗跟展開「同起同落」（2026-09-25，兩次修正後定案）。先變暗等於先講結論；排在展開之後又
     太晚，變成一個孤立的補充動作。跟第二＋第三拍同一個區間，變暗就是拆解本身的一部分：兩條被推出去
     多少，父項就退場多少。所以延遲＝第二拍起點，時長＝第二拍加第三拍。
     收回時在 .segline--back 裡把延遲改成 0s——回程一開始就恢復實色，跟餘額退回中間同步。 */
  --dim-delay: calc(var(--settle) + var(--reveal));
  --dim-duration: calc(var(--emerge) * 2);
  /* One row of the phone chart, spacing included. It has to be a constant: the pair is parked one
     and two rows above its own place, and `translateY(-100%)` is only exactly one row when every
     row is the same height. Measured, they were not — 50/50/56, because the remainder's label is
     the emphasised one. */
  --row: 68px;
}

.segline__title {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

/* Phone: one row per visible bar, the ground being the LEFT edge. Hidden rows collapse to zero
   height rather than being removed, so nothing is re-created between steps and a plain CSS
   transition covers the change. */
/* `clip`, never `hidden`. Past bars slide out to the left and something has to cut them off;
   `hidden` would additionally make this a scroll container, which changes `position: sticky` and
   fragment links inside it and is exactly what axe's scrollable-region-focusable rule walks
   （layouts/default.vue:96-106 records both halves of this）. The track advances by button only,
   so it gets no tabindex and no role="region". Note `.segline__part` stays `overflow: visible` on
   desktop — that is what lets a bar overflow its own collapsed slot, which is the whole reason the
   slide-out from behind the parent is visible at all. */
.segline__viewport {
  overflow: clip;
  padding-left: 2px;
  border-left: 2px solid var(--el-border-color-darker);
}

/* Three rows' worth, whatever step it is on（「不應該不斷變更高度導致畫面UI彈跳」2026-09-25）. Never
   more than three bars are shown, so the box that holds them is a constant — measured, step 1 was
   68px tall and every other step 192px, and crossing that boundary shoved the buttons and the whole
   rest of the page down by 124px. Only the interactive chart: with JS off all nine rows show at
   once and this would cut six of them off. */
.segline--interactive .segline__viewport {
  height: calc(var(--row) * 3);
}

.segline__track {
  display: flex;
  flex-direction: column;
}

/* Stacked so the bar being split paints ABOVE the two coming out of it — without this they are
   later in the DOM and paint on top, so they read as sliding out IN FRONT of the parent rather than
   from behind it. The fade is 0.12s for the same reason: at 0.35s the pair was still almost
   transparent for the first half of a 0.6s slide, so the emergence itself was never visible. */
.segline__part {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  /* Top-aligned, NOT centred. Every row is the same height, but its CONTENT is not — the remainder's
     label is the emphasised one and runs ~6px taller — so centring pushed that row's bar 3px up and
     it never quite reached the parent it was supposed to be hiding behind: measured 87% covered
     instead of 100%. Anchoring to the top makes a bar's position in its row independent of whatever
     is written underneath it. */
  gap: 4px;
  /* NOT hidden: an already-split row has to be seen leaving, and it leaves by moving, not by being
     clipped where it stands. The viewport one level up does the clipping.
     `min-height: 0` comes with that — a column flex item's default `min-height: auto` is its
     min-content height, which is only ignored while overflow is hidden. Leave it out and the row
     refuses to collapse at all. Same trap as `min-width: auto` on the desktop columns, which is
     what put two kinks in every move there. */
  overflow: visible;
  min-height: 0;
  height: var(--row);
  /* ONE transition list for both layouts. The phone animates `height`, the desktop `flex-grow` and
     `max-width`; naming a property that is not changing costs nothing, and one list is one place
     where the two beats are timed. */
  transition:
    height var(--settle) var(--settle-ease),
    flex-grow var(--settle) var(--settle-ease),
    max-width var(--settle) var(--settle-ease),
    /* ease-out（--emerge-ease），照高齡研究改回來的。我先前為了消掉起步的速度不連續改成
       ease-in-out——實測 ease-out 從靜止一幀跳到 52px。研究反對 ease-in-out 的理由不同也更硬：
       對稱加減速的中間速度峰值會突破高齡者的 DVA 追蹤閾值，而起步的高速反而是「介面已響應」
       的即時回饋。兩個顧慮都是真的，這裡採用研究的取捨。 */
    transform var(--emerge) var(--emerge-ease) var(--emerge-delay),
    /* 餘額的第二段。延遲寫死成「切塊那一拍」而不是讀 --emerge-delay，因為 --emerge-delay 在
       .is-cut 上被改寫過，而這一段對餘額與切塊都要在同一時刻發生——它就是「被擠過去」那一下。 */
    translate var(--emerge) var(--emerge-ease) var(--push-delay),
    opacity var(--reveal) ease var(--settle),
    visibility 0s linear var(--settle);
}

/* 逆行的時序。這三條原本寫在 @media (min-width: 640px) 裡面，所以手機完全沒有逆行時序——按「上一步」
   播的是正向順序（2026-09-25 使用者察覺：「手機版上一步的動畫回撤 這邊順序肯定有問題」）。正向兩邊
   逐幀比對是一致的（拍點差 6ms 內），差的只有回撤，所以從正向看不出來。
   它們只設定 transition 與 --dim-delay，而共用的那份過渡清單同時涵蓋手機的 height 與桌機的
   flex-grow/max-width，所以放在基礎區塊對兩種版型都成立，不需要各寫一份。 */
/* 回程一開始就恢復實色，不等位移走完。 */
.segline--back {
  --dim-delay: 0s;
}

/* 回程時柱子的高度要跟位移同一拍（2026-09-28「上一步時 一邊往右滑動一邊變回原本高度，才可以跟下一步
   是鏡向的」）。
   成因是 2026-09-28 稍早那次改動：母項改成每一步拉滿高度之後，這張圖才多出「柱子高度會變」這件事，
   而 .segline__bar 自己的過渡從來沒有回程覆寫——於是回程變成高度立刻縮、版面等 0.9s 才滑。逐幀量到：
     下一步  43ms h8 x1104 → 534ms h136 x369        高度與位移同時，0.53s
     上一步  21ms h136 → 501ms h8（x 凍在 369）→ 1080ms 才開始滑 → 1526ms    先縮再滑，1.5s
   這裡只把柱子的高度延後到跟版面同一拍，不動版面本身的時序。試過反過來（把版面提前到第一拍）
   ——位移確實變成一次走完、兩邊都 0.53s，但回程第一幀 x 會從 369 跳到 737 剛好一格，逐幀量到 t=3ms
   就已經在那裡。那是重新出現的兩條瞬間佔走空間造成的，原本被那 0.9s 遮著。一個看得見的瞬跳比
   慢半拍糟，所以採用這一邊。 */
.segline--back .segline__bar {
  transition:
    left var(--settle) var(--settle-ease) calc(var(--emerge) * 2),
    width var(--settle) var(--settle-ease) calc(var(--emerge) * 2),
    bottom var(--settle) var(--settle-ease) calc(var(--emerge) * 2),
    height var(--settle) var(--settle-ease) calc(var(--emerge) * 2),
    background-color var(--dim-duration) ease var(--dim-delay);
}

.segline--back .segline__part {
  transition:
    /* height 是手機的版面屬性、flex-grow/max-width 是桌機的。這兩條原本只列了桌機那兩個，所以手機
       在逆行時版面是瞬間切換的——毛利在第一幀就跳到終點然後全程不動，實測 136 對桌機的 64→721。
       搬出 media query 之後才暴露出來：先前它們只在桌機生效，手機根本沒有逆行時序。 */
    height var(--settle) var(--settle-ease) calc(var(--emerge) * 2),
    flex-grow var(--settle) var(--settle-ease) calc(var(--emerge) * 2),
    max-width var(--settle) var(--settle-ease) calc(var(--emerge) * 2),
    transform var(--emerge) var(--emerge-ease) calc(var(--emerge) * 2),
    translate 0s linear 0s,
    opacity var(--reveal) ease calc(var(--emerge) * 2),
    visibility 0s linear calc(var(--emerge) * 2);
}

/* The pair on its way back under the parent: it moves IMMEDIATELY, and its slot keeps its width
   for the whole beat（flex-grow delayed above）, which is what holds the parent still while it
   slides home. It fades out afterwards, by which time it is completely covered. */
/* 回程把兩段的順序也鏡像：先走第二段（定位→中間，跟切塊同時，讀起來是切塊退回去、餘額跟著讓
   位），再走第一段（中間→父項後面），版面最後才移動。正向是「版面→餘額→切塊＋餘額第二段」，
   回程就是它整個倒過來。 */
.segline--back .segline__part:where(.is-future) {
  transition:
    /* height 是手機的版面屬性、flex-grow/max-width 是桌機的。這兩條原本只列了桌機那兩個，所以手機
       在逆行時版面是瞬間切換的——毛利在第一幀就跳到終點然後全程不動，實測 136 對桌機的 64→721。
       搬出 media query 之後才暴露出來：先前它們只在桌機生效，手機根本沒有逆行時序。 */
    height var(--settle) var(--settle-ease) calc(var(--emerge) * 2),
    flex-grow var(--settle) var(--settle-ease) calc(var(--emerge) * 2),
    max-width var(--settle) var(--settle-ease) calc(var(--emerge) * 2),
    transform var(--emerge) var(--emerge-ease) var(--emerge),
    translate var(--emerge) var(--emerge-ease) 0s,
    opacity var(--reveal) ease calc(var(--emerge) * 2),
    visibility 0s linear calc(var(--emerge) * 2);
}

/* Parked one row（a cut）or two（a remainder）above its own place, which is the parent's row — and
   the parent's bar spans from the ground to its own value, so it covers both of them exactly. Odd
   slots are always cuts and even ones always remainders, so :nth-child tells them apart with no
   extra class: slot n is child n+1. The desktop block swaps these for the X axis. */

.segline__part.is-future:nth-child(even) {
  transform: translateY(-100%);
}

/* 餘額的 -200% 拆成兩段，各走一個欄距（2026-09-25「毛利本身不是一次滑到定位，而是先滑到中間」）。
   `transform` 與 `translate` 是兩個獨立屬性、會相加，所以一段旅程可以拆成兩條各自有延遲的過渡，
   不必動用 keyframes——這個元件的慣例是 class 切換配 transition，而 keyframes 每一步都要重新觸發。
     transform  -100% → 0   第二拍：從父項後面滑到中間
     translate  -100% → 0   第三拍：被擠到最右的定位
   副作用正是想要的：單次移動的距離減半，對長條自身尺寸的比例從 3.3× 降到 1.6×，那是高齡研究那條
   「≤1.5 倍」目前唯一真正接近達標的做法——而且不必縮窄圖表、不必放棄從父項後面滑出。 */
.segline__part.is-future:nth-child(odd) {
  transform: translateY(-100%);
  translate: 0 -100%;
}

/* Already split: straight up and out of the viewport, starting immediately. */
.segline__part.is-past {
  transform: translateY(calc(var(--row) * -1.5));
  /* 歸零，否則剛走完兩段旅程的餘額在變成 past 時會殘留第二段的位移。 */
  translate: none;
}

/* `visibility`, not opacity alone — a hard gate that keeps collapsed labels out of the
   accessibility tree and out of axe's contrast walk. */
.segline__part.is-hidden {
  height: 0;
  opacity: 0;
  visibility: hidden;
}

/* No horizontal slide on a phone. Rows collapse and expand VERTICALLY here, and the bar's own
   width is a per-bar percentage, so a translateX would move each bar a different distance and none
   of them the same distance as its label — which is the mismatch this change is fixing. The slide
   lives in the desktop block only. */

/* With JS off nothing can toggle, so every bar shows and the chart is a complete descending
   waterfall of filed numbers rather than one bar. */
.segline:not(.segline--interactive) .segline__part {
  height: var(--row);
  opacity: 1;
  visibility: visible;
}

.segline:not(.segline--interactive) .segline__part {
  transform: none;
}

.segline__slot {
  position: relative;
  width: 100%;
  height: 22px;
}

/* --size and --base are custom properties, which do not interpolate on their own — but the
   transition sits on left/width/bottom/height, which do. */
.segline__bar {
  position: absolute;
  top: 0;
  bottom: 0;
  left: var(--base);
  width: var(--size);
  min-width: 3px;
  border-radius: 3px;
  background: var(--el-color-primary);
  /* 跟著 --settle 走，不再自己訂時長。這裡曾經是 0.6s（2026-09-25「希望動畫速度慢點」），後來整段
     節奏照高齡研究重訂，一個時長散在三個地方就會各走各的。曲線也從 ease-in-out 換成研究點名的減速
     曲線——當初換掉 `ease` 的理由（前段太重，0.6s 的移動 200ms 就走完九成然後爬行）在減速曲線上不
     存在，它本來就是先快後慢但收尾是平的。 */
  transition: left var(--settle) var(--settle-ease), width var(--settle) var(--settle-ease), bottom var(--settle) var(--settle-ease), height var(--settle) var(--settle-ease), background-color var(--dim-duration) ease var(--dim-delay);
}

/* Three roles, three fills: the parent has already been split so it fades, the cut sits between,
   the new remainder is solid. */
.segline__part.is-parent {
  z-index: 2;
}

.segline__part.is-parent .segline__bar {
  background: var(--el-fill-color-darker);
}

.segline__part.is-cut .segline__bar {
  background: var(--el-color-primary-light-5);
}

.segline__part-label {
  display: flex;
  gap: 8px;
  margin: 0;
  font-size: 1rem;
  color: var(--el-text-color-regular);
}

.segline__part.is-parent .segline__part-label {
  color: var(--el-text-color-secondary);
}

.segline__part.is-rest .segline__part-label {
  color: var(--el-text-color-primary);
  font-weight: 600;
}

.segline__part-amount {
  font-variant-numeric: tabular-nums;
}

.segline__part.is-rest .segline__part-amount {
  font-size: 1.25rem;
}

.segline__note {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* 五層疊在同一個 grid 格子裡，格子的高度＝最高的那一層。不用 min-height 常數的理由見模板那段註解。 */
.segline__note--stack {
  display: grid;
  grid-template-columns: 1fr;
}

.segline__note--stack > .segline__note-layer {
  grid-area: 1 / 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.segline__note-ghost {
  visibility: hidden;
  pointer-events: none;
}

.segline__note-all {
  margin-bottom: 12px;
}

.segline__figures {
  margin: 0;
  font-size: 1rem;
  line-height: 1.7;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.segline__explain {
  margin: 0;
  font-size: 1rem;
  line-height: 1.7;
  color: var(--el-text-color-regular);
}


.segline__controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  /* 手機底部那條固定導覽列（StockPageNav 的 .stock-page-nav-mobile）會蓋住這一排按鈕：實測 390×844
     下按鈕落在 y 796–844、導覽列 795–844，整個被蓋住。按下去時瀏覽器得把取得焦點的按鈕捲進可視範圍，
     scrollY 從 363 跳到 759 再滑回來——那段回捲跟動畫同時發生，讀起來就是「手機比較不順」。動畫本身
     反而比桌機平滑（相對圖表的峰值 480/720 對 2220/2700 px/s）。
     body 上的 padding-bottom 解不了這個：那是留給文件「最後一列」的，而這一排按鈕中間還有說明文字與
     連結在下面。scroll-margin-block-end 才是對症的——它只影響「被捲進可視範圍時要留多少空間」。
     值跟 main.css 的 body.has-stock-nav-bar 用同一組，那條改了這裡要跟著改。 */
  scroll-margin-block-end: calc(56px + env(safe-area-inset-bottom));
}

.segline__controls :deep(.el-button) {
  min-height: 48px;
}

.segline__progress {
  margin: 0;
  font-size: 1rem;
  color: var(--el-text-color-secondary);
  font-variant-numeric: tabular-nums;
}

/* Desktop turns the track on its side: three columns fill the width（「這些拆解要占滿目前版面」）,
   each floating at the level it cut from, so they step down and the only bar standing on the ground
   is the final 每股股利. */
@media (min-width: 640px) {
  /* ONE moving element per column: the part. Bar and label are its children and ride it, so they
     cannot drift apart — an earlier version transformed the two separately and a percentage
     resolving against each one's own width（132px vs however wide the text is）put them 152px apart
     at the start of every move. */
  .segline {
    /* 132 → 200px（2026-09-25）。長條的寬度在桌機純屬視覺——值是由高度編碼的——所以加寬不改變任何
       數字，只讓它更好看見（對老花本來就有利），同時把浮現位移對長條尺寸的比例從 2.5×／5.0× 降到
       1.6×／3.3×。12vw → 16vw 一起放寬，否則在 1280 會被 vw 那一側綁住（12vw = 153.6px）。
       ponytail: 浮現位移仍然不符高齡研究的「≤ 自身尺寸 1.5 倍」，這是使用者明示的取捨——「兩段式
       必須存在，從父項後面滑出必須存在」（2026-09-25）。那個效果要求起點在父項正後方、終點在自己
       的欄位，而三欄占滿版面（也是使用者要求）使位移恆等於欄距 ≈ 視窗 1/3。兩者互斥，不是參數能
       調的：時長與曲線只改變「走多久」，不改變「走多遠」。研究自己的替代方案是改用淡入加 8–16px
       微幅位移，那等於刪掉這個效果。要降到 1.5× 只剩縮窄圖表一途。 */
    --bar-width: min(200px, 16vw);
    /* 1.5 倍，不是 6 倍。研究：位移距離不宜超過物件自身幾何尺寸的 1.5 倍。6 倍是清出視窗所需的四
       倍——實測退場 286ms 就越過左緣，之後三百多毫秒完全在畫面外跑，那段沒有人看得到，卻讓整段的
       速度是必要值的四倍。1.5 倍（198px）仍然完全出框：收合後的格子在軌道左緣，長條置中後跨
       −66…66，位移 −198 之後是 −264…−132。 */
    --exit: calc(var(--bar-width) * -1.5);
  }

  /* The offset is a percentage of the part's OWN width, and that is the whole trick: once the
     layout has settled, every visible slot is exactly one third of the viewport, so one slot-width
     left of a cut — two of a remainder — lands it dead centre on the parent, at any viewport width
     and with no pitch to compute. It is wrong during --settle（the slots are still growing）, which
     is precisely why the pair is invisible until --settle is over.
     Odd slots are always cuts and even ones always remainders（see the track's interleave）, so
     :nth-child tells them apart with no extra class: slot n is child n+1. */
  .segline__part.is-future:nth-child(even) {
    transform: translateX(-100%);
  }

  .segline__part.is-future:nth-child(odd) {
    transform: translateX(-100%);
    translate: -100% 0;
  }

  /* Already split: straight out the left edge（「那些已經被拆解的上一步驟的，就讓它滑出圖表外就好」）,
     starting immediately — the exit is not waiting for anything. */
  .segline__part.is-past {
    transform: translateX(var(--exit));
  }

  .segline__viewport {
    height: 220px;
    padding-left: 0;
    padding-bottom: 2px;
    border-left: none;
    border-bottom: 2px solid var(--el-border-color-darker);
  }

  .segline__track {
    flex-direction: row;
    align-items: flex-end;
    justify-content: center;
    height: 100%;
  }

  /* Step 1's single slot takes a third rather than the whole width. It is what「置中呈現，不要滿版
     寬」asks for, and it is also what makes the slide-out read correctly: the collapsed slots sit
     immediately after the visible one, so the bars that emerge from them start next to 每股營收
     rather than pinned to the right edge of the chart. */
  /* max-width, NOT flex-basis. Slot 0's final width is also a third, so capping it changes nothing
     about its size — only its position moves, and that is driven entirely by the neighbours'
     flex-grow transition. Setting `flex: 0 0 33.3333%` here instead made the basis change on the
     next step, and flex-basis is not in the transition list, so 每股營收 snapped to its final spot
     within 150ms while the two bars it had just released were still gliding for another 300ms. */
  .segline--single .segline__part.is-rest {
    max-width: 33.3333%;
  }

  /* The visible slots share the width（「這些拆解要占滿目前版面」）and the hidden ones collapse to
     nothing. Transitioning flex-grow is what animates the change: existing bars narrow as a new one
     arrives instead of anything being replaced. No gap — the spacing comes from the bar's own
     max-width inside a wider slot, which also stops phantom gaps appearing where a collapsed slot
     used to be. */
  /* max-width is IN the transition list, and it has to be: removing a cap is otherwise instant, so
     at the first frame of step 2 每股營收 was briefly free to take the whole width, which threw the
     collapsed slots from x=657 to x=985 and made the two new bars fly right before springing back.
     Third time this exact shape has bitten in this component — a property that changes but is not
     transitioned jumps, and the jump is only visible in a frame-by-frame sample. */
  .segline__part {
    flex: 1 1 0;
    justify-content: flex-end;
    gap: 8px;
    /* NOT hidden here. The base rule clips so a collapsing row can hide its own content on a
       phone, but on desktop an entering slot is still nearly zero wide while its bar is already
       132px — so the bar was clipped away for the whole early part of the move, and the emergence
       from behind the parent was never actually visible. Overflowing its slot IS the effect. */
    overflow: visible;
    /* `min-width: auto` is a flex item's default and it resolves to min-content — here, the width of
       the unbreakable amount（「171.23」≈ 49px）. So a slot transitioning flex-grow 1 → 0 STOPPED
       shrinking at 49px while the number kept falling, and the neighbours absorbed the difference:
       measured, the parent's own slot ballooned 248 → 278 and came back, and a bar whose speed
       should have been one smooth ease-in-out went 11 → 33 → 39 px/frame in consecutive frames and
       17 → 4 at the other end. Two kinks in every move, in both directions. The text still fits at
       every width it is actually SEEN at — a slot narrower than its label is one that is off the
       left edge or under the parent. */
    min-width: 0;
    max-width: 100%;
    margin-bottom: 0;
    height: 100%;
    /* Everything that decides WHERE the slots are runs in beat one; everything that shows the new
       pair runs in beat two. The pair is already `is-cut`/`is-rest` from the first frame — it has
       to be, since its own growing slot is what pushes the parent into place — but it is invisible
       and parked at -100%/-200% until beat two, so the first thing seen of it is it coming out from
       under an opaque, stationary parent（z-index 2, see the base rule）.
       The opacity ramp is 0.2s of beat two and it is a fade IN, not the fade-out that was wrong
       before: at that instant the pair's LABELS sit exactly on top of the parent's own label, and
       text over text is unreadable however it is layered — the bars themselves are covered by the
       parent and need no fade at all. */
    transition:
      flex-grow var(--settle) var(--settle-ease),
      max-width var(--settle) var(--settle-ease),
      /* ease-in-out, not ease-out. The pair is at REST behind the parent when this beat starts, and
         ease-out opens at maximum velocity — measured, 0 then 52px in a single frame, which is a
         jerk, and it lands exactly on the one frame where the pair first becomes visible. Every
         other move in this component starts and ends at rest; this one now does too. */
      transform var(--emerge) var(--emerge-ease) var(--emerge-delay),
      translate var(--emerge) var(--emerge-ease) var(--push-delay),
      opacity var(--reveal) ease var(--settle),
      visibility 0s linear var(--settle);
  }

  /* `height` is the phone's collapse axis and it is a two-class rule, so it reaches in here and
     would flatten a column whose bar is positioned against its own full height. */
  .segline__part.is-hidden {
    flex-grow: 0;
    height: 100%;
    margin-bottom: 0;
  }

  /* 上一步 runs the same two beats backwards（「先滑入重疊，再移到右邊」）: the pair slides back under
     the parent FIRST, and only once it is tucked away does the layout move right. So the delays
     swap — the layout is the one that waits now.
     `:where()` on the role keeps this at two classes so the reduced-motion reset at the end of the
     file still outranks it; a plain `.is-future` here would be three and would slip past it, which
     is the same trap `.segline__part.is-past` already fell into once. */
  /* 「用不到的柱狀圖希望是完整滑出圖表就好，他現在看起來是邊消失邊滑出」（2026-09-25）. The base
     rule's 0.12s opacity/visibility fade killed the bar five frames into a 0.6s journey, so it
     dissolved on the spot instead of leaving. It stays fully opaque for the whole travel; the
     viewport's own `overflow: clip` is what makes it disappear, at the moment it crosses the edge.
     `visibility` still flips — it is what keeps a collapsed label out of the accessibility tree and
     out of axe's contrast walk — but only after the 0.6s, delayed rather than transitioned.
     Only for `is-past`: `is-future` waits behind the bar it will come out of and must not be seen
     there before its turn, so that one keeps the fade. */
  .segline__part.is-past {
    opacity: 1;
    transition:
      flex-grow var(--settle) var(--settle-ease),
      max-width var(--settle) var(--settle-ease),
      transform var(--exit-duration) var(--settle-ease),
      translate 0s linear 0s,
      visibility 0s linear var(--exit-duration);
  }

  /* Repeated here, and it has to be: `.segline:not(…) .segline__part` and
     `.segline__part.is-future:nth-child(even)` have IDENTICAL specificity, so with JS off the
     is-future rules above would win on source order alone and shift every bar in the SSR chart. */
  .segline:not(.segline--interactive) .segline__part {
    flex-grow: 1;
    height: 100%;
    margin-bottom: 0;
    transform: none;
  }

  .segline__slot {
    flex: 1 1 auto;
    height: auto;
  }

  /* Capped and centred rather than inset by a percentage: the slot count runs from 1 to 6 as the
     steps accumulate, so a percentage inset would make the bars shrink with every press. A fixed
     cap keeps one bar the same width throughout, which is the only way heights stay comparable
     across steps — and it is what keeps step 1's single bar centred and narrow rather than
     filling the width. */
  .segline__bar {
    top: auto;
    /* Centred with the independent `translate` property, NOT `left:0;right:0;margin-inline:auto`.
       That combination is an over-constrained absolutely-positioned box, and when the free space
       goes NEGATIVE — every slot still mid-grow is narrower than --bar-width — CSS 2.1 resolves
       margin-left to 0 in LTR and left-aligns the bar instead of centring it. The label, centred by
       text-align against the same slot, stayed on the slot's centre: measured 45px apart at 90ms
       while both carried an IDENTICAL transform. `translate` composes with `transform` rather than
       replacing it, so the slide rules below keep working untouched, and its percentage resolves
       against --bar-width, which is always definite. Negative margins are banned site-wide. */
    left: 50%;
    translate: -50% 0;
    bottom: var(--base);
    /* A DEFINITE width, not max-width. A collapsed slot is zero wide, and with left/right at 0 a
       max-width only caps a width that has already resolved to 0 — so the bar had no width to
       translate a percentage of, and the slide-out silently did nothing. `min()` against a viewport
       unit keeps it independent of the slot while still shrinking on a narrow screen, where six
       slots are ~110px each. */
    width: var(--bar-width);
    height: var(--size);
    min-width: 0;
    min-height: 3px;
  }

  /* Every label box the same height or the bars are drawn to different scales — the remainder's
     amount is 1.25rem, which made its slot 6px shorter and its bar 3.75% short of where it
     belonged, on a chart whose whole job is comparing heights. */
  .segline__part-label {
    flex-direction: column;
    justify-content: flex-start;
    gap: 2px;
    min-height: 3.5em;
    text-align: center;
  }
}

/* The repo's motion convention: kill the travel entirely, never shorten it — the end state is still
   reached instantly（AppSlideLayer.vue:175-177）. */
@media (prefers-reduced-motion: reduce) {
  /* The extra `.segline` is load-bearing, not tidiness. `.segline__part.is-past` carries its own
     transition and is TWO classes — it outranked a bare `.segline__part` here, so under `reduce` the
     exiting bars kept gliding out over 0.6s while everything else jumped. Two classes and last in
     the file beats anything else in it. */
  .segline .segline__part,
  .segline .segline__bar,
  .segline .segline__part-label {
    transition: none;
  }
}
</style>
