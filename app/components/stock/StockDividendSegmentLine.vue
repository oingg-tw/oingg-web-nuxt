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

// 「切下來的累積，被拆的下一步消失」（2026-09-25）. Odd slots are the cuts and they stay for good;
// even slots are the remainders, each of which is the result of one step, the parent of the next,
// and gone after that — which is what 每股營收 already did when it vanished at step 3.
//
// Step 1  {0}                每股營收
// Step 2  {0,1,2}            營收 │ 成本 │ 毛利
// Step 3  {1,2,3,4}          成本 │ 毛利 │ 費用 │ 營業利益
// Step 4  {1,3,4,5,6}        成本 │ 費用 │ 營業利益 │ 業外與稅 │ EPS
// Step 5  {1,3,5,6,7,8}      成本 │ 費用 │ 業外與稅 │ EPS │ 留公司 │ 股利
//
// Note step 4 skips slot 2: the visible set is NOT contiguous, which is why this cannot be a
// translated track（the version before this one was）— a sliding window cannot hide a slot in its
// middle and close the gap. Hidden slots collapse to zero width instead, and the survivors share
// whatever is left（「這些拆解要占滿目前版面」）.
const parentSlot = computed(() => (index.value === 0 ? -1 : 2 * (index.value - 1)))

const roleOf = (slot: number): BarRole => {
  if (index.value === 0) return slot === 0 ? 'rest' : 'hidden'
  const parent = parentSlot.value
  if (slot === parent) return 'parent'
  if (slot === parent + 1 || slot === parent + 2) return slot === parent + 1 ? 'cut' : 'rest'
  // Every cut already made stays; every earlier remainder has been split and is gone.
  return slot < parent && slot % 2 === 1 ? 'cut' : 'hidden'
}

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
      <div class="segline__track">
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

/* Phone: one row per visible bar, the ground being the LEFT edge. Hidden rows collapse to zero
   height rather than being removed, so nothing is re-created between steps and a plain CSS
   transition covers the change. */
.segline__viewport {
  padding-left: 2px;
  border-left: 2px solid var(--el-border-color-darker);
}

.segline__track {
  display: flex;
  flex-direction: column;
}

.segline__part {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 12px;
  overflow: hidden;
  max-height: 120px;
  transition: max-height 0.35s ease, margin 0.35s ease, opacity 0.22s ease, visibility 0.22s;
}

/* `visibility`, not opacity alone — a hard gate that keeps collapsed labels out of the
   accessibility tree and out of axe's contrast walk. */
.segline__part.is-hidden {
  max-height: 0;
  margin-bottom: 0;
  opacity: 0;
  visibility: hidden;
}

/* With JS off nothing can toggle, so every bar shows and the chart is a complete descending
   waterfall of filed numbers rather than one bar. */
.segline:not(.segline--interactive) .segline__part {
  max-height: 120px;
  margin-bottom: 12px;
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
    height: 100%;
  }

  /* The visible slots share the width（「這些拆解要占滿目前版面」）and the hidden ones collapse to
     nothing. Transitioning flex-grow is what animates the change: existing bars narrow as a new one
     arrives instead of anything being replaced. No gap — the spacing comes from the bar's own
     max-width inside a wider slot, which also stops phantom gaps appearing where a collapsed slot
     used to be. */
  .segline__part {
    flex: 1 1 0;
    justify-content: flex-end;
    gap: 8px;
    max-height: none;
    margin-bottom: 0;
    height: 100%;
    transition: flex-grow 0.35s ease, opacity 0.22s ease, visibility 0.22s;
  }

  .segline__part.is-hidden {
    flex-grow: 0;
    margin-bottom: 0;
  }

  .segline:not(.segline--interactive) .segline__part {
    flex-grow: 1;
    max-height: none;
    margin-bottom: 0;
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
    left: 0;
    right: 0;
    bottom: var(--base);
    width: auto;
    max-width: 132px;
    margin-inline: auto;
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
