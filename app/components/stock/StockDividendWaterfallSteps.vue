<script setup lang="ts">
// 配息從哪來的互動拆解（2026-09-24,「希望用數學直式算式呈現，或是瀑布圖。圖表在上，說明在下方，
// 會有下一步按鈕，每按一下，圖表就自動滑動，顯示下一步的拆解，而解釋也會跟著變化」）.
//
// A waterfall was REMOVED from this URL once（64b6e38）because this app's 高齡友善圖表選型規範 rules
// out flow diagrams: they ask the viewer to track width, direction and branching at the same time.
// Revealing one step at a time answers that objection rather than working around it — at no point
// is there more than one width and one direction on screen.
//
// The steps are sized by ONE NEW IDEA each, not by one bar each（「不要撐爆 說的是 認知的 content
// window」）. That is why 業外損益 and 所得稅 share a step: they are one idea（本業以外的收支和稅）
// to the reader this page is for, while splitting them would add a name without adding a decision.
// Each panel carries the previous step's RESULT as its own starting number, so nothing has to be
// held in memory between steps.
//
// The equation format is the one the user A/B-chose for StockDividendCashChainCard's four cards
// （直式、一張三個數字、已知＋落差＝結果）. Same page, same grammar — a reader does not learn two
// ways to read an equation.
//
// Every figure is an identity over numbers already fetched for the table above; this component adds
// no request of its own. It renders nothing unless the whole chain is present and positive, because
// a waterfall over a negative EPS（6916, 1101）would draw a bar that crosses its own baseline and
// mean nothing — those symbols keep the table alone.
const props = defineProps<{
  revenuePerShare: number | null
  grossMargin: number | null
  operatingMargin: number | null
  netProfitMargin: number | null
  eps: number | null
  dividendPerShare: number | null
}>()

interface WaterfallStep {
  // 白話在前，術語在後 — the plain sentence is the heading, the filed name is the caption.
  title: string
  term: string | null
  from: number | null
  // Positive removes, negative adds（業外損益 can exceed tax, so 稅後淨利率 > 營業利益率 happens）.
  delta: number | null
  deltaLabel: string
  to: number
  explain: string
}

const steps = computed<WaterfallStep[]>(() => {
  const revenue = props.revenuePerShare
  const eps = props.eps
  const dividend = props.dividendPerShare
  if (revenue === null || eps === null || props.grossMargin === null || props.operatingMargin === null || props.netProfitMargin === null) return []

  const grossProfit = (revenue * props.grossMargin) / 100
  const operatingIncome = (revenue * props.operatingMargin) / 100
  const netIncome = (revenue * props.netProfitMargin) / 100

  const list: WaterfallStep[] = [
    {
      title: '公司一整年賣了多少',
      term: '每股營收',
      from: null,
      delta: null,
      deltaLabel: '',
      to: revenue,
      explain: '這是起點：公司一整年收到的貨款，除以流通在外的股數。後面每一步都從這個數字往下扣。'
    },
    {
      title: '先扣掉做出產品本身的成本',
      term: '毛利',
      from: revenue,
      delta: revenue - grossProfit,
      deltaLabel: '營業成本',
      to: grossProfit,
      explain: '原料、代工、生產線的花費。這一關扣得多不多，決定這門生意本身有沒有賺頭。'
    },
    {
      title: '再扣掉賣東西和管理公司的開銷',
      term: '營業利益',
      from: grossProfit,
      delta: grossProfit - operatingIncome,
      deltaLabel: '營業費用',
      to: operatingIncome,
      explain: '業務、廣告、管理部門、研發。扣完剩下的，才是公司靠本業賺到的錢。'
    },
    {
      title: '再算本業以外的收支和要繳的稅',
      term: 'EPS（每股稅後淨利）',
      from: operatingIncome,
      delta: operatingIncome - netIncome,
      deltaLabel: operatingIncome - netIncome >= 0 ? '業外收支與所得稅' : '業外收支淨增加（已扣稅）',
      to: netIncome,
      explain: '利息、匯兌、賣資產、轉投資，加上所得稅。這一步之後的數字，就是新聞上講的 EPS。'
    }
  ]

  if (dividend !== null) {
    list.push({
      title: '公司決定發多少給你',
      term: '每股股利',
      from: eps,
      delta: eps - dividend,
      deltaLabel: '留在公司的盈餘',
      to: dividend,
      explain: '賺到的錢不會全部發出來——一部分依公司法必須提存，一部分公司留著投資。剩下的才是配到你手上的現金。'
    })
  }
  return list
})

const total = computed(() => props.revenuePerShare ?? 0)

// EVERY intermediate has to be positive, not just the ends. A stacked bar cannot represent a step
// that crosses its own baseline, and the market really does produce those: scanned live, 1301 台塑
//（營業利益率 -2.02%, 稅後淨利率 6.07%）and 1605 華新（-0.09% / 8.43%）both lose money on operations
// and end the year profitable on 業外. widthOf takes an absolute value, so without this guard a
// negative 營業利益 would draw a positive bar and the picture would state the opposite of the
// filing. Those symbols get the table on its own, which handles negatives correctly because it
// prints signed numbers instead of lengths.
const usable = computed(() => {
  if (steps.value.length < 2 || total.value <= 0) return false
  return steps.value.every(item => item.to > 0 && (item.from === null || item.from > 0))
})

const index = ref(0)
// Without JS the track cannot translate, so the panels stack and every explanation is readable.
// The class is added on mount, which is also what keeps the whole sequence in the server HTML.
const interactive = ref(false)
onMounted(() => { interactive.value = true })

const step = computed(() => steps.value[index.value] ?? null)
const atStart = computed(() => index.value === 0)
const atEnd = computed(() => index.value >= steps.value.length - 1)

const money = (value: number | null): string => (value === null ? '－' : `${value.toFixed(2)} 元`)
// Width as a share of 每股營收, floored so a tiny slice is still visible rather than invisible.
const widthOf = (value: number): string => `${Math.max(Math.abs(value) / total.value * 100, 0.8)}%`

// Two segments, and which number anchors the solid one DEPENDS ON THE SIGN. A deduction leaves
// `to`, so the solid part is `to` and the slice being removed sits after it（solid + slice =
// from）. A step that ADDS — 業外收支 exceeding tax, i.e. 稅後淨利率 > 營業利益率 — has `to`
// already containing the gain, so anchoring the solid part on `to` and then appending the gain
// again draws from + 2×|delta|. The solid part is `from` in that case（solid + slice = to）.
// Invisible on 2330, which deducts at every step; wrong on any company whose 業外 is a net gain.
function segments(item: WaterfallStep): { solid: string; extra: string | null; extraClass: string } {
  if (item.delta === null || item.delta === 0) return { solid: widthOf(item.to), extra: null, extraClass: '' }
  const adds = item.delta < 0
  return {
    solid: widthOf(adds ? (item.from ?? item.to) : item.to),
    extra: widthOf(item.delta),
    extraClass: adds ? 'waterfall__added' : 'waterfall__cut'
  }
}
</script>

<template>
  <div v-if="usable" class="waterfall" :class="{ 'waterfall--interactive': interactive }">
    <!-- 圖表在上 — the track slides one panel per press. aria-hidden on the inactive panels is not
         used: they are real content for a reader without JS, and the live region below announces
         the change for everyone else. -->
    <div class="waterfall__viewport">
      <div class="waterfall__track" :style="interactive ? { transform: `translateX(-${index * 100}%)` } : undefined">
        <div v-for="(item, itemIndex) in steps" :key="item.title" class="waterfall__panel" :class="{ 'is-current': itemIndex === index }">
          <p class="waterfall__title">{{ item.title }}</p>

          <div class="waterfall__bar" role="img" :aria-label="item.from === null ? `${item.term} ${money(item.to)}` : `${money(item.from)} 減 ${item.deltaLabel} ${money(Math.abs(item.delta ?? 0))}，剩下 ${money(item.to)}`">
            <div class="waterfall__kept" :style="{ width: segments(item).solid }" />
            <div v-if="segments(item).extra" :class="segments(item).extraClass" :style="{ width: segments(item).extra! }" />
          </div>

          <!-- 數學直式算式 — the same 已知＋落差＝結果 shape as this page's four cash-flow cards. -->
          <dl class="waterfall__equation">
            <template v-if="item.from !== null">
              <div class="waterfall__row">
                <dt>上一步剩下</dt>
                <dd>{{ money(item.from) }}</dd>
              </div>
              <div class="waterfall__row">
                <dt>{{ (item.delta ?? 0) >= 0 ? '－' : '＋' }} {{ item.deltaLabel }}</dt>
                <dd>{{ money(Math.abs(item.delta ?? 0)) }}</dd>
              </div>
            </template>
            <div class="waterfall__row waterfall__row--result">
              <dt>{{ item.from === null ? item.term : `＝ ${item.term}` }}</dt>
              <dd>{{ money(item.to) }}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>

    <!-- 說明在下方 -->
    <p class="waterfall__explain" aria-live="polite">{{ interactive ? step?.explain : '' }}</p>
    <div v-if="!interactive" class="waterfall__explain-all">
      <p v-for="item in steps" :key="item.title">{{ item.explain }}</p>
    </div>

    <div class="waterfall__controls">
      <el-button :disabled="atStart" @click="index -= 1">上一步</el-button>
      <p class="waterfall__progress">第 {{ index + 1 }} 步，共 {{ steps.length }} 步</p>
      <el-button type="primary" :disabled="atEnd" @click="index += 1">下一步</el-button>
    </div>
  </div>
</template>

<style scoped>
.waterfall {
  margin-bottom: 16px;
}

.waterfall__viewport {
  overflow: hidden;
}

.waterfall__track {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* Only once JS is running does the track become a filmstrip; before that the panels stack and
   everything is readable. translateX rather than any negative offset（站規：全站嚴禁負 margin）. */
.waterfall--interactive .waterfall__track {
  flex-direction: row;
  gap: 0;
  transition: transform 0.35s ease;
}

.waterfall--interactive .waterfall__panel {
  flex: 0 0 100%;
}

@media (prefers-reduced-motion: reduce) {
  .waterfall--interactive .waterfall__track {
    transition: none;
  }
}

.waterfall__title {
  margin: 0 0 12px;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.waterfall__bar {
  display: flex;
  height: 28px;
  border-radius: 4px;
  overflow: hidden;
  background: var(--el-fill-color-light);
}

.waterfall__kept {
  background: var(--el-color-primary);
}

/* Same money, different fate — so the slice this step removes is a TINT OF THE ACCENT, not a grey.
   Measured before changing: the first version used --el-fill-color-darker #e6e8eb against a track
   of --el-fill-color-light #f5f7fa, two near-whites a reader cannot tell apart, which made「扣掉的」
   and「更早就扣掉的」look identical. Lightness, not hue, carries the distinction, so the market
   -convention accent switch does not affect it. */
.waterfall__cut {
  background: var(--el-color-primary-light-5);
}

.waterfall__added {
  background: var(--el-color-primary-light-3);
}

.waterfall__equation {
  margin: 16px 0 0;
}

.waterfall__row {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 8px 0;
}

.waterfall__row dt,
.waterfall__row dd {
  margin: 0;
  color: var(--el-text-color-regular);
}

.waterfall__row dd {
  font-variant-numeric: tabular-nums;
}

.waterfall__row--result {
  border-top: 1px solid var(--el-border-color);
  font-weight: 700;
}

.waterfall__row--result dt,
.waterfall__row--result dd {
  color: var(--el-text-color-primary);
}

.waterfall__row--result dd {
  font-size: 1.5rem;
}

.waterfall__explain {
  margin: 20px 0 0;
  min-height: 3.6em;
  font-size: 1rem;
  line-height: 1.8;
  color: var(--el-text-color-regular);
}

.waterfall__explain-all p {
  margin: 12px 0 0;
  line-height: 1.8;
  color: var(--el-text-color-regular);
}

.waterfall__controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 16px;
}

.waterfall__progress {
  margin: 0;
  font-size: 1rem;
  color: var(--el-text-color-secondary);
  font-variant-numeric: tabular-nums;
}
</style>
