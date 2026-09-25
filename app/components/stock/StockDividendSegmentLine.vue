<script setup lang="ts">
// 配息從哪來的互動拆解（2026-09-24「圖表在上，說明在下方，會有下一步按鈕」→「希望跟瀑布圖一樣騰空，
// 最後還在地面上的才是股利」→ 2026-09-25「只有新的柱狀圖會從右邊滑入」）.
//
// FIVE COLUMNS, ALWAYS RENDERED. The filmstrip this replaced（five panels, each a complete chart,
// the whole strip translated）switched wholesale on every press, which is what the user rejected.
// Now the five slots exist from step 1 with `flex: 1 1 0`, so nothing that is already on screen
// ever moves and the newly revealed column simply arrives in the slot that was waiting for it.
//
// Column j's role depends on the current step k:
//   j < k   → the cut already made: parts[j]
//   j === k → the current remainder: steps[j].to, sitting on the baseline
//   j > k   → the SAME remainder shape it will have at step j, but hidden
//
// Pre-filling the hidden columns rather than leaving them empty buys three things at once: the
// reveal is pure opacity+transform with no geometry change（the bar slides in already the right
// size, which is literally what was asked for）; the label text keeps each slot at its natural
// height so nothing jitters as steps advance; and with JS off one CSS rule shows all five and the
// chart reads as a complete descending waterfall of filed numbers rather than a broken one.
//
// The geometry works out for free: a cut's far edge is `after + amount` = the value before the
// cut = the previous step's remainder. So remainder→cut holds its top edge still and raises its
// bottom edge（on a phone the right edge is the invariant）. That is the textbook waterfall cut.
//
// No <Transition>/<TransitionGroup>: the repo's convention is CSS class toggles on always-rendered
// elements, and it is SEO-load-bearing — check-click-depth.mjs regex-reads raw HTML and never runs
// a browser.
const props = defineProps<{
  revenuePerShare: number | null
  grossMargin: number | null
  operatingMargin: number | null
  netProfitMargin: number | null
  eps: number | null
  dividendPerShare: number | null
  operatingExpense?: number | null
  otherOperatingIncome?: number | null
  researchExpense?: number | null
  symbol: string
}>()

const partition = computed(() => dividendSourcePartition(props))
const steps = computed(() => partition.value?.steps ?? [])
const revenue = computed(() => partition.value?.revenue ?? 0)
// Single source of truth, shared with the page — see dividend-source-partition.ts on why the two
// used to disagree and what that printed.
const usable = computed(() => partition.value?.usable ?? false)

const index = ref(0)
// Without JS nothing can toggle, so every column and every explanation must already be readable.
// The class arrives on mount, which is also what keeps the whole sequence in the server HTML.
const interactive = ref(false)
onMounted(() => { interactive.value = true })

const step = computed(() => steps.value[index.value] ?? null)
const atStart = computed(() => index.value === 0)
const atEnd = computed(() => index.value >= steps.value.length - 1)

const money = (value: number): string => `${value.toFixed(2)} 元`
// Share of 每股營收, floored so a sliver is still visible rather than invisible.
const sizeOf = (value: number): string => `${Math.max((value / revenue.value) * 100, 0.8)}%`

interface Column {
  label: string
  amount: number
  base: number
  state: 'cut' | 'rest' | 'pending'
}

const columns = computed<Column[]>(() =>
  steps.value.map((item, slot) => {
    const cut = partition.value?.parts[slot]
    if (slot < index.value && cut) return { label: cut.label, amount: cut.amount, base: cut.after, state: 'cut' }
    return { label: item.term, amount: item.to, base: 0, state: slot === index.value ? 'rest' : 'pending' }
  })
)

const revealed = computed(() => columns.value.filter(column => column.state !== 'pending'))
const chartLabel = computed(() =>
  revealed.value.length < 2
    ? `${revealed.value[0]?.label ?? ''} ${revealed.value[0] ? money(revealed.value[0].amount) : ''}`
    : `分成 ${revealed.value.map(column => `${column.label} ${money(column.amount)}`).join('、')}`
)

const hrefOf = (slug: string) => `/stock/${props.symbol}/${slug}`
</script>

<template>
  <div v-if="usable" class="segline" :class="{ 'segline--interactive': interactive }">
    <p class="segline__title">{{ interactive ? step?.title : '每股營收怎麼一路分到股利' }}</p>

    <div class="segline__parts" role="img" :aria-label="chartLabel">
      <div
        v-for="(column, slot) in columns"
        :key="slot"
        class="segline__part"
        :class="[`is-${column.state}`, { 'is-new': slot === index - 1 }]"
        :style="{ '--size': sizeOf(column.amount), '--base': sizeOf(column.base) }"
      >
        <div class="segline__slot"><div class="segline__bar" :class="column.state === 'cut' ? 'segline__bar--cut' : 'segline__bar--rest'" /></div>
        <p class="segline__part-label">
          <span class="segline__part-name">{{ column.label }}</span>
          <span class="segline__part-amount">{{ column.amount.toFixed(2) }}</span>
        </p>
      </div>
    </div>

    <!-- 說明在下方，而且帶著去處（2026-09-25「讓用戶知道每一個環節的細項拆解去哪裡找」）. This page
         is the teaching AND index page, so each step routes to where its own link of the chain is
         answered in full. Navigation, not a caption — it is not what「圖表不配說明文字」rules out. -->
    <div v-if="interactive" class="segline__note">
      <p class="segline__explain" aria-live="polite">{{ step?.explain }}</p>
      <p v-if="step?.links.length" class="segline__links">
        <span class="segline__links-label">這一環的細節：</span>
        <NuxtLink v-for="link in step.links" :key="link.slug" :to="hrefOf(link.slug)" class="segline__link">{{ link.label }}</NuxtLink>
      </p>
    </div>
    <div v-else class="segline__note">
      <div v-for="item in steps" :key="item.title" class="segline__note-all">
        <p class="segline__explain"><strong>{{ item.term }}</strong>：{{ item.explain }}</p>
        <p v-if="item.links.length" class="segline__links">
          <NuxtLink v-for="link in item.links" :key="link.slug" :to="hrefOf(link.slug)" class="segline__link">{{ link.label }}</NuxtLink>
        </p>
      </div>
    </div>

    <div class="segline__controls">
      <el-button :disabled="atStart" @click="index -= 1">上一步</el-button>
      <p class="segline__progress">第 {{ index + 1 }} 步，共 {{ steps.length }} 步</p>
      <el-button type="primary" :disabled="atEnd" @click="index += 1">下一步</el-button>
    </div>
  </div>
</template>

<style scoped>
/* One gap instead of three margins — the spacing between title, chart, note and controls is the
   same everywhere, which is most of what「單位面積內資訊量太高」was about. */
.segline {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.segline__title {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

/* The baseline has to be visible or「只有股利還站在地面上」has nothing to be measured against. At
   phone width the ground is the LEFT edge, so the rule moves with the axis. */
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
  transition: transform 0.22s ease;
}

.segline__bar,
.segline__part-label {
  transition: opacity 0.22s ease, visibility 0.22s;
}

/* Positive translateX only（站規：全站嚴禁負 margin 負 padding）. `visibility` is a hard gate as
   well as insurance against axe walking opacity-0 text for contrast. */
/* Ghosted, not invisible. Fully hidden reserved slots read as missing content rather than as
   space held open — at step 1 the chart was one solid block in a corner with 80% blank. The label
   stays hidden（its own rule below）so the ghost shows the SHAPE of what is coming without
   spoiling the figures, which is the one-idea-at-a-time point. */
.segline__part.is-pending {
  transform: translateX(24px);
}

.segline__part.is-pending .segline__bar {
  opacity: 0.12;
}

.segline__part.is-pending .segline__part-label {
  opacity: 0;
  visibility: hidden;
}

/* With JS off nothing can toggle, so every column shows and the chart is complete. */
.segline:not(.segline--interactive) .segline__part {
  transform: none;
}

.segline:not(.segline--interactive) .segline__part .segline__bar,
.segline:not(.segline--interactive) .segline__part .segline__part-label {
  opacity: 1;
  visibility: visible;
}

.segline__slot {
  position: relative;
  width: 100%;
  height: 22px;
}

/* --size and --base are custom properties, which do not interpolate on their own — but the
   transition sits on `bottom`/`height`/`left`/`width`, which do. */
.segline__bar {
  position: absolute;
  top: 0;
  bottom: 0;
  left: var(--base);
  width: var(--size);
  min-width: 3px;
  border-radius: 3px;
  transition: left 0.35s ease, width 0.35s ease, bottom 0.35s ease, height 0.35s ease, background-color 0.15s ease;
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

.segline__note-all {
  margin-bottom: 12px;
}

.segline__explain {
  margin: 0;
  min-height: 3.6em;
  font-size: 1rem;
  line-height: 1.7;
  color: var(--el-text-color-regular);
}

.segline__links {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px;
  margin: 0;
  font-size: 1rem;
}

.segline__links-label {
  color: var(--el-text-color-secondary);
}

.segline__link {
  display: inline-flex;
  align-items: center;
  min-height: 48px;
  color: var(--el-color-primary);
  text-decoration: underline;
}

.segline__controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
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

/* Desktop turns the same columns on their side: each floats at the level it cut from, so they step
   down and the only one still standing on the ground is 每股股利 itself. */
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

  /* Inset so a column reads as a BAR. At full width each is 187px across in a 220px-tall chart,
     which draws a square block and loses the waterfall entirely. */
  .segline__bar {
    top: auto;
    left: 18%;
    right: 18%;
    bottom: var(--base);
    width: auto;
    height: var(--size);
    min-width: 0;
    min-height: 3px;
  }

  /* Every label box the same height, or the bars are drawn to different scales. The remainder's
     amount is 1.25rem, which made its label 56px against the others' 50px — so its slot was 6px
     shorter and its bar 3.75% short of where it belonged, on a chart whose entire job is comparing
     heights. Measured at 660px, where the labels are tightest. */
  .segline__part-label {
    flex-direction: column;
    justify-content: flex-start;
    gap: 2px;
    min-height: 3.5em;
    text-align: center;
  }
}

/* The repo's motion convention: kill the travel entirely, never shorten it — the end state is
   still reached instantly（AppSlideLayer.vue:175-177）. */
@media (prefers-reduced-motion: reduce) {
  .segline__part,
  .segline__bar,
  .segline__part-label {
    transition: none;
  }
}
</style>
