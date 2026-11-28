<script setup lang="ts">
import { Menu, Search } from '@element-plus/icons-vue'

// 手機頁首——layouts/default.vue 在每個寬度都掛它（CSS 在 ≥1280px 藏起來、改顯示 AppHeaderMenu）。2026-09-06 從單一共用元件
// 拆出（「手機板的行為 與 電腦版的行為落差滿大的」）；2026-09-19 起根元素是 <header>，同桌機。
// 兩個角落按鈕都開「全螢幕滑入圖層」而不是對話框（2026-09-23，「比照元大券商軟體」）：方向跟按鈕同側——選單在左上，圖層從左
// 進、把頁面推右；搜尋在右上則相反。左側原本是回首頁的 AppLogo，改成選單觸發；右側收成一個搜尋圖示。
// 這個檔案不再擁有對話框、捲動鎖或路由 watcher：圖層由版面渲染（它得是滑動舞台的兄弟，不然這個頁首的 backdrop-filter 會把
// fixed 子元素困在 65px 的盒子裡），AppSlideLayer 管捲動鎖與 Escape，useSlideLayer 管讓手機返回鍵關圖層的 history entry。
const { toggle } = useSlideLayer()

// Closing on navigation still has to happen — a link inside a layer routes without unmounting
// this header. It lives here rather than in the composable because `useRoute` belongs to a
// component's setup, and this is the one component both layers' triggers share.
const { close: closeSlideLayer } = useSlideLayer()
const route = useRoute()
watch(() => route.fullPath, () => {
  closeSlideLayer()
})

const barRef = ref<HTMLElement>()
useHeaderHeightMeasure(barRef)
const unseen = useInboxUnseen()
</script>

<template>
  <header ref="barRef" class="mobile-header">
    <!-- 圖示＋文字（2026-09-19：每個功能圖示都要有文字）。2026-10-21 頁首重新設計：跟桌機頁首同一個樣子（.app-bar-item，main.css）
         ——原本是 Element 的框線按鈕，兩個頁首各長各的。原生 <button>：沒有 Element 的框線、內距與高度要蓋 -->
    <!-- 有未讀的站內信時（2026-11-16）圖示右上角疊數字，不佔寬度（logo 才不會移動）；選單裡多一列「站內信」 -->
    <button type="button" class="app-bar-item mobile-header__btn" @click="toggle('menu')">
      <el-icon aria-hidden="true"><Menu /></el-icon>選單
      <span v-if="unseen" class="mobile-header__badge" aria-hidden="true">{{ unseenText(unseen) }}</span>
      <span v-if="unseen" class="visually-hidden">，{{ unseen }} 則未讀站內信</span>
    </button>
    <!-- 「logo/站名 請水平置中」：兩顆按鈕一樣寬，justify-content: space-between 把 logo 放在正中間（.mobile-header）。原本左右各一個
         flex: 1 的空白元素做同一件事，但多佔兩個 8px 的間距：320 寬、字級 110% 以上時「搜尋」被推出畫面（2026-11-28） -->
    <!-- always-show-name: without it AppLogo hides the "安盈選股" text below 1280px (correct
         default for the app-shell's OWN dense header, which competes for space with a search
         bar/sidebar trigger there — see AppLogo.vue's own comment) — this header has no such
         competing chrome, and landing.vue's sticky header already opts into the same override
         for the identical reason. -->
    <AppLogo always-show-name home-accesskey class="mobile-header__logo" />
    <!-- accesskey="s"（2026-09-16 是 n，2026-10-08 改成無障礙規範 2.0 慣例的 S；配置見 pages/sitemap.vue）：這顆按鈕本來就做 Alt+S 要做的事（開搜尋圖層），不像桌機的
         內嵌輸入框得另放一顆隱藏的觸發鈕（見 AppHeaderMenu）。 -->
    <button type="button" class="app-bar-item mobile-header__btn" accesskey="s" title="搜尋區塊" @click="toggle('search')">
      <el-icon aria-hidden="true"><Search /></el-icon>搜尋
    </button>

</header>
</template>

<style scoped>
.mobile-header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 10;
  /* 圖層滑動時補回畫面上緣（layouts/default.vue 的 stageStyle） */
  translate: 0 var(--app-stage-top, 0px);
  display: flex;
  align-items: center;
  /* logo 在兩顆一樣寬的按鈕正中間（「logo/站名 請水平置中」） */
  justify-content: space-between;
  gap: 8px;
  /* 60px：44px 的控制項上下各 8px，同桌機頁首 */
  padding: calc(8px + env(safe-area-inset-top)) calc(16px + env(safe-area-inset-right, 0px)) 8px calc(16px + env(safe-area-inset-left, 0px));
  /* 純色，同 AppHeaderMenu（2026-10-21「背景不要 再有 樣式 改成純色就好」） */
  background: var(--el-bg-color);
  box-shadow: 0 2px 8px rgb(0 0 0 / 40%);
  /* 兩顆按鈕的左右內距看這一列放不放得下（下面的 @container） */
  container-type: inline-size;
}

/* 按鈕的左右內距（2026-11-28）：320 寬的手機、外觀設定字級 110% 以上時，選單、logo、搜尋加兩個間距放不下，「搜尋」被推出畫面 12～29px。
   放不下時內距從 12px 收成 4px（每顆省 16px）；按鈕還是 44px 高、寬 60px 以上。門檻量過（三樣加兩個 8px 間距，不含這一列左右的 16px）：
   字級 100% 要 284px（17.75rem），110% 要 301px（17.1rem），120% 要 317px（16.5rem）；取最大的 17.75rem，rem 跟著字級變，三種字級都在放不下之前換。
   手機優先：不支援容器查詢的瀏覽器（iOS 15）拿收緊的那一種，哪裡都放得下 */
.mobile-header__btn {
  padding-inline: 4px;
}

@container (min-width: 17.75rem) {
  .mobile-header__btn {
    padding-inline: 12px;
  }
}

/* 未讀站內信的數字（2026-11-16）：疊在選單圖示右上角，不佔寬度；樣子同頁首「帳號」上的那個（UserMenuButton） */
.mobile-header__btn {
  position: relative;
}

.mobile-header__badge {
  position: absolute;
  top: 0.125rem;
  left: 1.375rem;
  min-width: 1.25rem;
  height: 1.25rem;
  box-sizing: border-box;
  padding: 0 0.375rem;
  border-radius: 999px;
  background: var(--el-text-color-primary);
  color: var(--el-bg-color);
  font-size: 0.75rem;
  font-weight: 700;
  line-height: 1.25rem;
  text-align: center;
}

/* flex-shrink: 0 like the buttons (.app-bar-item): without it the logo/name group, the widest child,
   would be the first to give up space at very narrow widths and squeeze its text; the buttons'
   padding gives way instead (the @container above). */
.mobile-header__logo {
  flex-shrink: 0;
}
</style>
