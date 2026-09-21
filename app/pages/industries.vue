<script setup lang="ts">
import { Search } from '@element-plus/icons-vue'
import type { HubSector } from '#shared/types/hub'

// 產業追蹤 — RETIRED the supply-chain tree 2026-09-20: analysis-ts hard-deleted GET
// /industries/chain-tree (and chain-clusters, chain-classification) with no replacement (commit
// a7489d65, a compliance call — the underlying oingg-playwright-py classification's data
// provenance/refresh mechanism couldn't be verified), not a temporary outage. useIndustryChainTree
// / useIndustryChainClusters were `git rm`'d in the same commit — nothing else referenced them.
//
// What's left is the page's OTHER half, which was already live and unaffected: GET
// /industries/securities-sectors (the same 證交所類股 catalog /stock's own directory page uses).
// This page now falls back to that entirely — a search box over the 36 sector names plus the
// full chip list. It reads as a downgrade from the tree (no company-level search, no supply-chain
// grouping), and it now materially overlaps /stock's own 35-row sector table; that overlap is
// flagged for a follow-up decision (redirect one into the other) rather than resolved here.
const requestUrl = useRequestURL()
useSeoMeta({
  title: '產業追蹤：依證交所類股瀏覽上市櫃公司',
  description: '證交所把上市櫃公司分成 35 個類股，每個類股一頁：該類股公司的股價、本益比、殖利率與 ROE 一覽表，可用類股名稱搜尋。'
})
useHead({ link: [{ rel: 'canonical', href: `${requestUrl.origin}/industries` }] })
const { data: sectors } = await useFetch<HubSector[]>('/api/hub/sectors', { key: 'hub-sectors', default: () => [] })

const keyword = ref('')
const filteredSectors = computed(() => {
  const trimmed = keyword.value.trim()
  if (!trimmed) return sectors.value
  return sectors.value.filter(sector => sector.name.includes(trimmed))
})
</script>

<template>
  <div class="industries-page">
    <h1 class="industries-page__title">產業追蹤</h1>

    <p class="industries-page__subtitle">
      依證交所類股分類瀏覽上市櫃公司，每個類股一頁公司名單
    </p>

    <el-input v-model="keyword" class="industries-page__search" placeholder="搜尋類股名稱，例如 半導體" clearable>
      <template #prefix>
        <el-icon><Search /></el-icon>
      </template>
    </el-input>

    <section v-if="sectors.length" class="stock-page-section industries-page__sectors" aria-labelledby="industries-sectors-heading">
      <h2 id="industries-sectors-heading" class="stock-page-section__title">依證交所類股瀏覽</h2>
      <p class="hub-answer">證交所把上市櫃公司分成 {{ sectors.length }} 個類股，每個類股一頁：該類股公司的股價、本益比、殖利率與 ROE 一覽表。<NuxtLink to="/stock" class="hub-inline-link">個股總表</NuxtLink>則列出全部類股與家數。</p>
      <ul v-if="filteredSectors.length" class="hub-chip-list">
        <li v-for="sector in filteredSectors" :key="sector.code">
          <NuxtLink :to="sectorPath(sector.code) ?? '/stock'" class="hub-chip">{{ sector.name }}（{{ sector.companyCount }}）</NuxtLink>
        </li>
      </ul>
      <SharedEmptyState v-else description="沒有符合的類股名稱" />
    </section>
    <SharedEmptyState v-else description="目前查無類股資料" />
  </div>
</template>

<style scoped>
.industries-page {
  width: 100%;
}

.industries-page__title {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0 0 16px;
}

.industries-page__subtitle {
  font-size: 1rem;
  color: var(--el-text-color-secondary);
  margin: 0 0 20px;
}

.industries-page__search {
  width: 100%;
  max-width: 420px;
  margin-bottom: 16px;
}
</style>
