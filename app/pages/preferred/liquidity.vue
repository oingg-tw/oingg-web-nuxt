<script setup lang="ts">
import type { PreferredLiquidityRow } from '#shared/types/screener-detail'

// /preferred/liquidity — 成交量（2026-10-18）：近 60 個交易日平均每天成交幾張、有幾天沒有成交。只陳述數字，不說好不好買賣
const { entries } = await usePreferredZoneList()
const { data, error, refresh } = await useFetch<{ days: number; rows: PreferredLiquidityRow[] }>('/api/preferred/liquidity', { key: 'preferred-zone-liquidity' })
watchLoadFailure('preferred-zone-liquidity', () => error.value, () => refresh())

const rowOf = computed(() => new Map((data.value?.rows ?? []).map(row => [row.symbol, row])))
// 上游成交量是股，一張 1,000 股
const lots = (shares: number | null | undefined) => (shares === null || shares === undefined ? '－' : `${groupThousands(Math.round(shares / 1000))} 張`)

const answer = computed(() => {
  const rows = (data.value?.rows ?? []).filter(row => row.averageVolume !== null)
  if (!rows.length) return null
  const sorted = [...rows].sort((a, b) => a.averageVolume! - b.averageVolume!)
  const nameOf = (symbol: string) => entries.value.find(entry => entry.symbol === symbol)?.name ?? symbol
  const low = sorted[0]!
  const high = sorted.at(-1)!
  const withZero = rows.filter(row => (row.zeroVolumeDays ?? 0) > 0).length
  return `近 ${data.value!.days} 個交易日，平均每天成交最多的是${nameOf(high.symbol)}（${high.symbol}）約 ${lots(high.averageVolume)}，最少的是${nameOf(low.symbol)}（${low.symbol}）約 ${lots(low.averageVolume)}；有 ${withZero} 檔在這段期間有整天沒有成交的日子。`
})
</script>

<template>
  <PreferredZonePage
    title="特別股成交量"
    topic="成交量"
    path="/preferred/liquidity"
    seo-title="特別股成交量：近 60 個交易日平均每天成交張數"
    description="台灣上市櫃特別股成交量：每一檔近 60 個交易日平均每天成交多少張、有幾天整天沒有成交，看得出哪些特別股成交熱絡、哪些成交稀少，想買賣時可能要等比較久。"
  >
    <section class="stock-page-section" aria-labelledby="preferred-liquidity-heading">
      <h2 id="preferred-liquidity-heading" class="stock-page-section__title">好不好買賣？</h2>
      <p class="hub-answer">
        特別股的成交量差異很大。每天成交很少的特別股，想買或想賣的時候可能要等，或要用比較差的價格成交。
      </p>
      <p v-if="answer" class="hub-answer">{{ answer }}</p>
      <SharedTableScroll v-if="entries.length" label="特別股成交量">
        <table class="seo-table" data-ssr-table>
          <caption class="visually-hidden">各檔特別股近 {{ data?.days ?? 60 }} 個交易日的日均成交張數與沒有成交的天數</caption>
          <thead>
            <tr>
              <th scope="col">特別股</th>
              <th scope="col">平均每天成交</th>
              <th scope="col">沒有成交的天數</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="entry in entries" :key="entry.symbol">
              <th scope="row"><NuxtLink :to="preferredStockPath(entry.symbol)">{{ entry.name }}</NuxtLink> {{ entry.symbol }}</th>
              <td class="seo-table__num">{{ lots(rowOf.get(entry.symbol)?.averageVolume) }}</td>
              <td class="seo-table__num">{{ rowOf.get(entry.symbol)?.zeroVolumeDays ?? '－' }}{{ rowOf.get(entry.symbol)?.zeroVolumeDays != null ? ` / ${rowOf.get(entry.symbol)?.days} 天` : '' }}</td>
            </tr>
          </tbody>
        </table>
      </SharedTableScroll>
    </section>
  </PreferredZonePage>
</template>
