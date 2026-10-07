<script setup lang="ts">
import { STOCK_METRIC_INDEX } from '~/utils/stock-page-nav'
// 個股頁面導覽 — the links between /stock/:code's own sub-pages (the list itself is
// StockPageNavList.vue). Two real copies, always both in the SSR HTML, pure CSS decides which is
// visible — REWRITTEN 2026-09-21, replacing a `<ClientOnly><Teleport>` version that lived here
// from 2026-09-19 until a real bug was reported live（「為什麼sidebar會先出現在麵包屑上面再變成
// sidebar? 這個sidebar對於無障礙用戶來說，跳的過去嗎？該如何設計？」）.
//
// Why not fix it by making the Teleport unconditional instead of rewriting this component: tested
// directly (a throwaway layout+page mounting an unconditional `<Teleport to="#id">` into a named
// target living in a DIFFERENT component, no ClientOnly) — the SSR HTML came back with the target
// completely empty (confirmed via raw curl, not a DOM inspector guess), and hydration logged a
// real "Hydration node mismatch" / "Hydration completed but contains mismatches". Nuxt's own
// `NuxtTeleportSsrSlot` doesn't help here either — its own type declares it "only used within
// islands for slot teleport", a different, narrower feature this app doesn't use. Confirmed: Vue's
// SSR genuinely does not render Teleport content into an in-app named target during the server
// pass, whether that target lives in `document.body` (AppHeaderMenu.vue's own el-autocomplete
// popper hit the same failure mode first) or a named element in a different component.
//
// A same-request registered-state design（page writes its own code into a shared useState BEFORE
// the sidebar renders, by rendering the sidebar's mount point AFTER <main> in
// layouts/default.vue's own template）was designed next and set aside too, once a second question
// surfaced（「側欄的 DOM 位置改到 main 內容後面? 不能在前面嗎? 畢竟這樣的側邊欄是不是對於某些用戶
// 根本是絕緣的?」）: moving the rail's DOM position to AFTER all of a page's own main content would
// have made it the LAST thing a linear reader (a screen-reader user reading serially, or anyone
// tabbing straight through without a landmark jump) ever reaches, on every single page — a real
// cost for a control that exists to help visitors get around. The fix for THAT turned out not to
// need reordering anything: this list's own root is already `<nav aria-label="個股頁面">`
// (StockPageNavList.vue), and a `<nav>` is its own distinct, independently-jumpable ARIA landmark
// regardless of what element contains it — nesting it inside `<main>` costs nothing for landmark
// navigation, only the SEPARATE `<aside>` wrapper AppPinnedSidebar.vue used to provide is gone,
// which was decoration around that same `<nav>`, not a second landmark of its own.
//
// So: no Teleport, no shared registered state, no reordering — this component renders BOTH copies
// of the SAME list directly, in its own normal DOM position (right after the summary card, where
// the single copy already lived), and lets CSS alone decide which one is visible at which width,
// the same "duplicate, don't relocate" pattern layouts/default.vue already uses for its own
// AppMobileHeader/AppHeaderMenu pair. AppPinnedSidebar.vue — a generic, layout-owned shell that
// existed purely to give a page something to teleport into — is deleted in the same change;
// StockPageNav.vue was its only real consumer (confirmed: `grep` for AppPinnedSidebar's own class
// names turned up nothing but historical comments in unrelated files, no other functional use),
// so its own chrome (fixed positioning, centered-mode math, border/shadow, print-hiding) moved
// here rather than staying behind as a shell with nothing left to hold.
//
// That chrome moved on again 2026-09-22, to AppNavRail.vue, when 總經特區 became a second consumer
// （「macro-nav 能做成sidebar嗎」）— a slot wrapper with two real callers, not a mount point for a
// teleport. The two-copies-plus-CSS arrangement described above stays HERE, because only this
// component knows what the narrow-width copy of a three-level stock nav should be.
//
// Tab order on desktop is therefore "header → summary card's own controls → this nav (both copies
// exist, only the visible one is reachable — display:none is excluded from the tab order by every
// browser) → breadcrumb → page content", matching where the mobile copy already sat — a change
// from the OLD teleport version's "header → rail → page content" order, a tradeoff made
// deliberately for the reason above, not an oversight.
//
// 股息哪裡來 is no longer a page of its own (merged into 配股配息 2026-09-19); the badge pages are
// deliberately not listed while they're a pilot (shared/utils/f-score-pilot.ts) — they're linked from
// 公司健檢's own 獲利品質 section instead.
//
// THE PHONE COPY IS A BOTTOM SHEET（2026-09-23,「手機版的uiux要怎麼設計，才可以媲美電腦版的
// sidebar」→「底部吸附的 <details> 聽起來UIUX很棒，請這樣做吧」）.
//
// Measured first, on /stock/2330 at 375×812: the inline copy was 384px tall（eight top-level rows）
// sitting at y=346, i.e. it took 47% OF THE FIRST SCREEN before any answer, and then scrolled out
// of reach for the remaining 91% of a 4,524px page. Both halves are wrong at once — too intrusive
// where the reader wants an answer, absent everywhere they might want to move. The desktop rail's
// whole value is the opposite pair: always there, one tap to any sibling page.
//
// A native <details> pinned to the bottom edge gets both back for ~340px of first screen:
// collapsed it is a 48px bar naming the page you are on, open it is a scrollable sheet holding the
// same grouped menu. Native, so it needs no JavaScript, is keyboard-operable as shipped, and is
// not a dialog — nothing stacks on anything（this app's own rule about never opening a confirm
// over an open dialog）.
//
// WHY NOT el-drawer, which is what a bottom sheet usually is: its content is not in the SSR HTML
// until it opens, and these links ARE the site's internal link graph — check-click-depth.mjs reads
// the raw server HTML to prove every one of ~2,300 stock URLs is within three clicks of /. A
// drawer would quietly cut that. Inside a closed <details> the anchors are still in the markup.
//
// The bar is `fixed`, so it reserves no space of its own; <body> gets the padding instead, via a
// class this component sets（see main.css）— body rather than main because the footer lives
// outside <main> and would otherwise stay under the bar. `sticky` was considered and does not help: it
// it still covers the last 48px of content once the container's end scrolls into view, so the
// padding would be needed anyway, and it additionally leaves a hole where the element used to sit.
//
// 2026-10-07：這條的外殼（固定、展開、關閉、body 留白）搬到 AppBottomNav.vue，全站區內導覽共用（使用者選了
// 「底部固定條＋展開清單」統一手機）。這裡只決定清單內容與「目前：XX」。
const props = defineProps<{ code: string }>()

const route = useRoute()
// 釘選的指標頁（例如 /roe）也要寫出目前在哪一頁：原本只查 STOCK_NAV_ITEMS，所以那些頁的這條只剩「其他頁面」
const activeLabel = computed(() => activeLabelFor(STOCK_NAV_ITEMS, props.code, route.path) ?? activeLabelFor(STOCK_METRIC_INDEX, props.code, route.path))
</script>

<template>
  <AppBottomNav :current="activeLabel" label="個股頁面清單">
    <StockPageNavList :code="code" vertical />
  </AppBottomNav>

  <AppNavRail label="個股頁面導覽（釘選）">
    <StockPageNavList :code="code" vertical />
  </AppNavRail>
</template>
