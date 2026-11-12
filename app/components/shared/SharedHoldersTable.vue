<script setup lang="ts">
import type { ShareholdingDistribution } from '#shared/types/screener-detail'

// 最新一週的集保股權分散，15 個級距原樣（ETF 面向、個股 /holders 共用，2026-11-12 從 ETF 頁抽出）。
// 占比排第二欄、級距寫成張（2026-11-12）：原本級距寫股數，第一欄 191px，375 寬時占比整欄在畫面外；張也跟圖的五組、張數欄同一個單位。
// 每一級含上限（5～10 張＝5,001～10,000 股；1～5 張從 1,000 股起），頁面最後那段說明寫了
defineProps<{ levels: ShareholdingDistribution['latestLevels']; shortName: string; code: string; date: string }>()
const lots = (shares: number) => groupThousands(Math.round(shares / 1000))
const rangeText = (minShares: number | null, maxShares: number | null) => {
  const from = groupThousands(Math.floor((minShares ?? 0) / 1000))
  if (maxShares === null) return `${from} 張以上`
  if (maxShares < 1000) return '不到 1 張'
  return `${from}～${groupThousands(maxShares / 1000)} 張`
}
</script>

<template>
  <SharedTable :label="`${shortName}最新一週的集保股權分散`" :caption="`${shortName} ${code} ${date} 集保股權分散表，15 個持股級距`">
    <thead>
      <tr>
        <th scope="col">持股級距</th>
        <th scope="col" class="seo-table__num">占集保比例</th>
        <th scope="col" class="seo-table__num">人數</th>
        <th scope="col" class="seo-table__num">張數</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="row in levels" :key="row.level">
        <th scope="row">{{ rangeText(row.minShares, row.maxShares) }}</th>
        <td class="seo-table__num">{{ row.custodyPct.toFixed(2) }}%</td>
        <td class="seo-table__num">{{ groupThousands(row.holders) }}</td>
        <td class="seo-table__num">{{ lots(row.shares) }}</td>
      </tr>
    </tbody>
  </SharedTable>
</template>
