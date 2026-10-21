<script setup lang="ts">
import type { FactItem } from '~/components/shared/SharedFactList.vue'

// ETF 個別頁的首頁：指標速覽（2026-10-18，「類似現在股票那邊的架構」）。每個面向的那張圖（跟面向頁同一張，EtfFacetChart），點標題進面向頁。
// 只放圖表卡片（2026-10-18，使用者：「指標速覽 只要圖表卡片就好。不要文字說明 "什麼樣的 ETF？"」）：基本資料那一段與最新數字的表拿掉，
// 那句介紹只留在 meta description。同一天補一張「基本資料」卡片當第一格（「如果這個文字說明是必要的 那就做一個卡片給他」）：追蹤哪個指數、
// 主動或被動、哪家投信、成立多久、多久配一次，圖表都看不出來。規模、受益人數、淨值、折溢價各有自己的圖，卡片不重複列。不做釘選：面向全部畫出來
const etfData = await useEtf()
const { code, data, etf, values, text, num, shortName } = etfData

const description = computed(() => {
  if (!etf.value) return null
  // 基金類型（投信投顧公會的分類，上游 fundType，2026-10-21 取代掛牌分類 assetClass）
  const fundType = text('fundType')
  const aum = num('aum')
  const style = etf.value.trackingIndex ? `被動式 ETF，追蹤「${etf.value.trackingIndex}」` : values.value.isActive === true ? '主動式 ETF' : ' ETF'
  return `${shortName.value}（${code.value}）是${etf.value.issuerName}發行的${style}${fundType ? `，基金類型為${fundType}` : ''}${aum !== null ? `；規模 ${formatMoney(aum)}` : ''}。配息、配息組成、填息、費用、含息報酬率、規模、折溢價、成交量與持有人結構的圖。`
})

const MARKETS: Record<string, string> = { sii: '上市', otc: '上櫃' }
const facts = computed<FactItem[]>(() => {
  if (!etf.value) return []
  const years = num('yearsSinceEstablished')
  return [
    { label: '管理方式', value: etf.value.trackingIndex ? `被動式，追蹤「${etf.value.trackingIndex}」` : values.value.isActive === true ? '主動式，由經理人選股、不追蹤指數' : '－' },
    { label: '發行投信', value: etf.value.issuerName },
    { label: '基金類型', value: text('fundType') ?? '－' },
    { label: '市場', value: MARKETS[text('market') ?? ''] ?? '－' },
    { label: '成立日', value: text('establishedDate') ?? '－', note: years ? `成立 ${years} 年` : undefined },
    { label: '配息頻率', value: text('distributionFrequency') ?? '－' },
    { label: '基金全名', value: etf.value.fundName }
  ]
})

// 卡片順序跟側欄一樣（useEtfFacetOrder，讀者拖曳過就照讀者的）；填息沒有圖，不出卡片
const { order } = useEtfFacetOrder()
const chartFacets = computed(() => order.value.filter((key): key is Exclude<typeof key, 'fill'> => key !== 'fill'))
const labelOf = (key: string) => ETF_FACETS.find(facet => facet.key === key)!.label
</script>

<template>
  <EtfPage :etf-data="etfData" facet="overview" :description="description">
    <section v-if="data" class="stock-page-section" aria-labelledby="etf-quick-view-heading">
      <!-- 段落標題只給螢幕閱讀器與大綱（卡片標題是 h3，不能跳級）；畫面上只有卡片 -->
      <h2 id="etf-quick-view-heading" class="visually-hidden">{{ shortName }}各面向的圖</h2>
      <div class="etf-quick-view__grid">
        <SharedChartCard v-if="facts.length">
          <template #header>
            <h3 class="etf-quick-view__title">基本資料</h3>
          </template>
          <SharedFactList :items="facts" :label="`${shortName}的基本資料`" class="etf-quick-view__facts" />
        </SharedChartCard>
        <EtfFacetChart v-for="facet in chartFacets" :key="facet" :data="data" :facet="facet">
          <template #header>
            <h3 class="etf-quick-view__title"><NuxtLink :to="etfFacetPath(code, facet)" class="hub-inline-link">{{ labelOf(facet) }}</NuxtLink></h3>
          </template>
        </EtfFacetChart>
      </div>
    </section>
  </EtfPage>
</template>

<style scoped>
/* 同個股指標速覽的格狀：最多三欄（2026-10-17「滿版的時候最多給3columns就好」） */
.etf-quick-view__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(max(min(100%, 480px), (100% - 2 * 16px) / 3), 1fr));
  gap: 16px;
}

.etf-quick-view__grid > * {
  min-width: 0;
}

.etf-quick-view__grid :deep(.shared-chart-card) {
  margin-bottom: 0;
}

/* 卡片只有格子的三分之一寬：清單固定一欄（SharedFactList 在 768px 以上預設兩欄） */
.etf-quick-view__facts.fact-list {
  grid-template-columns: 1fr;
}

.etf-quick-view__title {
  margin: 0;
  font-size: 18px;
}
</style>
