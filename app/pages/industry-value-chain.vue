<script setup lang="ts">
import { CircleCheckFilled } from '@element-plus/icons-vue'
import type { IndustryValueChainCompany, IndustryValueChainMarket } from '~/composables/industries/useIndustryValueChain'

// 產業價值鏈 — a new, standalone page/route per direct request ("請規畫這個新頁面...新的
// sidebar item"), deliberately NOT merged into industries.vue (產業追蹤, the tax-registration
// classification tree) even though both are "industry classification" pages — they're genuinely
// different systems (see useIndustryValueChain.ts's own comment) and the user was explicit they
// should stay separate.
//
// Matrix presentation (not a tree) per direct confirmation — a value-chain subChain assignment is
// many-to-many (one company can be in dozens of subChains at once, e.g. 台達電 spans 64), which a
// single-path expanding tree (like industries.vue's own) can't represent without scattering the
// same company across dozens of far-apart branches. Scoped to ONE selected industry at a time
// (also confirmed directly) rather than the full 6481-relationship dataset in one matrix, which
// would be unreadable — and conveniently this is also the one shape achievable at all without a
// reverse (company→subChains) lookup, which this API doesn't have (see the composable's own
// comment).
const router = useRouter()
const { load } = useIndustryValueChain()

const industries = ref<{ code: string; name: string }[]>([])
const selectedIndustry = ref<string>()
const matrixLoading = ref(false)
const subChains = ref<{ code: string; name: string }[]>([])
const rows = ref<(IndustryValueChainCompany & { subChainCodes: Set<string> })[]>([])

onMounted(async () => {
  const root = await load(undefined)
  industries.value = (root?.children ?? []).map(child => ({ code: child.code, name: child.name }))
})

const MARKET_LABEL: Record<IndustryValueChainMarket, string> = { listed: '上市', otc: '上櫃', rotc: '興櫃' }
const MARKET_TAG_TYPE: Record<IndustryValueChainMarket, 'success' | 'warning' | 'info'> = {
  listed: 'success',
  otc: 'warning',
  rotc: 'info'
}

watch(selectedIndustry, async industryCode => {
  subChains.value = []
  rows.value = []
  if (!industryCode) return
  matrixLoading.value = true
  try {
    const industryNode = await load(industryCode)
    // 0-company subChains are filtered here (companyCount is already known from this one fetch)
    // to avoid firing a wasted follow-up request per empty subChain below.
    const liveSubChains = (industryNode?.children ?? []).filter(child => child.companyCount > 0)
    subChains.value = liveSubChains.map(child => ({ code: child.code, name: child.name }))

    // Bounded to this one industry's own subChain count (typically single digits to a few dozen,
    // never anywhere near all 422) — a plain Promise.all is fine, no lazy-loading machinery
    // needed the way industries.vue's 5-level tree required.
    const subChainNodes = await Promise.all(liveSubChains.map(child => load(child.code)))

    const bySymbol = new Map<string, IndustryValueChainCompany & { subChainCodes: Set<string> }>()
    subChainNodes.forEach((node, index) => {
      const subChainCode = liveSubChains[index]!.code
      for (const company of node?.companies ?? []) {
        const existing = bySymbol.get(company.symbol)
        if (existing) {
          existing.subChainCodes.add(subChainCode)
        } else {
          bySymbol.set(company.symbol, { ...company, subChainCodes: new Set([subChainCode]) })
        }
      }
    })
    rows.value = [...bySymbol.values()].sort((a, b) => a.symbol.localeCompare(b.symbol))
  } finally {
    matrixLoading.value = false
  }
})

function goToStock(symbol: string) {
  router.push(`/stock/${symbol}`)
}
</script>

<template>
  <div class="industry-value-chain-page">
    <h1 class="industry-value-chain-page__title">產業價值鏈</h1>
    <p class="industry-value-chain-page__subtitle">
      資料源：證券櫃檯買賣中心產業價值鏈資訊平台（ic.tpex.org.tw）——與「產業追蹤」頁的財政部稅籍分類是不同的兩套系統，一家公司可能同時屬於多個次分類，不是單一路徑
    </p>

    <el-select
      v-model="selectedIndustry"
      class="industry-value-chain-page__select"
      placeholder="選擇一級產業"
      filterable
      clearable
    >
      <el-option v-for="industry in industries" :key="industry.code" :label="industry.name" :value="industry.code" />
    </el-select>

    <div v-if="selectedIndustry" v-loading="matrixLoading" class="industry-value-chain-page__matrix">
      <el-table v-if="rows.length > 0" :data="rows" border height="600">
        <el-table-column label="公司" fixed="left" width="200">
          <template #default="{ row }">
            <button type="button" class="industry-value-chain-page__company" @click="goToStock((row as IndustryValueChainCompany).symbol)">
              <span class="industry-value-chain-page__company-symbol">{{ (row as IndustryValueChainCompany).symbol }}</span>
              <span class="industry-value-chain-page__company-name">{{ (row as IndustryValueChainCompany).companyName }}</span>
              <el-tag size="small" :type="MARKET_TAG_TYPE[(row as IndustryValueChainCompany).market]">
                {{ MARKET_LABEL[(row as IndustryValueChainCompany).market] }}
              </el-tag>
            </button>
          </template>
        </el-table-column>
        <el-table-column v-for="subChain in subChains" :key="subChain.code" :label="subChain.name" width="120" align="center">
          <template #default="{ row }">
            <el-icon v-if="(row.subChainCodes as Set<string>).has(subChain.code)" class="industry-value-chain-page__check">
              <CircleCheckFilled />
            </el-icon>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-else-if="!matrixLoading" description="此產業目前沒有公司資料" />
    </div>
  </div>
</template>

<style scoped>
.industry-value-chain-page {
  width: 100%;
}

.industry-value-chain-page__title {
  font-size: 20px;
  font-weight: 600;
  margin: 0 0 16px;
}

.industry-value-chain-page__subtitle {
  font-size: 16px;
  color: var(--el-text-color-secondary);
  margin: -8px 0 20px;
}

.industry-value-chain-page__select {
  width: 100%;
  max-width: 320px;
  margin-bottom: 16px;
}

.industry-value-chain-page__matrix {
  min-height: 200px;
}

.industry-value-chain-page__company {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  width: 100%;
  border: none;
  background: transparent;
  padding: 0;
  cursor: pointer;
  text-align: left;
}

.industry-value-chain-page__company-symbol {
  font-size: 16px;
  font-weight: 600;
  color: var(--el-color-primary);
}

.industry-value-chain-page__company-name {
  font-size: 16px;
}

.industry-value-chain-page__check {
  color: var(--el-color-success);
  font-size: 18px;
}
</style>
