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
// Without JS nothing can toggle, so every bar and every explanation must already be readable.
const interactive = ref(false)
onMounted(() => { interactive.value = true })

const step = computed(() => steps.value[index.value] ?? null)
const atStart = computed(() => index.value === 0)
const atEnd = computed(() => index.value >= steps.value.length - 1)

const money = (value: number): string => `${value.toFixed(2)} 元`
// Share of 每股營收, floored so a sliver stays visible rather than vanishing.
const sizeOf = (value: number): string => `${Math.max((value / revenue.value) * 100, 0.8)}%`

type BarRole = 'parent' | 'cut' | 'rest' | 'hidden'

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

// Step 1 shows only slot 0; every later step shows the parent it is splitting plus the two pieces.
const windowStart = computed(() => (index.value === 0 ? 0 : 2 * (index.value - 1)))

const roleOf = (slot: number): BarRole => {
  if (index.value === 0) return slot === 0 ? 'rest' : 'hidden'
  const position = slot - windowStart.value
  if (position === 0) return 'parent'
  if (position === 1) return 'cut'
  if (position === 2) return 'rest'
  return 'hidden'
}

// In slot units（one slot = 100%/9 of the track）. Step 1 is pushed one slot right so its single bar
// lands in the middle third —「電腦版他會置中呈現，不要滿版寬」— at the same width as every later
// bar, so the chart keeps its proportions.
const offset = computed(() => (index.value === 0 ? 1 : -windowStart.value))

const visibleBars = computed(() => track.value.filter((_, slot) => roleOf(slot) !== 'hidden'))
const chartLabel = computed(() =>
  visibleBars.value.length < 2
    ? visibleBars.value.map(bar => `${bar.label} ${money(bar.amount)}`).join('')
    : `${visibleBars.value[0]!.label} ${money(visibleBars.value[0]!.amount)} 分成 ${visibleBars.value.slice(1).map(bar => `${bar.label} ${money(bar.amount)}`).join('、')}`
)

const hrefOf = (slug: string) => `/stock/${props.symbol}/${slug}`
</script>

<template>
  <div v-if="usable" class="segline" :class="{ 'segline--interactive': interactive }">
    <p class="segline__title">{{ interactive ? step?.title : '每股營收怎麼一路分到股利' }}</p>

    <!-- `clip`, never `hidden`: a transformed child still contributes scrollable overflow — this
         repo measured scrollWidth 750 at a 390px viewport once and got a horizontal scrollbar for
         it（layouts/default.vue:96-106）— and `hidden` would additionally make this a scroll
         container, which changes `position: sticky` and fragment links inside it AND is what axe's
         scrollable-region-focusable rule walks. The track advances by button only, so it gets no
         tabindex and no role="region"; those belong to regions a user can scroll. -->
    <div class="segline__viewport" role="img" :aria-label="chartLabel">
      <div class="segline__track" :style="{ '--offset': offset }">
        <div
          v-for="(bar, slot) in track"
          :key="slot"
          class="segline__part"
          :class="`is-${roleOf(slot)}`"
          :style="{ '--size': sizeOf(bar.amount), '--base': sizeOf(bar.base) }"
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

/* Phone: the window is three stacked rows and the track slides vertically. The ground is the LEFT
   edge here, so the baseline rule moves with the axis. Fixed row height keeps the slide exact — the
   track travels in whole slots, so a row that wrapped would desynchronise it. */
.segline__viewport {
  overflow: clip;
  height: 204px;
  padding-left: 2px;
  border-left: 2px solid var(--el-border-color-darker);
}

.segline__track {
  display: flex;
  flex-direction: column;
  height: 612px;
  transform: translateY(calc(var(--offset) * (100% / 9)));
  transition: transform 0.35s ease;
}

.segline__part {
  display: flex;
  flex: 0 0 68px;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
  transition: opacity 0.22s ease, visibility 0.22s;
}

/* `visibility`, not opacity alone — a hard gate that keeps off-window labels out of the
   accessibility tree and out of axe's contrast walk. */
.segline__part.is-hidden {
  opacity: 0;
  visibility: hidden;
}

/* With JS off nothing can toggle, so the whole track shows and the chart is a complete descending
   waterfall of filed numbers rather than one bar. */
.segline:not(.segline--interactive) .segline__viewport {
  height: auto;
}

.segline:not(.segline--interactive) .segline__track {
  height: auto;
  transform: none;
}

.segline:not(.segline--interactive) .segline__part {
  opacity: 1;
  visibility: visible;
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
  transition: left 0.35s ease, width 0.35s ease, bottom 0.35s ease, height 0.35s ease, background-color 0.22s ease;
}

/* Three roles, three fills: the parent has already been split so it fades, the cut sits between,
   the new remainder is solid. */
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

/* Desktop turns the track on its side: three columns fill the width（「這些拆解要占滿目前版面」）,
   each floating at the level it cut from, so they step down and the only bar standing on the ground
   is the final 每股股利. */
@media (min-width: 640px) {
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
    width: 300%;
    height: 100%;
    transform: translateX(calc(var(--offset) * (100% / 9)));
  }

  .segline:not(.segline--interactive) .segline__track {
    width: 100%;
  }

  .segline__part {
    flex: 1 1 0;
    justify-content: flex-end;
    gap: 8px;
    height: 100%;
    padding: 0 12px;
  }

  .segline__slot {
    flex: 1 1 auto;
    height: auto;
  }

  /* Inset so a column reads as a BAR rather than a block. Three slots across ~985px gives each
     328px, against a ~152px slot height — at an 18% inset that drew a 210×152 rectangle, wider than
     tall, which is what「請讓他視覺上仍是一張柱狀圖的比例」rules out. 28% leaves ~144px, just
     narrower than the tallest bar is high. */
  .segline__bar {
    top: auto;
    left: 28%;
    right: 28%;
    bottom: var(--base);
    width: auto;
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
  .segline__track,
  .segline__part,
  .segline__bar {
    transition: none;
  }
}
</style>
