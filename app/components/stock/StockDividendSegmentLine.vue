<script setup lang="ts">
// 配息從哪來的互動拆解（2026-09-24,「圖表在上，說明在下方，會有下一步按鈕，每按一下，圖表就自動
// 滑動，顯示下一步的拆解，而解釋也會跟著變化」→「能用線段圖呈現嗎，取代瀑布圖」）.
//
// A partition of 每股營收, not a waterfall. A waterfall was removed from this URL once（64b6e38）because this app's
// 高齡友善圖表選型規範 rules out flow diagrams — width, direction and branching tracked at once —
// and revealing one step at a time answers that. The line segment answers something the waterfall
// could not: it is the part-whole diagram this audience was taught in 國小數學, and THE WHOLE NEVER
// LEAVES THE SCREEN. A waterfall redraws a shorter bar each step, which invites「剛剛那段跑哪去了」;
// here the line keeps its length and each step only adds one more division.
//
// The five parts are an exact identity over 每股營收 — 2330: 61.25 + 13.92 + 9.79 + 65.77 + 20.50
// = 171.23 — and algebraically so for every company, since the deductions telescope:
//   (營收−毛利) + (毛利−營業利益) + (營業利益−EPS) + (EPS−股利) + 股利 = 營收
//
// Steps are sized by ONE NEW IDEA each（「不要撐爆 說的是 認知的 content window」）, which is why
// 業外損益 and 所得稅 share one: to this reader they are one idea, and splitting them adds a name
// without adding a decision. Each panel restates the previous step's RESULT as its own starting
// number, so nothing is held in memory between steps. The equation keeps the 直式、三個數字、
// 已知＋落差＝結果 shape the user A/B-chose for this page's four cash-flow cards.
//
// No request of its own: every figure is derived from the numbers the table above already fetched.
const props = defineProps<{
  revenuePerShare: number | null
  grossMargin: number | null
  operatingMargin: number | null
  netProfitMargin: number | null
  eps: number | null
  dividendPerShare: number | null
  // Filed figures for the 毛利→營業利益 block. All optional: analysis-ts is still backfilling, so a
  // symbol it has not reached keeps the plain label and the plain explanation.
  operatingExpense?: number | null
  otherOperatingIncome?: number | null
  researchExpense?: number | null
}>()

interface LinePart {
  label: string
  amount: number
  // What is left AFTER this part is taken out — the height a deduction column floats at, so the
  // staircase down to 每股股利 is the picture（2026-09-24,「希望跟瀑布圖一樣騰空，最後還在地面上
  // 的才是股利」）. The result column always sits at 0.
  after: number
}

interface DecompositionStep {
  // 白話在前，術語在後 — the plain sentence heads the panel, the filed name labels the result.
  title: string
  term: string
  from: number | null
  delta: number | null
  deltaLabel: string
  to: number
  explain: string
}

// This block is 毛利 − 營業利益, which the partition requires — but that is NOT the filed 營業費用
// whenever 其他營業收益費損淨額 exists, because 營業利益 = 毛利 − 營業費用 + 其他營業收益費損淨額.
// 2330 2026Q2: filed 營業費用 14.23, 其他營業收益 0.31, block 13.92. Shipped for a few hours as
//「營業費用 13.92」, a label that named the wrong line item; ~5% coverage on the 其他 line is why
// 2317/1101/1216 all reconciled to the cent and hid it. When that line exists the block is opex NET
// of it, and the name says so rather than the number being quietly wrong.
const hasOtherOperating = computed(() => (props.otherOperatingIncome ?? 0) !== 0)
const opexLabel = computed(() => (hasOtherOperating.value ? '營業費用淨額' : '營業費用'))

// 「研發呢」（2026-09-24）— R&D is not a step of its own; it lives inside this block, and for some
// companies it dominates it（2330: 10.39 of 13.92, three quarters）. Naming the figure answers the
// question without adding a sixth division and the cognitive load that comes with it.
// The block drawn on the chart is 毛利 − 營業利益, which is opex NET of 其他營業收支 — so a large
// enough 其他營業收益 can leave R&D bigger than the block it is supposed to sit inside. Naming it
// then would read as a part exceeding its whole. Same shape as the tax row's own guard on the page:
// state the figure only where it still makes sense next to the one beside it.
const opexBlock = computed(() => {
  const revenue = props.revenuePerShare
  if (revenue === null || props.grossMargin === null || props.operatingMargin === null) return null
  return (revenue * (props.grossMargin - props.operatingMargin)) / 100
})

const opexExplain = computed(() => {
  const base = '業務、廣告、管理部門、研發都在這一塊。切完剩下的，才是公司靠本業賺到的錢。'
  const rd = props.researchExpense
  if (rd === null || rd === undefined) return base
  if (opexBlock.value !== null && rd > opexBlock.value) return base
  const filed = props.operatingExpense
  const suffix = hasOtherOperating.value && filed !== null && filed !== undefined
    ? `其中研發 ${rd.toFixed(2)} 元；這一塊是營業費用 ${filed.toFixed(2)} 元扣掉其他營業收支之後的淨額。`
    : `其中研發 ${rd.toFixed(2)} 元。`
  return base + suffix
})

const derived = computed(() => {
  const revenue = props.revenuePerShare
  const eps = props.eps
  const dividend = props.dividendPerShare
  if (revenue === null || eps === null || dividend === null) return null
  if (props.grossMargin === null || props.operatingMargin === null || props.netProfitMargin === null) return null

  const grossProfit = (revenue * props.grossMargin) / 100
  const operatingIncome = (revenue * props.operatingMargin) / 100
  const netIncome = (revenue * props.netProfitMargin) / 100

  const parts: LinePart[] = [
    { label: '營業成本', amount: revenue - grossProfit, after: grossProfit },
    { label: opexLabel.value, amount: grossProfit - operatingIncome, after: operatingIncome },
    { label: '本業以外與稅', amount: operatingIncome - netIncome, after: netIncome },
    { label: '留在公司', amount: netIncome - dividend, after: dividend },
    { label: '發給你', amount: dividend, after: 0 }
  ]

  const steps: DecompositionStep[] = [
    {
      title: '公司一整年賣了多少',
      term: '每股營收',
      from: null,
      delta: null,
      deltaLabel: '',
      to: revenue,
      explain: '這是起點：公司一整年收到的貨款，除以流通在外的股數。接下來每一步，都從這裡分出一塊。'
    },
    {
      title: '先切掉做出產品本身的成本',
      term: '毛利',
      from: revenue,
      delta: parts[0]!.amount,
      deltaLabel: '營業成本',
      to: grossProfit,
      explain: '原料、代工、生產線的花費。這一刀切得多不多，決定這門生意本身有沒有賺頭。'
    },
    {
      title: '再切掉賣東西和管理公司的開銷',
      term: '營業利益',
      from: grossProfit,
      delta: parts[1]!.amount,
      deltaLabel: opexLabel.value,
      to: operatingIncome,
      explain: opexExplain.value
    },
    {
      title: '再切掉本業以外的收支和要繳的稅',
      term: 'EPS（每股稅後淨利）',
      from: operatingIncome,
      delta: parts[2]!.amount,
      deltaLabel: '本業以外與稅',
      to: netIncome,
      explain: '利息、匯兌、賣資產、轉投資，加上所得稅。這一刀之後剩下的，就是新聞上講的 EPS。'
    },
    {
      title: '最後一刀：公司決定發多少給你',
      term: '每股股利',
      from: netIncome,
      delta: parts[3]!.amount,
      deltaLabel: '留在公司的盈餘',
      to: dividend,
      // 「投資支出在哪一步驟？」（2026-09-24）— it is in NO step, and saying so is the point. Capex
      // never touches the income statement this line walks; buying a machine is not an expense in
      // the year it is bought. What DOES appear on the line is its shadow, 折舊攤銷, spread across
      // later years inside 營業成本 and 營業費用. The money that funds it is this step's 留在公司,
      // and the figure itself is one card down（每股自由現金流 ＋ 資本支出 ＝ 每股營業現金流）, which
      // is why this page carries both representations rather than choosing one.
      explain: '賺到的錢不會全部發出來——一部分依公司法必須提存，一部分留著買設備、蓋廠房，也就是資本支出。最後剩下的那一塊，才是配到你手上的現金。'
    }
  ]
  return { revenue, parts, steps }
})

const steps = computed(() => derived.value?.steps ?? [])
const parts = computed(() => derived.value?.parts ?? [])
const revenue = computed(() => derived.value?.revenue ?? 0)

// A part-whole line cannot draw a part that is negative or a whole that is not positive, and the
// market produces both. Scanned live: 1303 南亞（營業利益率 6.22%, 稅後淨利率 17.51%）and 1326 台化
// and 9904 寶成 all END the year with 業外 a net GAIN, making「本業以外與稅」negative; 1301 台塑
// （營業利益率 -2.02%）and 1605 華新 lose money on operations outright. Drawing |amount| would put
// a part on the line that is bigger than what it was cut from — a picture saying the opposite of
// the filing. Those symbols get the table on its own, which prints signed numbers and stays right.
//
// The clean diagram for the gain case needs 業外收入 and 所得稅 as SEPARATE parts（the line then
// becomes 營收＋業外收入 divided into 成本/費用/稅/留存/給你, all positive）. analysis-ts is
// backfilling exactly those fields now — see the page's own note on the 稅後淨利率 row.
const usable = computed(() => revenue.value > 0 && parts.value.length > 0 && parts.value.every(part => part.amount > 0))

const index = ref(0)
// Without JS the track cannot translate, so the panels stack and every explanation is readable.
// Adding the class on mount is also what keeps the whole sequence in the server HTML.
const interactive = ref(false)
onMounted(() => { interactive.value = true })

const step = computed(() => steps.value[index.value] ?? null)
const atStart = computed(() => index.value === 0)
const atEnd = computed(() => index.value >= steps.value.length - 1)

const money = (value: number | null): string => (value === null ? '－' : `${value.toFixed(2)} 元`)
const widthOf = (value: number): string => `${(value / revenue.value) * 100}%`

// Panel k shows the line AFTER step k's cut: the first k parts are named, and everything right of
// them is one undivided piece whose value is that step's own result. Off by one here is not a
// cosmetic slip — the first version revealed k−1 cuts while keeping the step's result as the label,
// so panel 4 drew 96.06（營業利益）under the name「EPS」while the equation below it correctly read
// 96.06 − 9.79 = 86.27. The remainder is read straight off the step rather than re-summed, so the
// picture and the equation cannot drift apart again.
const cutsAt = (panel: number): LinePart[] => parts.value.slice(0, panel)
</script>

<template>
  <div v-if="usable" class="segline" :class="{ 'segline--interactive': interactive }">
    <!-- 圖表在上 — one press slides the track by one panel. -->
    <div class="segline__viewport">
      <div class="segline__track" :style="interactive ? { transform: `translateX(-${index * 100}%)` } : undefined">
        <div v-for="(item, panel) in steps" :key="item.title" class="segline__panel">
          <p class="segline__title">{{ item.title }}</p>

          <!-- 一份 markup，兩種排法（2026-09-24,「手機版用直式堆疊，桌機版用漸進式的橫向瀑布圖…
               先只看到一條直的營收，然後一條變兩條直的，一路往右邊長出來」）. Truncation was the
               reason: a label inside a 5.7% slice of one line has nowhere to go, while a column of
               its own at desktop and a full row at phone both have room.

               The proportion travels as a CSS custom property so the SAME element is a column's
               HEIGHT above 640px and a row's WIDTH below it. Picking markup from a width at render
               time is what this app's cookie-less layout rule forbids outright, and a variable
               costs nothing next to that. -->
          <div
            class="segline__parts"
            role="img"
            :aria-label="panel === 0
              ? `${item.term} ${money(item.to)}`
              : `分成 ${cutsAt(panel).map(part => `${part.label} ${money(part.amount)}`).join('、')}，以及 ${item.term} ${money(item.to)}`"
          >
            <div v-for="(part, partIndex) in cutsAt(panel)" :key="part.label" class="segline__part" :class="{ 'is-new': partIndex === panel - 1 }" :style="{ '--size': widthOf(part.amount), '--base': widthOf(part.after) }">
              <div class="segline__slot"><div class="segline__bar segline__bar--cut" /></div>
              <p class="segline__part-label"><span class="segline__part-name">{{ part.label }}</span><span class="segline__part-amount">{{ part.amount.toFixed(2) }}</span></p>
            </div>
            <div class="segline__part segline__part--rest" :style="{ '--size': widthOf(item.to), '--base': '0%' }">
              <div class="segline__slot"><div class="segline__bar segline__bar--rest" /></div>
              <p class="segline__part-label"><span class="segline__part-name">{{ item.term }}</span><span class="segline__part-amount">{{ item.to.toFixed(2) }}</span></p>
            </div>
          </div>

          <!-- 數學直式算式 — same 已知＋落差＝結果 shape as this page's four cash-flow cards. -->
          <dl class="segline__equation">
            <template v-if="item.from !== null">
              <div class="segline__row">
                <dt>上一步剩下</dt>
                <dd>{{ money(item.from) }}</dd>
              </div>
              <div class="segline__row">
                <dt>－ {{ item.deltaLabel }}</dt>
                <dd>{{ money(item.delta) }}</dd>
              </div>
            </template>
            <div class="segline__row segline__row--result">
              <dt>{{ item.from === null ? item.term : `＝ ${item.term}` }}</dt>
              <dd>{{ money(item.to) }}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>

    <!-- 說明在下方 -->
    <p v-if="interactive" class="segline__explain" aria-live="polite">{{ step?.explain }}</p>
    <div v-else class="segline__explain-all">
      <p v-for="item in steps" :key="item.title">{{ item.explain }}</p>
    </div>

    <div class="segline__controls">
      <el-button :disabled="atStart" @click="index -= 1">上一步</el-button>
      <p class="segline__progress">第 {{ index + 1 }} 步，共 {{ steps.length }} 步</p>
      <el-button type="primary" :disabled="atEnd" @click="index += 1">下一步</el-button>
    </div>
  </div>
</template>

<style scoped>
.segline {
  margin-bottom: 16px;
}

.segline__viewport {
  overflow: hidden;
}

.segline__track {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* The filmstrip only exists once JS runs; before that the panels stack and all of it is readable.
   translateX, never a negative offset（站規：全站嚴禁負 margin 負 padding）. */
.segline--interactive .segline__track {
  flex-direction: row;
  gap: 0;
  transition: transform 0.35s ease;
}

.segline--interactive .segline__panel {
  flex: 0 0 100%;
}

@media (prefers-reduced-motion: reduce) {
  .segline--interactive .segline__track {
    transition: none;
  }
}

.segline__title {
  margin: 0 0 16px;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

/* One variable, two axes（2026-09-24,「希望跟瀑布圖一樣騰空，最後還在地面上的才是股利」and
   「手機版也是…最後還在左邊的才是股利」）. --size is a part's own amount and --base is what is left
   AFTER it, both as a share of 每股營收. A deduction therefore starts where the next one ends, the
   columns（or rows）step down, and the only bar touching the baseline is 每股股利 itself.

   Positioned with bottom/left rather than a margin on purpose: a percentage MARGIN always resolves
   against the containing block's WIDTH, so lifting a column with margin-bottom would raise it by a
   fraction of how wide it is. Percentage `bottom` and `height` resolve against the height, which is
   the axis the numbers are on at desktop. It also keeps the site's ban on negative margins moot. */
/* The baseline has to be visible or the whole point（only 每股股利 is still standing on it）has
   nothing to be measured against. At phone width the ground is the LEFT edge, so the rule moves
   with the axis. */
.segline__parts {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-left: 2px;
  border-left: 2px solid var(--el-border-color-darker);
}

.segline__part {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

/* Renamed off segline__track 2026-09-24: that name was already the filmstrip's own track, and the
   collision put `height: 22px` on the whole panel strip — phone lost the chart and the equation
   entirely while desktop looked fine, because its media query happened to reset the height. */
.segline__slot {
  position: relative;
  width: 100%;
  height: 22px;
}

.segline__bar {
  position: absolute;
  top: 0;
  bottom: 0;
  left: var(--base);
  width: var(--size);
  min-width: 3px;
  border-radius: 3px;
}

.segline__bar--cut {
  background: var(--el-fill-color-darker);
}

.segline__part.is-new .segline__bar--cut {
  background: var(--el-color-primary-light-5);
}

.segline__bar--rest {
  background: var(--el-color-primary);
}

.segline__part-label {
  display: flex;
  gap: 8px;
  margin: 0;
  font-size: 1rem;
  color: var(--el-text-color-regular);
}

.segline__part.is-new .segline__part-label,
.segline__part--rest .segline__part-label {
  color: var(--el-text-color-primary);
  font-weight: 600;
}

.segline__part-amount {
  font-variant-numeric: tabular-nums;
}

/* Desktop turns the same parts on their side: columns growing rightwards, each floating at the
   level it cut from, each with its own label underneath — which is what removed the truncation a
   label inside a 5.7% slice could never escape. */
@media (min-width: 640px) {
  .segline__parts {
    flex-direction: row;
    align-items: flex-end;
    gap: 12px;
    height: 220px;
    padding-left: 0;
    padding-bottom: 2px;
    border-left: none;
    border-bottom: 2px solid var(--el-border-color-darker);
  }

  .segline__part {
    flex: 1 1 0;
    justify-content: flex-end;
    gap: 8px;
    height: 100%;
  }

  .segline__slot {
    flex: 1 1 auto;
    height: auto;
  }

  .segline__bar {
    top: auto;
    left: 0;
    right: 0;
    bottom: var(--base);
    width: auto;
    height: var(--size);
    min-width: 0;
    min-height: 3px;
  }

  .segline__part-label {
    flex-direction: column;
    gap: 2px;
    text-align: center;
  }
}

.segline__equation {
  margin: 20px 0 0;
}

.segline__row {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 8px 0;
}

.segline__row dt,
.segline__row dd {
  margin: 0;
  color: var(--el-text-color-regular);
}

.segline__row dd {
  font-variant-numeric: tabular-nums;
}

.segline__row--result {
  border-top: 1px solid var(--el-border-color);
  font-weight: 700;
}

.segline__row--result dt,
.segline__row--result dd {
  color: var(--el-text-color-primary);
}

.segline__row--result dd {
  font-size: 1.5rem;
}

.segline__explain {
  margin: 20px 0 0;
  min-height: 3.6em;
  font-size: 1rem;
  line-height: 1.8;
  color: var(--el-text-color-regular);
}

.segline__explain-all p {
  margin: 12px 0 0;
  line-height: 1.8;
  color: var(--el-text-color-regular);
}

.segline__controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 16px;
}

.segline__progress {
  margin: 0;
  font-size: 1rem;
  color: var(--el-text-color-secondary);
  font-variant-numeric: tabular-nums;
}
</style>
