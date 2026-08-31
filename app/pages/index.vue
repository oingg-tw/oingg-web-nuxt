<script setup lang="ts">
// "/" is now the public/SEO-facing landing page — split off from the dashboard (moved to
// dashboard.vue) per the reasoning that a live-data dashboard has nothing static or
// keyword-rich for search engines to index, while the site's highest-authority URL sitting
// idle on SEO was a real missed opportunity. This page carries real descriptive copy and
// internal links to the app's actual content pages instead.
import { DataAnalysis, Filter, MapLocation, Reading } from '@element-plus/icons-vue'
import type { Component } from 'vue'

// Own standalone layout (see layouts/landing.vue and app.vue) instead of the app-shell
// desktop/mobile split every other page uses — no pinned sidebar or stock search bar here,
// just this page's own minimal logo+GitHub header.
definePageMeta({ layout: 'landing' })

useSeoMeta({
  title: 'oingg — 選股篩選與財報分析工具',
  description: '設定屬於你的選股條件，看懂 ROE、Altman Z-Score 等財報指標背後的意義，避開 KY 股地雷，讓每一次投資布局都在時間裡穩健成長。'
})

interface Highlight {
  key: string
  icon: Component
  title: string
  description: string
  to: string
}

const HIGHLIGHTS: Highlight[] = [
  {
    key: 'screener',
    icon: Filter,
    title: '選股篩選',
    description: '從獲利能力、現金流品質到估值指標，設定屬於你的篩選條件，找出真正值得長期持有的好公司。',
    to: '/screener'
  },
  {
    key: 'guru-tutorials',
    icon: Reading,
    title: '大師教學',
    description: 'ROE、Altman Z-Score 等大師指標詳細說明，看懂每個數字背後代表的意義，而不只是記住公式。',
    to: '/guru-tutorials'
  },
  {
    key: 'ky-stocks',
    icon: MapLocation,
    title: 'KY 股專區',
    description: '境外上市公司的財務與治理風險，整理成投資人真正該檢查的重點清單，避開地雷。',
    to: '/ky-stocks'
  },
  {
    key: 'dashboard',
    icon: DataAnalysis,
    title: '總覽儀表板',
    description: '大盤即時行情、當日沖銷與短線交易相關資訊，每天打開就能掌握市場現況。',
    to: '/dashboard'
  }
]
</script>

<template>
  <div class="landing-page">
    <section class="landing-page__hero">
      <h1 class="landing-page__title">讓每一次布局，都長成屬於你的秋收</h1>
      <p class="landing-page__lead">
        投資如同種一棵樹——春天紮根、夏天生長，都是為了等待秋天結成飽滿的果實。oingg
        陪你篩選值得長期持有的好公司、看懂財報數字背後的意義，讓每一分耐心，最終都不會白費。
      </p>
      <NuxtLink to="/dashboard" class="landing-page__cta">開始使用</NuxtLink>
    </section>

    <section class="landing-page__highlights">
      <NuxtLink v-for="item in HIGHLIGHTS" :key="item.key" :to="item.to" class="landing-page__card">
        <el-icon class="landing-page__card-icon"><component :is="item.icon" /></el-icon>
        <span class="landing-page__card-title">{{ item.title }}</span>
        <p class="landing-page__card-desc">{{ item.description }}</p>
      </NuxtLink>
    </section>
  </div>
</template>

<style scoped>
.landing-page {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 40px;
}

.landing-page__hero {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 16px;
  padding: 24px 0;
}

.landing-page__title {
  font-size: 28px;
  font-weight: 700;
  line-height: 1.4;
  margin: 0;
  max-width: 640px;
}

.landing-page__lead {
  font-size: 16px;
  line-height: 1.8;
  color: var(--el-text-color-secondary);
  margin: 0;
  max-width: 560px;
}

.landing-page__cta {
  display: inline-flex;
  align-items: center;
  height: 44px;
  padding: 0 24px;
  margin-top: 8px;
  border-radius: 8px;
  background: var(--el-color-primary);
  color: var(--el-color-white);
  font-size: 16px;
  font-weight: 600;
  text-decoration: none;
}

.landing-page__cta:hover {
  opacity: 0.9;
}

.landing-page__highlights {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 16px;
}

.landing-page__card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 20px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 12px;
  color: inherit;
  text-decoration: none;
  transition: border-color 0.15s ease;
}

.landing-page__card:hover {
  border-color: var(--el-color-primary-light-5);
}

.landing-page__card-icon {
  font-size: 24px;
  color: var(--el-color-primary);
}

.landing-page__card-title {
  font-size: 18px;
  font-weight: 600;
}

.landing-page__card-desc {
  margin: 0;
  font-size: 16px;
  line-height: 1.6;
  color: var(--el-text-color-secondary);
}
</style>
