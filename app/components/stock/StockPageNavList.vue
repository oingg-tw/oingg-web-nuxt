<script setup lang="ts">
import { ArrowDown } from '@element-plus/icons-vue'

// The 個股頁面 link list itself — the markup StockPageNav.vue renders either in the page body
// (phone/tablet, and the server-rendered fallback on every width) or, on desktop, inside the
// left rail via Teleport (see that file). Plain `NuxtLink`s in a labelled `<nav>`, NOT
// role="tablist": these navigate to different URLs, they don't switch panels in place, so tab
// semantics would lie to assistive tech. vue-router puts `aria-current="page"` on the
// exact-active link (SSR included), so the active state needs no hand-rolled comparison; the
// styling hooks that attribute and uses weight + underline + background, never colour alone.
//
// ≥48px targets with an 8px gap (this app's own audience-driven floor, above WCAG's 24×24).
// Chinese labels only, no icons — except the one disclosure chevron below, which pairs an icon
// with visible "展開"/"收合" text per this app's own icon+text rule, not an icon standing alone.
const props = defineProps<{
  code: string
  // Rail layout (desktop): one link per row, full width.
  vertical?: boolean
}>()

// 公司健檢 removed 2026-09-19 (see app/pages/stock/[code]/company-health.vue's own comment —
// unpublished pending a redesign), leaving 4 top-level items.
//
// 財務報表 gained 3 children 2026-09-20 per direct request ("financial-statements 底下又分了三表
// 這種" — a multi-level nav — "then 拆成 4 個 URL"): the latest filing's three tables moved to
// their own pages (/balance-sheet, /income-statement, /cash-flow-statement — see those pages' own
// top comments), and 財務報表 itself stays a real page (the "browse any period" widget), so it's
// both a link AND a parent. `children` is optional — every other item stays a plain leaf; the
// template below renders a disclosure toggle + nested list only for items that have one.
const NAV_ITEMS = [
  { label: '亮點與風險', to: (code: string) => `/stock/${code}` },
  { label: '配股配息', to: (code: string) => `/stock/${code}/dividend` },
  { label: '指標歷史', to: (code: string) => `/stock/${code}/metrics-history` },
  {
    label: '財務報表',
    to: (code: string) => `/stock/${code}/financial-statements`,
    children: [
      { label: '資產負債表', to: (code: string) => `/stock/${code}/balance-sheet` },
      { label: '損益表', to: (code: string) => `/stock/${code}/income-statement` },
      { label: '現金流量表', to: (code: string) => `/stock/${code}/cash-flow-statement` }
    ]
  }
]

// Turned into a real dropdown 2026-09-20 per direct follow-up ("stock-page-nav__item 財務報表
// 這邊希望也改成下拉選單") — was an always-expanded plain list (that day's own earlier reasoning:
// 3 extra links is under the "don't collapse into an accordion below 10 links" bar). The link
// itself still navigates normally on click; a SEPARATE disclosure button toggles the sublist,
// since 財務報表 is both a real page and a group at once — folding the two into one control would
// mean a click either can't navigate or can't toggle, never both. Starts open when the current
// page is 財務報表 itself or one of its own children, so arriving on /balance-sheet doesn't hide
// the very group it belongs to; this component remounts fresh on each client-side navigation
// between sibling stock pages (they're different route components), so a plain ref computed once
// at setup — not a live route watcher — already stays correct across that navigation.
const route = useRoute()
const openGroups = reactive<Record<string, boolean>>(
  Object.fromEntries(
    NAV_ITEMS.filter(item => item.children).map(item => [
      item.label,
      item.to(props.code) === route.path || item.children!.some(child => child.to(props.code) === route.path)
    ])
  )
)

function toggleGroup(label: string) {
  openGroups[label] = !openGroups[label]
}
</script>

<template>
  <nav class="stock-page-nav" :class="{ 'stock-page-nav--vertical': vertical }" aria-label="個股頁面">
    <ul class="stock-page-nav__list">
      <li v-for="item in NAV_ITEMS" :key="item.label" class="stock-page-nav__item">
        <div class="stock-page-nav__row">
          <NuxtLink :to="item.to(props.code)" class="stock-page-nav__link" :class="{ 'stock-page-nav__link--grouped': item.children }">{{ item.label }}</NuxtLink>
          <button
            v-if="item.children"
            type="button"
            class="stock-page-nav__toggle"
            :aria-expanded="openGroups[item.label]"
            :aria-controls="`stock-page-nav-sublist-${item.label}`"
            @click="toggleGroup(item.label)"
          >
            <el-icon aria-hidden="true" class="stock-page-nav__toggle-icon" :class="{ 'is-open': openGroups[item.label] }"><ArrowDown /></el-icon>
            {{ openGroups[item.label] ? '收合' : '展開' }}
          </button>
        </div>
        <ul v-if="item.children && openGroups[item.label]" :id="`stock-page-nav-sublist-${item.label}`" class="stock-page-nav__sublist">
          <li v-for="child in item.children" :key="child.label" class="stock-page-nav__item">
            <NuxtLink :to="child.to(props.code)" class="stock-page-nav__link stock-page-nav__link--child">{{ child.label }}</NuxtLink>
          </li>
        </ul>
      </li>
    </ul>
  </nav>
</template>

<style scoped>
.stock-page-nav__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

/* Link + toggle button share one row — a plain flex row works in both layouts (wrap and rail)
   without a separate rule per layout. */
.stock-page-nav__row {
  display: flex;
  align-items: stretch;
  gap: 4px;
}

.stock-page-nav__link {
  display: inline-flex;
  align-items: center;
  min-height: 3rem;
  padding: 0 1rem;
  border-radius: 8px;
  border: 1px solid var(--el-border-color-lighter);
  background: var(--el-fill-color-blank);
  font-size: 1rem;
  color: var(--el-text-color-regular);
  text-decoration: none;
}

.stock-page-nav__link:hover {
  background: var(--el-fill-color-light);
  color: var(--el-text-color-primary);
}

/* Grouped parent's own link loses its right-side rounding where the toggle button sits flush
   against it, reading as one combined control despite being two separate ones. */
.stock-page-nav__link--grouped {
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
  border-right: none;
}

/* Real <button>, icon + visible "展開"/"收合" text (this app's own icon+text rule — no bare
   chevron). ≥44px on both axes; the chevron rotates 180° open, a plain CSS transform rather than
   swapping icon components. */
.stock-page-nav__toggle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-width: 44px;
  min-height: 44px;
  padding: 0 0.75rem;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
  background: var(--el-fill-color-blank);
  color: var(--el-text-color-regular);
  font-size: 1rem;
  cursor: pointer;
}

.stock-page-nav__toggle:hover {
  background: var(--el-fill-color-light);
  color: var(--el-text-color-primary);
}

.stock-page-nav__toggle-icon {
  transition: transform 0.15s ease;
}

.stock-page-nav__toggle-icon.is-open {
  transform: rotate(180deg);
}

/* Current page = the link vue-router marks exact-active. Weight + underline + tinted background
   together (not colour alone) so the state survives greyscale, forced-colors and colour-vision
   deficiencies. Text in dark-2 for extra margin over the 4.5:1 text floor (the accents
   themselves were retuned to 4.5:1 on 2026-09-19). */
.stock-page-nav__link[aria-current='page'] {
  font-weight: 700;
  color: var(--el-color-primary-dark-2);
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  text-decoration: underline;
  text-underline-offset: 4px;
  text-decoration-thickness: 2px;
}

/* Nested 財務報表 children (2026-09-20) — a fixed left indent + border, not a smaller font (this
   app's own 16px floor applies to every level, no exceptions), so the sub-level reads as "part of
   財務報表" through position/grouping rather than shrinking below the readable-text floor. Same
   ≥44px target height as every other nav link, just less horizontal padding. Works unstyled in
   both layouts: the default (wrap) list's own <li> is a flex item, and this <ul> simply stacks as
   a normal block child below that item's own row inside it, no extra flex rule needed. */
.stock-page-nav__sublist {
  list-style: none;
  margin: 4px 0 0;
  padding: 0 0 0 12px;
  border-left: 2px solid var(--el-border-color-lighter);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stock-page-nav__link--child {
  min-height: 44px;
  padding: 0 0.75rem;
}

/* Rail layout: a padded column of full-width rows. */
.stock-page-nav--vertical {
  padding: 16px 12px;
}

.stock-page-nav--vertical .stock-page-nav__list {
  flex-direction: column;
  gap: 4px;
}

.stock-page-nav--vertical .stock-page-nav__row {
  width: 100%;
}

.stock-page-nav--vertical .stock-page-nav__link {
  display: flex;
  flex: 1;
  min-width: 0;
}

.stock-page-nav--vertical .stock-page-nav__link--child {
  flex: none;
  width: 100%;
}
</style>
