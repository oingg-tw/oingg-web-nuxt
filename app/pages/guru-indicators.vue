<script setup lang="ts">
import { Search } from '@element-plus/icons-vue'
import { GURU_BADGE_CATEGORIES, GURU_CATEGORY_ICON, buildGuruBadges } from '~/utils/guru-badges'
import type { GuruBadge, GuruBadgeCategory } from '~/utils/guru-badges'

// 大師徽章（2026-09-14 定名，之前叫 徽章與指標／徽章系統／大師指標，見 app-features.ts）。原本有兩層：有門檻的徽章，加上其他指標的
// 純參考表；2026-09-14 只留徽章（「不再顯示指標，因為表格模式取代了指標」——個股頁的歷年統計表已把每支指標當數字列出，這裡再放
// 一份無代號的參考表是重複的，表格列元件同日刪除）。
// 版面（2026-09-10 確認）：單一可捲動頁面＋搜尋框＋錨點 chip 列，不分頁籤——螢幕閱讀器能線性讀完、瀏覽器的 Ctrl+F 能一次搜全部。
// `await useFilterSchema()`（不是裸呼叫）：不 await 的話 SSR 會在真正的抓取完成前把空的 schema 序列化出去，而 hydration 的
// 快取重用不會再試一次（2026-09-10 在個股頁踩過）。
const { data: filterSchema } = await useFilterSchema()
useSeoMeta({ title: '大師徽章' })

interface CategoryGroup {
  category: GuruBadgeCategory
  anchor: string
  badges: GuruBadge[]
}

// 依 GURU_BADGE_CATEGORIES 的顯示順序排，不是 GET /metrics 的分類順序（後端順序是資料，不是版面）
const categoryGroups = computed<CategoryGroup[]>(() => {
  const categories = filterSchema.value?.categories ?? []
  const allBadges = buildGuruBadges(categories)

  return GURU_BADGE_CATEGORIES.map(category => {
    const badges = allBadges.filter(badge => badge.category === category)
    return { category, anchor: `guru-cat-${category}`, badges }
  }).filter(group => group.badges.length > 0)
})

const searchQuery = ref('')

function matchesQuery(text: string, query: string): boolean {
  return text.toLowerCase().includes(query)
}

const filteredGroups = computed<CategoryGroup[]>(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return categoryGroups.value
  return categoryGroups.value
    .map(group => ({
      ...group,
      badges: group.badges.filter(
        badge => matchesQuery(badge.name, query) || matchesQuery(badge.nameEn, query) || matchesQuery(badge.author, query)
      )
    }))
    .filter(group => group.badges.length > 0)
})
const matchCount = computed(() => filteredGroups.value.reduce((sum, group) => sum + group.badges.length, 0))

// 這一頁用瀏覽器原生的片段導覽（href="#…"），滑行是刻意的——main.css 的 scroll-behavior 規則
// 2026-09-26 起改成 opt-in，見那裡的註解。
useHead({ htmlAttrs: { class: 'smooth-anchors' } })
</script>

<template>
  <div class="guru-indicators-page">
    <h1 class="app-page__title app-page__title--app guru-indicators-page__title">大師徽章</h1>
    <p class="guru-indicators-page__subtitle">
      公開學術文獻與投資實務中常見的財務評分方法論參考手冊——不是任何一檔股票的評等或投資建議
    </p>

    <!-- 看不見但朗讀得到的 label（WCAG 3.3.2）：placeholder 清掉或聚焦後就不是名稱了 -->
    <label for="guru-indicators-search" class="visually-hidden">搜尋徽章名稱</label>
    <el-input
      id="guru-indicators-search"
      v-model="searchQuery"
      class="guru-indicators-page__search"
      placeholder="搜尋徽章名稱，例如 ROE、F-Score"
      clearable
      :prefix-icon="Search"
    />
    <p v-if="searchQuery.trim()" class="visually-hidden" role="status">{{ matchCount }} 個符合</p>

    <!-- 分類列不上色、只放 icon（使用者指定，同個股頁的分類列；GURU_CATEGORY_ICON 兩邊共用） -->
    <nav v-if="filteredGroups.length" class="guru-indicators-page__nav" aria-label="分類快速跳轉">
      <a v-for="group in filteredGroups" :key="group.anchor" :href="`#${group.anchor}`" class="guru-indicators-page__nav-link">
        <el-icon class="guru-indicators-page__nav-icon"><component :is="GURU_CATEGORY_ICON[group.category]" /></el-icon>
        {{ group.category }}
      </a>
    </nav>

    <el-empty v-if="!filteredGroups.length" description="找不到符合的徽章" :image-size="72" />

    <section v-for="group in filteredGroups" :id="group.anchor" :key="group.anchor" class="guru-indicators-page__section">
      <h2 class="guru-indicators-page__section-title">
        <el-icon class="guru-indicators-page__section-icon"><component :is="GURU_CATEGORY_ICON[group.category]" /></el-icon>
        {{ group.category }}
      </h2>

      <div class="guru-indicators-page__grid">
        <GuruBadgeCard v-for="badge in group.badges" :key="badge.id" :badge="badge" />
      </div>
    </section>
  </div>
</template>

<style scoped>
.guru-indicators-page {
  width: 100%;
}

/* 標題與副標之間 8px：縮標題的下緣，不用負 margin 把副標拉上來（2026-09-16 全站禁負 margin） */
.guru-indicators-page__title {
  margin: 0 0 8px;
}

.guru-indicators-page__subtitle {
  font-size: 1rem;
  color: var(--el-text-color-secondary);
  margin: 0 0 24px;
}

.guru-indicators-page__search {
  max-width: 420px;
  margin-bottom: 16px;
}

.guru-indicators-page__nav {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 32px;
}

.guru-indicators-page__nav-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 999px;
  border: 1px solid var(--el-border-color);
  font-size: 1rem;
  color: var(--el-text-color-primary);
  text-decoration: none;
}

.guru-indicators-page__nav-link:hover {
  background: var(--el-fill-color-light);
}

.guru-indicators-page__nav-icon {
  flex-shrink: 0;
  color: var(--el-text-color-secondary);
}

.guru-indicators-page__section-icon {
  flex-shrink: 0;
  color: var(--el-text-color-secondary);
}

.guru-indicators-page__section {
  scroll-margin-top: 16px;
}

.guru-indicators-page__section + .guru-indicators-page__section {
  margin-top: 40px;
}

.guru-indicators-page__section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0 0 16px;
}

.guru-indicators-page__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}
</style>
