<script setup lang="ts">
// "/" is now the public/SEO-facing landing page — split off from the dashboard (moved to
// dashboard.vue) per the reasoning that a live-data dashboard has nothing static or
// keyword-rich for search engines to index, while the site's highest-authority URL sitting
// idle on SEO was a real missed opportunity. Structure follows
// docs/存股 SaaS 首頁 SEO 策略.md's own page-module table (hero → features grid → FAQ) and
// heading hierarchy (H1 → H2 → H3) — its pricing-snapshot and AggregateRating modules are
// deliberately NOT included here since this app has no real pricing tiers or review data to
// show; fabricating either would be exactly the kind of misleading YMYL content that doc
// warns against, not a shortcut around missing it.
import { DataAnalysis, Filter, MapLocation, Reading } from '@element-plus/icons-vue'
import type { Component } from 'vue'

// Own standalone layout (see layouts/landing.vue and app.vue) instead of the app-shell
// desktop/mobile split every other page uses — no pinned sidebar or stock search bar here.
definePageMeta({ layout: 'landing' })

useSeoMeta({
  title: '安盈存股 — 選股篩選與財報分析工具',
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

// Kept honest on purpose — no invented update cadence, user counts, or accuracy claims this
// app can't actually back up. Mirrored into the FAQPage JSON-LD below verbatim, so the
// visible text and the structured data never drift apart.
interface FaqItem {
  question: string
  answer: string
}

const FAQS: FaqItem[] = [
  {
    question: '使用悠盈存股需要付費嗎？',
    answer: '目前所有功能皆可免費使用，登入帳號即可儲存你的篩選條件與觀察清單。'
  },
  {
    question: '篩選結果算是投資建議嗎？',
    answer:
      '不是。悠盈存股提供的篩選工具、財報指標說明與歷史回測僅供投資輔助與財務規劃參考，不構成任何有價證券之買賣建議或獲利保證，實際投資決策請自行判斷並審慎評估風險。'
  },
  {
    question: '股價與財報數據從哪裡來？',
    answer: '股市歷史行情、財務比率與除權息資訊來源包含台灣證券交易所（TWSE）、證券櫃檯買賣中心（TPEx）及公開資訊觀測站等公開資料。'
  },
  {
    question: '可以追蹤 KY 股或 ETF 嗎？',
    answer: '可以，悠盈存股提供 KY 股專區整理境外上市公司的財務與治理風險重點，以及 ETF 專區協助比較追蹤標的。'
  }
]

const requestUrl = useRequestURL()

// SoftwareApplication (applicationCategory: FinanceApplication) + Organization + FAQPage —
// the three schema types docs/存股 SaaS 首頁 SEO 策略.md calls out as the baseline for a
// 存股 SaaS homepage. offers/aggregateRating deliberately omitted (see the top-of-file
// comment); logo omitted too since there's no real image asset yet, just the placeholder
// LOGO mark — a logo URL pointing at nothing would be worse than no logo property at all.
useHead({
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: '安盈存股',
        applicationCategory: 'FinanceApplication',
        operatingSystem: 'Web',
        url: requestUrl.origin
      })
    },
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: '安盈存股',
        url: requestUrl.origin,
        sameAs: ['https://github.com/oingg-tw']
      })
    },
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: FAQS.map(faq => ({
          '@type': 'Question',
          name: faq.question,
          acceptedAnswer: { '@type': 'Answer', text: faq.answer }
        }))
      })
    }
  ]
})
</script>

<template>
  <div class="landing-page">
    <section class="landing-page__hero">
      <h1 class="landing-page__title">告別瞎猜選股，用真實財報數據找出值得長期持有的好公司</h1>
      <p class="landing-page__lead">
        投資如同種一棵樹——春天紮根、夏天生長，都是為了等待秋天結成飽滿的果實。悠盈存股
        陪你篩選值得長期持有的好公司、看懂財報數字背後的意義，讓每一分耐心，最終都不會白費。
      </p>
      <NuxtLink to="/dashboard" class="landing-page__cta">開始使用</NuxtLink>
      <p class="landing-page__hero-note">
        本站篩選結果與財報說明僅供投資輔助參考，不構成買賣建議或獲利保證。
      </p>
    </section>

    <section class="landing-page__section">
      <h2 class="landing-page__section-title">核心功能</h2>
      <div class="landing-page__highlights">
        <NuxtLink v-for="item in HIGHLIGHTS" :key="item.key" :to="item.to" class="landing-page__card">
          <el-icon class="landing-page__card-icon"><component :is="item.icon" /></el-icon>
          <h3 class="landing-page__card-title">{{ item.title }}</h3>
          <p class="landing-page__card-desc">{{ item.description }}</p>
        </NuxtLink>
      </div>
    </section>

    <section class="landing-page__section">
      <h2 class="landing-page__section-title">常見問題</h2>
      <div class="landing-page__faqs">
        <div v-for="faq in FAQS" :key="faq.question" class="landing-page__faq">
          <h3 class="landing-page__faq-question">{{ faq.question }}</h3>
          <p class="landing-page__faq-answer">{{ faq.answer }}</p>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.landing-page {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 48px;
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

.landing-page__hero-note {
  margin: 0;
  font-size: 16px;
  color: var(--el-text-color-placeholder);
}

.landing-page__section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.landing-page__section-title {
  font-size: 22px;
  font-weight: 700;
  margin: 0;
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
  margin: 0;
}

.landing-page__card-desc {
  margin: 0;
  font-size: 16px;
  line-height: 1.6;
  color: var(--el-text-color-secondary);
}

.landing-page__faqs {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.landing-page__faq-question {
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 6px;
}

.landing-page__faq-answer {
  margin: 0;
  font-size: 16px;
  line-height: 1.7;
  color: var(--el-text-color-secondary);
}
</style>
