<script setup lang="ts">
import { Close, Plus } from '@element-plus/icons-vue'
import Sortable from 'sortablejs'
import type { ComponentPublicInstance } from 'vue'

// A saved-preset switcher drawn as a folder: the active preset is a real, bordered tab
// attached to the folder body below it (see .stock-preset-folder__body's margin-top
// overlap trick). Used for both the filter-preset switcher and the column-preset switcher
// so the two share one visual language.
//
// Simplified 2026-09-10 per direct request ("presetTable的隱藏機制刪掉，讓他回歸簡單...以後
// 手機板上面直接scroll就好") — this used to render two entirely different interaction models
// depending on viewport width: mobile got a compact "folder" metaphor (only the active preset
// plus a dimmed peek of its immediate neighbors, switched via long-press/double-click into a
// separate rename/delete dialog), desktop got the full tab row (every preset as its own tab,
// inline rename, always-visible delete icon, drag-to-reorder). Now there's exactly one: the
// former desktop-only full tab row, always rendered, horizontally scrollable — mobile just
// scrolls it like any other overflowing row instead of hiding tabs behind a peek/fade. Removes
// an entire parallel UI (the peek buttons, the fade edges, the long-press timer, the separate
// edit dialog) in favor of the one row every screen size already needed to support anyway.
export interface PresetFolderItem {
  id: string
  name: string
  // Set false for a locked, non-owned item with no server-side resource to rename or
  // delete — rename/delete/drag-reorder are all no-ops for one of these. Every real
  // filter-preset and column-preset tab is a genuinely owned resource, so nothing currently
  // sets this to false; kept as a general-purpose escape hatch for a future locked/system tab
  // rather than torn out, since both consumers already share this same item type either way.
  editable?: boolean
}

const props = defineProps<{
  items: PresetFolderItem[]
  // Opt-in: makes the folder itself + body a flex:1, fill-remaining-space region instead
  // of the default content-sized body — for screener.vue's result/column-preset instance,
  // whose result table needs to fill down to the viewport bottom and scroll internally.
  // The other (filter-preset) instance on that same page keeps the default behavior.
  fillHeight?: boolean
  // Opt-in: hides the "+" add button entirely. For a fixed, developer-defined set of tabs
  // (etf-zone.vue's topic/view switchers — not a user-owned, addable/renameable/deletable
  // resource the way every screener tab is) there's nothing "+" would ever meaningfully do.
  // Pair with `editable: false` on every item (see PresetFolderItem) to also lock out
  // rename/remove/reorder on each one.
  hideAdd?: boolean
}>()

const activeId = defineModel<string>('activeId', { required: true })

const emit = defineEmits<{
  add: []
  rename: [id: string, name: string]
  remove: [id: string]
  reorder: [ids: string[]]
}>()

// A tap on an INACTIVE tab switches to it; a tap on the tab that's ALREADY active instead
// opens inline rename right there in the tab (see renamingId below) — there's nothing else a
// click on the current tab would usefully do. A press held past DRAG_DELAY_MS instead drags to
// reorder (see attachSortable below), and delete has its own always-visible icon (see the
// template) — between the three, there's no remaining gesture left over for a long-press to do.
function handleTabLabelClick(item: PresetFolderItem) {
  if (item.id === activeId.value) {
    if (item.editable !== false) startRename(item)
    return
  }
  activeId.value = item.id
}

const renamingId = ref<string | null>(null)
const renameDraft = ref('')
let renameInputEl: HTMLInputElement | null = null
let renameMeasureEl: HTMLElement | null = null

function setRenameInputEl(el: Element | ComponentPublicInstance | null) {
  renameInputEl = el instanceof HTMLInputElement ? el : null
}

function setRenameMeasureEl(el: Element | ComponentPublicInstance | null) {
  renameMeasureEl = el instanceof HTMLElement ? el : null
}

// Pixel width the rename input is pinned to — kept in sync with a hidden mirror span (see
// .stock-preset-folder__tab-rename-measure) instead of a fixed `12ch`, so the input is
// exactly as wide as its own text needs, same as the label button it replaces. Matches
// horizontal padding shared by .tab-label/.tab-rename-input below (14px left + 8px right).
const RENAME_INPUT_PADDING_PX = 22
const renameInputWidth = ref<number | null>(null)

function syncRenameInputWidth() {
  if (!renameMeasureEl) return
  renameInputWidth.value = Math.max(80, renameMeasureEl.offsetWidth + RENAME_INPUT_PADDING_PX)
}

// "tab 變成更名狀態時候的 tab 會抖動，希望是改完名字字數變化才允許抖動不是剛開始想要變更名稱就
// 抖動" — the jump used to happen the instant rename mode opened (label→input swap landing at
// a different width than the label had, plus the remove button's 28px vanishing at the same
// moment). Fixed two ways: renameInputWidth is measured and applied inside the SAME
// nextTick that follows this render (still before the browser's next paint, so nothing
// flashes through an intermediate width — see the CSS transition comment below for why that
// still animates on later, real edits), and the remove button reserves its footprint instead
// of disappearing (see the is-hidden class in the template). renameDraft starts equal
// to item.name, so this first measurement matches the label's own width exactly — the
// tab only actually resizes once renameDraft diverges from that (real typing), which is
// exactly what was asked for.
function startRename(item: PresetFolderItem) {
  renamingId.value = item.id
  renameDraft.value = item.name
  nextTick(() => {
    syncRenameInputWidth()
    renameInputEl?.focus()
    renameInputEl?.select()
  })
}

watch(renameDraft, () => {
  if (renamingId.value) nextTick(syncRenameInputWidth)
})

// Guarded by renamingId still matching: keyup.enter calls this and then the input's own
// blur (losing focus as the input unmounts) would call it again — the guard makes the
// second call a no-op instead of double-submitting or re-opening after Escape already
// cancelled.
function commitRename(item: PresetFolderItem) {
  if (renamingId.value !== item.id) return
  const trimmed = renameDraft.value.trim()
  if (trimmed && trimmed !== item.name) emit('rename', item.id, trimmed)
  renamingId.value = null
  renameInputWidth.value = null
}

function cancelRename() {
  renamingId.value = null
  renameInputWidth.value = null
}

// A press held past this starts dragging — short and deliberately snappy, so a real drag feels
// immediate. A plain click still reaches handleTabLabelClick normally (delay elapses with no
// real pointer movement afterward = sortable treats it as a click, not a drag); on the rare
// press that's long+still enough to straddle both, drag wins — not worth slowing every drag
// down to protect a single click.
const DRAG_DELAY_MS = 30

// Reverts sortable's own DOM move immediately in onEnd and lets Vue's reactive `items` order
// (via the reorder emit) re-render the actual DOM instead, the same pattern
// OrganismResultTable.vue uses for column drag-reorder — letting sortable's raw DOM mutation
// coexist with Vue's vdom would otherwise fight it on the next unrelated re-render.
const tabListRef = ref<HTMLElement>()
let sortable: Sortable | undefined

// "stock-preset-folder__tab-list 在tab之間切換仍會跳動，切到第一個的時候甚至
// stock-preset-folder__body 看起來會長高" — the body's height is driven entirely by
// whatever's slotted in (ScreenerOrganismFilters' condition count, or the results table's
// row count), so switching tabs snaps straight to the new one's height in a single frame.
// Tried smoothing this with a ResizeObserver-based useSmoothHeight composable — reverted
// (2026-09-01, user's own call after A/B testing it live) after it turned out to still
// mis-fire when switching between column-preset tabs backed by the exact same filtered
// row count (only the displayed fields differ, not the row count) — a case that should be
// a true no-op but wasn't. Plain, un-smoothed snap for now.

// Per direct request 2026-09-10 ("手機版上就不給拖曳調整Tab順序了") — a coarse (touch) primary
// pointer skips drag-reorder entirely; only a fine (mouse/trackpad) pointer gets it. Checked
// once at mount, not reactively — a device's pointer capability doesn't change mid-session in
// any case this app needs to handle, and re-checking on resize would just add complexity for a
// scenario (a touchscreen laptop being un/docked mid-use) far rarer than the two real targets
// (phone vs desktop). The keyboard-only equivalent (moveItem, Alt+Left/Right) stays available
// unconditionally regardless of pointer type — that's the real, always-present a11y path this
// was already built to guarantee (see moveItem's own comment), not something touch alone should
// lose.
function isCoarsePointer(): boolean {
  return window.matchMedia('(pointer: coarse)').matches
}

function attachSortable() {
  sortable?.destroy()
  sortable = undefined
  if (!tabListRef.value || isCoarsePointer()) return
  sortable = Sortable.create(tabListRef.value, {
    animation: 150,
    delay: DRAG_DELAY_MS,
    delayOnTouchOnly: false,
    // Without this, SortableJS defaults to the browser's own native HTML5 drag-and-drop
    // (setting draggable="true" on each .stock-preset-folder__tab item) — but a native
    // dragstart started on a <button> inside a draggable container is a well-known browser
    // limitation: most browsers let the button's own interaction semantics (focus/click)
    // take over instead of bubbling into the parent's drag gesture. Since
    // .stock-preset-folder__tab-label (the rename button) fills almost the entire visible
    // tab, that made drag effectively unusable — reported as "在按鈕上拖曳失效". forceFallback
    // makes SortableJS use its own mouse/touch-event simulation instead of relying on the
    // native API, which isn't subject to that button-swallows-the-gesture behavior.
    forceFallback: true,
    // forceFallback's own movement threshold — defaults to 0 (confirmed by reading
    // sortablejs's own source: `fallbackTolerance && distance < fallbackTolerance` is
    // skipped entirely when this is falsy), meaning ANY pointer movement after DRAG_DELAY_MS
    // elapses, even a single pixel of natural hand tremor during an ordinary click's hold,
    // immediately commits to a real drag — which then sets sortablejs's own internal
    // `ignoreNextClick` flag and swallows the click event before it ever reaches
    // handleTabLabelClick. At DRAG_DELAY_MS's now-short 30ms, a normal click (a human's
    // mousedown-to-mouseup is routinely 60-200ms) crosses that delay constantly, so this was
    // silently eating clicks-to-rename on the active tab (reported as the rename input
    // failing to open, or opening and immediately reverting). A few pixels of tolerance lets
    // ordinary click jitter stay a click while still letting a real, deliberate drag (which
    // moves far more than this almost immediately) start normally.
    fallbackTolerance: 8,
    // The remove icon and any non-editable (locked) tab shouldn't themselves start a drag —
    // a locked tab still stays in place as an anchor other tabs can be reordered around,
    // though. The rename input is filtered too: without it, a press to position the text
    // cursor (e.g. clicking between "1" and "2" in "123") still arms Sortable's drag
    // tracking on the surrounding .tab, and text-cursor placement routinely involves a little
    // more pointer movement than a plain click — enough to cross fallbackTolerance and get
    // treated as a real drag, which hijacks the mouseup/click the browser needs to place the
    // cursor and can blur the input via the same drag machinery fixed above. Filtering the
    // input out means a press starting inside it is never a drag candidate at all, so normal
    // text-input mouse behavior (click-to-position, click-and-drag-to-select) is untouched.
    filter: '.stock-preset-folder__tab-remove, .stock-preset-folder__tab.is-locked, .stock-preset-folder__tab-rename-input',
    preventOnFilter: false,
    onEnd(event) {
      const { oldIndex, newIndex, item, from } = event
      // oldIndex === newIndex checked BEFORE touching the DOM, not after: a plain click
      // (mousedown then mouseup with barely any movement) can still cross DRAG_DELAY_MS and
      // register as a trivial same-position "drag" via SortableJS's fallback mode — a bit of
      // incidental hand tremor during the hold is all it takes, no real drag intent needed.
      // removeChild/insertBefore below exists to undo Sortable's own DOM move so Vue's
      // reactive re-render can redo it correctly (see the comment above attachSortable) — but
      // when nothing moved, Sortable never touched the DOM in the first place, so running it
      // anyway was pure self-inflicted damage: removing a node that contains a focused
      // descendant (e.g. this same click having just opened this tab's rename `<input>` via
      // handleTabLabelClick) force-blurs it, and Chromium does not restore focus on
      // reinsertion — that blur then fires @blur="commitRename", instantly closing rename
      // mode. Reported as "輸入框有出現但很快消失" (the input appears then vanishes almost
      // immediately) right after lowering DRAG_DELAY_MS made this far easier to trigger.
      if (oldIndex === undefined || newIndex === undefined || oldIndex === newIndex) return
      from.removeChild(item)
      from.insertBefore(item, from.children[oldIndex] ?? null)

      const updated = [...props.items]
      const [moved] = updated.splice(oldIndex, 1)
      updated.splice(newIndex, 0, moved!)
      emit('reorder', updated.map(entry => entry.id))
    }
  })
}

onMounted(attachSortable)
onUnmounted(() => sortable?.destroy())

// Keyboard-only equivalent of the drag-to-reorder gesture above (docs/ui-ux/Taiwan Web
// Accessibility Guidelines.md — dragging has no keyboard path at all otherwise, a real
// 2.1.1 violation since reordering presets is only reachable via mouse/touch drag).
// Alt+Left/Right (not bare arrow keys) so it doesn't collide with normal text-cursor
// movement when a tab label button happens to have focus. Mirrors onEnd's own splice
// logic exactly, just driven by a fixed ±1 step instead of a drop index. `editable ===
// false` guard matches attachSortable's own drag filter (locked tabs can't be dragged
// either) — currently unreachable in practice since nothing sets editable: false yet, kept
// for parity if that ever changes.
function moveItem(item: PresetFolderItem, direction: -1 | 1) {
  if (item.editable === false) return
  const index = props.items.findIndex(entry => entry.id === item.id)
  if (index === -1) return
  const targetIndex = index + direction
  if (targetIndex < 0 || targetIndex >= props.items.length) return
  const updated = [...props.items]
  const [moved] = updated.splice(index, 1)
  updated.splice(targetIndex, 0, moved!)
  emit('reorder', updated.map(entry => entry.id))
}
</script>

<template>
  <div :class="['stock-preset-folder', { 'stock-preset-folder--fill-height': fillHeight }]">
    <div class="stock-preset-folder__switcher">
      <!-- Every saved preset as its own tab, on every screen size (see this file's own top
           comment for the 2026-09-10 simplification this replaced) — the row isn't capped, so
           it grows (and scrolls horizontally, see overflow-x below) as more presets are added,
           with "+" always sitting right after whichever tab is currently last. -->
      <div class="stock-preset-folder__switcher-full no-scrollbar">
        <div ref="tabListRef" class="stock-preset-folder__tab-list">
          <div
            v-for="item in items"
            :key="item.id"
            class="stock-preset-folder__tab"
            :class="{ 'is-active': item.id === activeId, 'is-locked': item.editable === false }"
          >
            <template v-if="renamingId === item.id">
              <input
                :ref="setRenameInputEl"
                v-model="renameDraft"
                :style="renameInputWidth != null ? { width: `${renameInputWidth}px` } : undefined"
                class="stock-preset-folder__tab-rename-input"
                maxlength="20"
                @keyup.enter="commitRename(item)"
                @keyup.esc="cancelRename"
                @blur="commitRename(item)"
              >
              <!-- Invisible mirror of the input's own text — offsetWidth here drives
                   renameInputWidth (see syncRenameInputWidth), which is how the input grows
                   to fit CJK text precisely instead of guessing via a fixed ch count. -->
              <span :ref="setRenameMeasureEl" class="stock-preset-folder__tab-rename-measure" aria-hidden="true">{{ renameDraft }}</span>
            </template>
            <button
              v-else
              type="button"
              class="stock-preset-folder__tab-label"
              @click="handleTabLabelClick(item)"
              @keydown.alt.left.prevent="moveItem(item, -1)"
              @keydown.alt.right.prevent="moveItem(item, 1)"
            >{{ item.name }}</button>
            <!-- Direct delete, no confirm dialog: this already is a single, deliberate click on
                 its own control, not a bare icon sitting in an easy-to-misclick spot.
                 Stays rendered (just visually hidden) while renaming rather than v-if'd away —
                 removing it outright used to shrink the tab by its own 28px the instant rename
                 opened, part of the same "抖動" this whole block was reworked to avoid. -->
            <button
              v-if="item.editable !== false"
              type="button"
              class="stock-preset-folder__tab-remove"
              :class="{ 'is-hidden': renamingId === item.id }"
              :aria-label="`刪除「${item.name}」`"
              @click.stop="emit('remove', item.id)"
            >
              <el-icon><Close /></el-icon>
            </button>
          </div>
        </div>

        <button v-if="!hideAdd" type="button" class="stock-preset-folder__add" aria-label="新增" @click="emit('add')">
          <el-icon><Plus /></el-icon>
        </button>
      </div>
    </div>

    <div class="stock-preset-folder__body">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.stock-preset-folder {
  position: relative;
}

.stock-preset-folder__switcher {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
}

.stock-preset-folder__switcher-full {
  display: flex;
  align-items: center;
  gap: 8px;
  /* Not capped or truncated — the row just grows as more presets exist and scrolls (both axes
     of input: touch swipe on mobile, wheel/trackpad on desktop) once it outgrows the folder's
     width, on every screen size (see this file's own top comment for the 2026-09-10
     simplification — this used to only apply above 768px, with a completely different mobile
     layout below it). */
  overflow-x: auto;
}

/* Its own wrapper (rather than putting the tabs directly in .switcher-full) so Sortable.js
   has a container holding ONLY the draggable tabs — the trailing "+" button is a sibling
   here, never a sortable item. flex-shrink: 0 so this never gets compressed below its
   tabs' natural combined width; overflow-x above handles the rest. */
/* No gap between tabs, per direct request 2026-09-10 ("Tab之間的間距 請移除") — each tab already
   carries its own visible border (see .stock-preset-folder__tab below), which alone is enough
   separation between adjacent tabs without extra whitespace. */
.stock-preset-folder__tab-list {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.stock-preset-folder__switcher-full.no-scrollbar {
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.stock-preset-folder__switcher-full.no-scrollbar::-webkit-scrollbar {
  display: none;
}

/* One tab per preset, on every screen size (see .stock-preset-folder__switcher-full's own
   comment) — every tab gets a real border so it reads as its own clickable tab rather than
   floating text; only the active one's bottom border drops out, merging it into the folder
   body right below it. Never shrinks or truncates: the row scrolls instead (see overflow-x
   on the parent).
   Two real buttons side by side (label + remove), not one button nested inside another —
   HTML doesn't allow nesting interactive elements, and this still needs the remove icon
   independently clickable without also triggering "switch to this tab". This wrapper carries
   the shared look (border/background/color); the two buttons inside stay visually
   transparent so they read as one cohesive tab. */
.stock-preset-folder__tab {
  flex-shrink: 0;
  height: 44px;
  display: flex;
  align-items: stretch;
  /* --el-border-color-lighter (barely different from a light-mode white background) read as
     "no border at all" in light mode — --el-border-color is the darkest/most visible step
     on Element Plus's own neutral border scale, still subtle enough for an inactive tab. */
  border: 1px solid var(--el-border-color);
  border-radius: 8px 8px 0 0;
  background: transparent;
  color: var(--el-text-color-secondary);
  overflow: hidden;
}

.stock-preset-folder__tab:hover {
  border-color: var(--el-color-primary-light-5);
  color: var(--el-color-primary);
}

.stock-preset-folder__tab.is-active {
  border-color: var(--el-color-primary-light-5);
  border-bottom-color: transparent;
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  /* font-weight is NOT toggled here — see .stock-preset-folder__tab-label's own comment for
     why (bold text is wider, so this used to shift every tab's position on every switch). */
}

.stock-preset-folder__tab-label {
  display: flex;
  align-items: center;
  justify-content: center;
  /* 4 Chinese characters' worth at this font-size, so a short name like "績優股" doesn't
     leave the tab looking noticeably narrower/cramped next to longer-named ones. 80px
     rather than a tight 4×16px=64px — real CJK glyph advance widths run a bit past 1em in
     most fonts, and 64px left a 4-character name reading as cramped/right at the edge. */
  min-width: 80px;
  padding: 0 8px 0 14px;
  border: none;
  background: transparent;
  color: inherit;
  font: inherit;
  /* Fixed, not `inherit`-from-.is-active — bold glyphs render wider than regular ones, so
     toggling this along with active state used to change every tab's own content-driven
     width the instant you switched, shifting the whole row ("stock-preset-folder__tab-list
     在tab之間切換仍會跳動"). Always bold instead — active/inactive is still plenty legible via
     border/background/color alone. */
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
  -webkit-user-select: none;
  user-select: none;
  -webkit-touch-callout: none;
}

/* A locked (non-editable) tab can't be dragged (see the sortable filter in the script), so
   it doesn't invite a press-and-hold the way the others do. */
.stock-preset-folder__tab.is-locked {
  cursor: default;
}

/* No outline: none here (was removed) — this input auto-focuses the instant rename starts
   (see startRename), so the browser's default focus ring is the only thing marking it as
   "you're now editing a field" for a keyboard user; stripping it left rename mode with zero
   visible focus indicator, a 2.4.7 violation. Padding matches .tab-label exactly (14px
   left, 8px right) so the swap from label to input at rename-start lands pixel-for-pixel on
   the same box. width is driven entirely by
   JS (see renameInputWidth/syncRenameInputWidth) rather than a fixed ch count, so it can
   match arbitrary CJK text precisely instead of guessing at a per-character advance width.
   The transition only ever animates a REAL edit (renameInputWidth changing after the input
   is already on screen) — the very first width, set inside the same nextTick this render
   flushes in, lands before the browser's next paint, so there's nothing rendered yet for a
   transition to animate away from. */
/* color: plain text color, not `inherit` (the active tab's primary accent) — this is the
   one visual difference between "showing a label" and "actually editing a field", so it
   reads like a real, focused text input rather than more of the same styled tab label. */
.stock-preset-folder__tab-rename-input {
  min-width: 80px;
  padding: 0 8px 0 14px;
  border: none;
  background: transparent;
  color: var(--el-text-color-primary);
  font: inherit;
  /* Fixed, not `inherit` — these are siblings of .tab-label (swapped in via v-if, not
     nested inside it), so they'd otherwise inherit from .stock-preset-folder__tab itself,
     which no longer sets a font-weight now that .tab-label's own is fixed rather than
     toggled via .is-active (see .tab-label's own comment). Kept matching .tab-label's 600
     so the measure span's width reading (and the input's own rendered text) stay accurate. */
  font-weight: 600;
  transition: width 120ms ease;
}

/* position: absolute takes this fully out of flow — it never affects the tab's own layout
   width, it only exists so its offsetWidth (real text metrics, not a ch-unit guess) can
   drive the input's width above. */
.stock-preset-folder__tab-rename-measure {
  position: absolute;
  visibility: hidden;
  white-space: pre;
  pointer-events: none;
  font: inherit;
  font-weight: 600;
}

.stock-preset-folder__tab-remove {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  border: none;
  background: transparent;
  color: inherit;
  opacity: 0.6;
  cursor: pointer;
  padding-right: 8px;
}

/* visibility (not v-if/display:none) — stays invisible and unclickable while renaming but
   keeps its 28px footprint, so the tab doesn't lose that width the instant rename opens. */
.stock-preset-folder__tab-remove.is-hidden {
  visibility: hidden;
  pointer-events: none;
}

.stock-preset-folder__tab-remove:hover {
  opacity: 1;
  color: var(--el-color-danger);
}

/* Restyled 2026-09-10 to share .stock-preset-folder__tab's own shell (border/height/
   rounded-top look) instead of a standalone circular icon button — per direct request ("所有
   presetTable的新增按鈕，都改為Tab的樣式，接在原本的Tab後面"), so it reads as one more tab
   trailing the row rather than a visually separate control. */
.stock-preset-folder__add {
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--el-border-color);
  border-radius: 8px 8px 0 0;
  background: transparent;
  color: var(--el-text-color-secondary);
  padding: 0;
  cursor: pointer;
}

.stock-preset-folder__add:hover {
  border-color: var(--el-color-primary-light-5);
  color: var(--el-color-primary);
}

/* No top border — the active tab's own open bottom edge (border-bottom: none/transparent
   on .stock-preset-folder__tab.is-active) already reads as continuous with the body right
   below it; a top border here would just cut back across
   that seam. No padding here on purpose — the two consumers want different insets
   (StockScreenerPresetTabs pads its pills for breathing room; StockScreenerResultPanel runs
   its table flush to the edges on mobile, where every pixel of table width matters more than
   a matching margin) — so each supplies its own via the default slot's content. */
.stock-preset-folder__body {
  margin-top: 43px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-top: none;
  /* Top corners stay square (only the bottom two round) — with no top border to begin with,
     a rounded top-left/top-right here has nothing to visually terminate against and just
     peeks out oddly wherever a tab above doesn't sit pixel-perfectly flush over it. */
  border-radius: 0 0 12px 12px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* fillHeight variant (see the `fillHeight` prop comment) — the folder and its body become a
   flex:1/min-height:0 region instead of sizing to content, so a bounded-height ancestor (see
   screener.vue's own .screener-page height calc) hands its remaining space down to whatever
   is slotted in here. `overflow: hidden` above is left as-is: the actual scrolling is done by
   <el-table height="100%"> itself (native sticky header + internal scroll), not by this div —
   two independent overflow:auto containers stacked here would mean two scrollbars. */
.stock-preset-folder--fill-height {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.stock-preset-folder--fill-height .stock-preset-folder__body {
  flex: 1;
  min-height: 0;
}

/* Desktop only — mobile still wants its content (in particular the result table) running
   flush to the edges, every pixel of screen width matters more there. On desktop there's
   width to spare, and a control like the result table's pagination row sitting flush
   against the folder's own border reads as a mistake, not a deliberate edge-to-edge choice.
   ScreenerOrganismFilters has its own matching desktop override to drop its own 16px padding
   here so the two don't stack into a doubled 32px inset. */
@media (min-width: 768px) {
  .stock-preset-folder__body {
    padding: 16px;
  }
}
</style>
