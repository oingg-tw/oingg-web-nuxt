<script setup lang="ts">
// 配息從哪來的互動拆解外框（2026-10-12 從 /learn/dividend-source/{code} 抽出來；新手專區首頁拿它當主線）。
// 類比那一句、卡片、StockDividendSegmentLine，再加上首頁才有的「這一步可以往下看」。
//
// 包在卡片裡（2026-09-26「公司這一年賣了多少 希望放在卡片中，這樣用戶才會知道底下的上下一步跟圖表一組的」）：標題、圖、說明、
// 上一步／下一步是同一個元件的四個部分，卡片就是那個邊界。類比那一句在卡片外（2026-09-29「有點冗長，希望放在卡片外面不要占用
// 說明的空間」）：它是整張圖的前提、不隨步驟變。
//
// 「這一步可以往下看」（stepLinks）：五個階段跟圖上的五刀一一對應（DIVIDEND_CHAIN_INDEX），連到新手專區的教學頁。全部在 SSR 裡
// （爬得到、沒有 JS 也讀得到），掛上之後只留目前那一步——同 StockDividendSegmentLine 的做法，class 切換、不用 <Transition>。
// 畫不出圖的公司（金融股、有一塊是負數）沒有步驟可跟，五段全部顯示。
const props = withDefaults(defineProps<{
  segment: {
    fiscalYear: number | null
    revenuePerShare: number | null
    grossProfit: number | null
    operatingIncome: number | null
    eps: number | null
    dividendPerShare: number | null
    operatingExpense: number | null
    otherOperatingIncome: number | null
    researchExpense: number | null
  }
  drawn: boolean
  stepLinks?: boolean
}>(), { stepLinks: false })

const current = ref(0)
const interactive = ref(false)
onMounted(() => { interactive.value = true })
// 換一家公司時拆解元件重掛（:key），回到第一步；這裡跟著回去
const segmentKey = computed(() => `${props.segment.fiscalYear}-${props.segment.revenuePerShare}-${props.segment.dividendPerShare}`)
watch(segmentKey, () => { current.value = 0 })

// 個股頁 slug → 新手專區的教學頁。不是指標頁的三個另外對應
const SPECIAL: Record<string, string> = {
  'monthly-revenue': metricPath('revenueYoy3m'),
  dividend: metricPath('cashDividendYield'),
  'dividend-fill': learnTopicPath('dividend-fill')
}
function learnTo(slug: string): string | null {
  if (SPECIAL[slug]) return SPECIAL[slug]!
  const page = findMetricPage(slug)
  return page ? metricPath(page.metricCode) : null
}
const stages = DIVIDEND_CHAIN_INDEX.map(stage => ({
  stage: stage.stage,
  links: stage.links.flatMap(link => {
    const to = learnTo(link.slug)
    return to ? [{ ...link, to }] : []
  })
}))
</script>

<template>
  <div class="learn-dividend-chain">
    <p class="learn-dividend-chain__analogy">說明以餐廳類比；圖上與文字裡的每個數字，都是這家公司自己的財報數字。</p>
    <el-card shadow="never">
      <StockDividendSegmentLine :key="segmentKey" v-bind="segment" @step="current = $event" />
    </el-card>

    <div v-if="stepLinks" class="learn-dividend-chain__steps">
      <section
        v-for="(stage, index) in stages"
        :key="stage.stage"
        class="learn-dividend-chain__stage"
        :class="{ 'is-hidden': interactive && drawn && index !== current }"
        :aria-labelledby="`learn-chain-stage-${index}`"
      >
        <h3 :id="`learn-chain-stage-${index}`" class="learn-dividend-chain__stage-title">這一步可以往下看：{{ stage.stage }}</h3>
        <ul class="learn-dividend-chain__links">
          <li v-for="link in stage.links" :key="link.slug" class="learn-dividend-chain__item">
            <NuxtLink :to="link.to" class="learn-dividend-chain__link">{{ link.label }}</NuxtLink>
            <span class="learn-dividend-chain__hook">{{ link.hook }}</span>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>

<style scoped>
.learn-dividend-chain__analogy {
  margin: 0 0 8px;
  font-size: 1rem;
  line-height: 1.6;
  color: var(--el-text-color-secondary);
}

.learn-dividend-chain__steps {
  display: flex;
  flex-direction: column;
  gap: 24px;
  margin-top: 16px;
}

.learn-dividend-chain__stage.is-hidden {
  display: none;
}

.learn-dividend-chain__stage-title {
  margin: 0 0 12px;
  font-size: 1.125rem;
  font-weight: 600;
}

/* 「連結＋一行說明」清單，形狀同 /learn/dividend-source 的索引段（抄自 app/pages/rank/index.vue）：沒有邊框、沒有背景 */
.learn-dividend-chain__links {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(18rem, 1fr));
  gap: 12px 24px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.learn-dividend-chain__item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-height: 48px;
}

.learn-dividend-chain__link {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--el-color-primary-dark-2);
  text-decoration: underline;
  text-underline-offset: 3px;
}

.learn-dividend-chain__hook {
  color: var(--el-text-color-secondary);
}
</style>
