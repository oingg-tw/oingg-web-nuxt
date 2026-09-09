<script setup lang="ts">
import { ArrowRight, OfficeBuilding } from '@element-plus/icons-vue'
import type { IndustryTreeChild } from '~/composables/industries/useIndustryTree'

// 產業追蹤 — replaces the earlier placeholder shell per direct request ("GET /industries/tree
// 這個API請串好 然後功能放在產業追蹤"). Confirmed live with bff-ts 2026-09-09 (see
// useIndustryTree.ts's own comment for the full schema/behavior notes) before writing this.
//
// A drill-down browser, not a flat list — the tree is 5 levels deep (section→division→group→
// class→subclass) and only the subclass leaf ever has a real company list, so the natural UI is
// "click a row to go one level deeper," same interaction whether that row turns out to have more
// sub-categories or turns out to be the leaf with companies. `path` is this page's own breadcrumb
// stack (the API has no ancestor-chain field to read back), starting with the root ({code:
// undefined, name: '全部產業'}) which is never poppable.
const router = useRouter()
const { data, pending, load } = useIndustryTree()

interface PathEntry {
  code: string | undefined
  name: string
}

const path = ref<PathEntry[]>([{ code: undefined, name: '全部產業' }])
const currentCode = computed(() => path.value[path.value.length - 1]!.code)

watch(currentCode, code => load(code), { immediate: true })

// Hide 0-company categories per direct request ("產業樹，如果有那種0家的，可以就隱藏嗎") —
// safe to filter purely on companyCount because bff-ts's own tree aggregates it across the
// WHOLE subtree (confirmed live: 農、林、漁、牧業's companyCount 4 already equals the sum of its
// 3 children's own counts), so a 0 here means genuinely nothing exists anywhere underneath that
// node, not just at this one level — filtering it out never hides a real company.
const visibleChildren = computed(() => data.value?.children.filter(child => child.companyCount > 0) ?? [])

function drillInto(child: IndustryTreeChild) {
  path.value.push({ code: child.code, name: child.name })
}

function jumpTo(index: number) {
  path.value = path.value.slice(0, index + 1)
}

function goToStock(symbol: string) {
  router.push(`/stock/${symbol}`)
}
</script>

<template>
  <div class="industries-page">
    <h1 class="industries-page__title">產業追蹤</h1>
    <p class="industries-page__subtitle">
      依台灣稅籍登記行業分類逐層瀏覽——與個股頁的證交所產業分類是不同的兩套系統，不能互相對照
    </p>

    <el-breadcrumb class="industries-page__breadcrumb" separator="/">
      <el-breadcrumb-item v-for="(entry, index) in path" :key="entry.code ?? 'root'">
        <button type="button" class="industries-page__crumb" :disabled="index === path.length - 1" @click="jumpTo(index)">
          {{ entry.name }}
        </button>
      </el-breadcrumb-item>
    </el-breadcrumb>

    <div v-loading="pending" class="industries-page__body">
      <template v-if="data?.found">
        <p v-if="data.level" class="industries-page__count">
          {{ data.name }}　共 {{ data.companyCount }} 家公司
        </p>

        <ul v-if="visibleChildren.length > 0" class="industries-page__list">
          <li v-for="child in visibleChildren" :key="child.code">
            <button type="button" class="industries-page__row" @click="drillInto(child)">
              <span class="industries-page__row-name">{{ child.name }}</span>
              <span class="industries-page__row-count">{{ child.companyCount }} 家</span>
              <el-icon class="industries-page__row-arrow"><ArrowRight /></el-icon>
            </button>
          </li>
        </ul>

        <ul v-else-if="data.companies.length > 0" class="industries-page__list">
          <li v-for="company in data.companies" :key="company.symbol">
            <button type="button" class="industries-page__row" @click="goToStock(company.symbol)">
              <el-icon class="industries-page__row-icon"><OfficeBuilding /></el-icon>
              <span class="industries-page__row-name">{{ company.companyName }}</span>
              <span class="industries-page__row-count">{{ company.symbol }}</span>
            </button>
          </li>
        </ul>

        <el-empty v-else description="此分類目前沒有公司資料" />
      </template>

      <el-empty v-else-if="!pending" description="找不到這個分類" />
    </div>
  </div>
</template>

<style scoped>
.industries-page {
  width: 100%;
}

.industries-page__title {
  font-size: 20px;
  font-weight: 600;
  margin: 0 0 16px;
}

.industries-page__subtitle {
  font-size: 16px;
  color: var(--el-text-color-secondary);
  margin: -8px 0 20px;
}

.industries-page__breadcrumb {
  margin-bottom: 16px;
  font-size: 16px;
}

.industries-page__crumb {
  background: none;
  border: none;
  padding: 0;
  font-size: 16px;
  color: var(--el-color-primary);
  cursor: pointer;
}

.industries-page__crumb:disabled {
  color: var(--el-text-color-primary);
  font-weight: 600;
  cursor: default;
}

.industries-page__body {
  min-height: 200px;
}

.industries-page__count {
  margin: 0 0 12px;
  font-size: 16px;
  color: var(--el-text-color-secondary);
}

.industries-page__list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  list-style: none;
  margin: 0;
  padding: 0;
}

.industries-page__row {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 12px 16px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
  text-align: left;
  transition: border-color 0.15s ease;
}

.industries-page__row:hover {
  border-color: var(--el-color-primary-light-5);
}

.industries-page__row-icon {
  color: var(--el-text-color-placeholder);
  flex-shrink: 0;
}

.industries-page__row-name {
  flex: 1;
  font-size: 16px;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.industries-page__row-count {
  font-size: 16px;
  color: var(--el-text-color-secondary);
  flex-shrink: 0;
}

.industries-page__row-arrow {
  color: var(--el-text-color-placeholder);
  flex-shrink: 0;
}
</style>
