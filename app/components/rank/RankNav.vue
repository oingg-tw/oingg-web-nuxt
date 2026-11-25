<script setup lang="ts">
import { ArrowRight } from '@element-plus/icons-vue'

// 排行的側欄（2026-11-25，使用者在方案頁選 C：https://claude.ai/artifact/9JJaUodgKjP5kQhFG8G94L ，原因是「從menu點進來看不太出來使用流程」）：
// 側欄就是總覽的目錄。排行總覽在最上面，下面是普通股與 ETF 的分類，跟總覽的卡片同名同順序（RANK_CATEGORIES）；點分類在原地展開它的
// 排行，排行頁打開時那一類自己展開、目前那一個標起來。取代 10-21 的「類別」切換與 11-23 的熱門清單：普通股與 ETF 用組標題分開，
// 每一種排行都在兩下之內。手機的「其他頁面」是同一份目錄，兩份 DOM 的理由在 SharedSectionNav.vue。收起來的排行用 v-show，連結照樣在
// 伺服器的 HTML 裡（check-click-depth 走連結證明每一頁都到得了）
const route = useRoute()
const GROUPS = [{ name: '普通股', etf: false }, { name: 'ETF', etf: true }].map(group => ({
  name: group.name,
  categories: RANK_CATEGORIES
    .map(category => ({ ...category, pages: RANK_PAGES.filter(page => page.category === category.key && (page.universe === 'etf') === group.etf) }))
    .filter(category => category.pages.length)
}))
const currentPage = computed(() => RANK_PAGES.find(page => rankPath(page.slug) === route.path) ?? null)
const open = ref(new Set<string>(currentPage.value ? [currentPage.value.category] : []))
// 從一類換到另一類的排行（膠囊列、卡片）時，新的那一類也展開；使用者自己打開的照舊
watch(currentPage, (page) => {
  if (page && !open.value.has(page.category)) open.value = new Set([...open.value, page.category])
})
function toggle(key: string) {
  const next = new Set(open.value)
  if (!next.delete(key)) next.add(key)
  open.value = next
}
const categoryTitle = (key: string) => RANK_CATEGORIES.find(category => category.key === key)?.title ?? ''
// 手機底部條「目前：獲利・五年平均 ROE」
const current = computed(() => (currentPage.value ? `${categoryTitle(currentPage.value.category)}・${currentPage.value.short ?? currentPage.value.label}` : '排行總覽'))
</script>

<template>
  <!-- 窄螢幕：底部條打開的「其他頁面」。清單在下面再寫一次（理由同 SharedSectionNav：兩份都要在 DOM 裡），id 加前綴分開 -->
  <AppBottomNav :current="current" label="排行清單">
    <nav aria-label="排行">
      <ul class="rail-list">
        <li><NuxtLink to="/rank" class="rail-item">排行總覽</NuxtLink></li>
        <template v-for="group in GROUPS" :key="group.name">
          <li class="rail-heading">{{ group.name }}</li>
          <li v-for="category in group.categories" :key="category.key">
            <button type="button" class="rail-item rank-nav__toggle" :aria-expanded="open.has(category.key)" :aria-controls="`rank-nav-sheet-${category.key}`" @click="toggle(category.key)">
              <el-icon class="rank-nav__chevron" aria-hidden="true"><ArrowRight /></el-icon>{{ category.title }}<span class="rank-nav__count">{{ category.pages.length }}</span>
            </button>
            <ul v-show="open.has(category.key)" :id="`rank-nav-sheet-${category.key}`" class="rank-nav__pages">
              <li v-for="page in category.pages" :key="page.slug">
                <NuxtLink :to="rankPath(page.slug)" class="rail-item rank-nav__page">{{ page.short ?? page.label }}</NuxtLink>
              </li>
            </ul>
          </li>
        </template>
      </ul>
    </nav>
  </AppBottomNav>

  <AppNavRail label="排行導覽（釘選）">
    <nav aria-label="排行">
      <ul class="rail-list">
        <li><NuxtLink to="/rank" class="rail-item">排行總覽</NuxtLink></li>
        <template v-for="group in GROUPS" :key="group.name">
          <li class="rail-heading">{{ group.name }}</li>
          <li v-for="category in group.categories" :key="category.key">
            <button type="button" class="rail-item rank-nav__toggle" :aria-expanded="open.has(category.key)" :aria-controls="`rank-nav-rail-${category.key}`" @click="toggle(category.key)">
              <el-icon class="rank-nav__chevron" aria-hidden="true"><ArrowRight /></el-icon>{{ category.title }}<span class="rank-nav__count">{{ category.pages.length }}</span>
            </button>
            <ul v-show="open.has(category.key)" :id="`rank-nav-rail-${category.key}`" class="rank-nav__pages">
              <li v-for="page in category.pages" :key="page.slug">
                <NuxtLink :to="rankPath(page.slug)" class="rail-item rank-nav__page">{{ page.short ?? page.label }}</NuxtLink>
              </li>
            </ul>
          </li>
        </template>
      </ul>
    </nav>
  </AppNavRail>
</template>

<style scoped>
.rank-nav__chevron {
  flex: none;
  color: var(--el-text-color-secondary);
  transition: transform 0.15s;
}

.rank-nav__toggle[aria-expanded='true'] {
  font-weight: 600;
}

.rank-nav__toggle[aria-expanded='true'] .rank-nav__chevron {
  transform: rotate(90deg);
}

/* 這一類有幾種排行：靠右、次要字色，不跟名稱擠 */
.rank-nav__count {
  margin-left: auto;
  font-weight: 400;
  color: var(--el-text-color-secondary);
}

.rank-nav__pages {
  margin: 0;
  padding: 0;
  list-style: none;
}

/* 展開的排行跟分類名稱的字對齊（箭頭 16px＋間距 8px＋列的左邊 20px） */
.rank-nav__page {
  padding-left: 44px;
}
</style>
