<script setup lang="ts">
import type { HoldingsSymbolColumn } from '~/components/holdings/HoldingsSymbolTable.vue'
import type { ShareColumn } from '~/composables/share/useShares'

// 分享出去的持股（2026-10-19，分享連結第二階段）。業務中台 的公開資料只有「勾選的欄位推得出來」的東西：占比、報酬率它算好；
// 股數要勾了股數／市值／未實現損益／預估年股利才有，平均成本要勾了未實現損益才有。其餘用公開報價算，跟持股總覽同一套
// （holdingRowFigures、dayChange、useHoldingsMarket），所以兩邊的數字一樣。表格是持股總覽那一張（HoldingsSymbolTable），
// 只讀：沒有展開明細。
export interface PublicHolding {
  symbol: string
  weight?: string | null
  pnlPct?: string | null
  quantity?: number
  averageCost?: string | null
  costUnknownQuantity?: number
}

const props = defineProps<{
  columns: ShareColumn[]
  holdings: PublicHolding[]
}>()

// 這幾欄要公開報價（收盤、前一日收盤、每股股利）；只勾了占比、報酬率就不必抓
const QUOTE_COLUMNS = ['dayChange', 'marketValue', 'unrealizedPnl', 'annualDividend']
const { market, loadQuotes, loadReferenceData } = useHoldingsMarket()
const symbols = computed(() => props.holdings.map(holding => holding.symbol))
onMounted(async () => {
  if (!props.columns.some(column => QUOTE_COLUMNS.includes(column.key))) return
  await loadReferenceData()
  await loadQuotes(symbols.value)
})

const companyByCode = useCompanyLookup(() => symbols.value)
const { routeFor } = useStockSearch()

const rows = computed(() => props.holdings.map((holding) => {
  const quote = market.value[holding.symbol]
  const entry = companyByCode.value.get(holding.symbol)
  const quantity = holding.quantity ?? null
  return {
    symbol: holding.symbol,
    name: entry?.name ?? holding.symbol,
    label: entry ? `${entry.name} ${holding.symbol}` : holding.symbol,
    kind: entry?.kind ?? 'common',
    link: entry ? routeFor(entry) : `/stock/${holding.symbol}`,
    weight: holding.weight == null ? null : Number(holding.weight),
    pnlPct: holding.pnlPct == null ? null : Number(holding.pnlPct),
    quantity,
    figures: quantity === null
      ? null
      : holdingRowFigures({ quantity, costUnknownQuantity: holding.costUnknownQuantity ?? 0, averageCost: holding.averageCost ?? null, price: quote?.price, dividendPerShare: quote?.dividendPerShare }),
    // 只顯示漲跌幅：金額要乘股數，會透露部位大小
    dayPct: dayChange({ quantity: 0, price: quote?.dayPrice, previousClose: quote?.previousClose, date: quote?.dayPriceDate }).pct
  }
}))
type SharedRow = (typeof rows.value)[number]

const tone = (value: number | null, digits: number) => (value === null ? null : Number(value.toFixed(digits)))
const DEFINITIONS: Record<string, (label: string) => HoldingsSymbolColumn<SharedRow>> = {
  weight: label => ({ key: 'weight', label, minWidth: 100, card: 'summary', sortLabel: `${label}（大到小）`, text: row => holdingsMetricText(row.weight === null ? null : String(row.weight), 'pct'), sortValue: row => row.weight }),
  pnlPct: label => ({ key: 'pnlPct', label, minWidth: 110, card: 'summary', sortLabel: `${label}（高到低）`, text: row => holdingsSignedPct(row.pnlPct), sortValue: row => row.pnlPct, tone: row => tone(row.pnlPct === null ? null : row.pnlPct * 100, 2) }),
  dayChange: label => ({ key: 'dayChange', label, minWidth: 120, card: 'summary', sortLabel: `${label}（高到低）`, text: row => holdingsSignedPct(row.dayPct === null ? null : row.dayPct / 100), sortValue: row => row.dayPct, tone: row => tone(row.dayPct, 2) }),
  quantity: label => ({ key: 'quantity', label, minWidth: 100, card: 'summary', sortLabel: `${label}（多到少）`, text: row => (row.quantity === null ? '－' : groupThousands(row.quantity)), sortValue: row => row.quantity }),
  marketValue: label => ({ key: 'marketValue', label, minWidth: 120, card: 'summary', text: row => (row.figures?.marketValue == null ? '－' : holdingsMoney(row.figures.marketValue)), sortValue: row => row.figures?.marketValue ?? null }),
  unrealizedPnl: label => ({ key: 'unrealizedPnl', label, minWidth: 140, card: 'summary', text: row => holdingsSignedMoney(row.figures?.pnl ?? null), sortValue: row => row.figures?.pnl ?? null, tone: row => tone(row.figures?.pnl ?? null, 0) }),
  annualDividend: label => ({ key: 'annualDividend', label, minWidth: 120, card: 'summary', text: row => (row.figures?.annualDividend == null ? '－' : holdingsMoney(row.figures.annualDividend)), sortValue: row => row.figures?.annualDividend ?? null })
}
// 照分享時勾的順序；不認得的 key 不畫
const tableColumns = computed(() => props.columns.flatMap(column => (DEFINITIONS[column.key] ? [DEFINITIONS[column.key]!(column.label)] : [])))
// 預設排序：有占比照占比，其次市值、股數，都沒有就照代號（同持股總覽「最大的先看」）
const defaultSort = ['weight', 'marketValue', 'quantity'].find(key => props.columns.some(column => column.key === key)) ?? 'symbol'
</script>

<template>
  <HoldingsSymbolTable :rows="rows" :columns="tableColumns" :default-sort="defaultSort" />
</template>
