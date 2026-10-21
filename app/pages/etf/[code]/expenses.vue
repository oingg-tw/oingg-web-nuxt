<script setup lang="ts">
import type { FactItem } from '~/components/shared/SharedFactList.vue'

// ETF 面向：費用（2026-10-18）。歷年總費用率的折線＋逐年的表，加上目前各項費率的拆解。近 12 個月是估算（analysis-ts 803f6cd9：月底淨資產
// 平均當分母，官方用每日平均；上游要求標「估算」），未滿 12 個月的已換算成一年
const etfData = await useEtf()
const { code, data, values, num, shortName } = etfData

const years = computed(() => Object.keys(values.value)
  .flatMap(key => (/^expenseRatio\d{4}$/.test(key) && typeof values.value[key] === 'number' ? [{ year: key.slice(-4), value: values.value[key] as number }] : []))
  .sort((a, b) => b.year.localeCompare(a.year)))

const trailing = computed(() => num('trailing12MonthExpenseRatioPct'))
const trailingNote = computed(() => {
  if (trailing.value === null) return undefined
  const months = num('trailing12MonthExpenseRatioMonths')
  return months !== null && months < 12 ? `估算；只有 ${months} 個月，已換算成一年` : '估算'
})

// 各項費用不是契約費率，是最近一個完整年度的實際比率（analysis-ts 從 SITCA 全年報表讀，跟歷年表的第一列同一年；sitca-ts 2026-10-21）
const fees = computed<FactItem[]>(() => [
  ...ETF_FEE_FIELDS.flatMap(item => (num(item.field) === null ? [] : [{ label: item.label, value: etfPct(num(item.field)), note: 'note' in item ? item.note : undefined }])),
  { label: '近 12 個月總費用率', value: etfPct(trailing.value), note: trailingNote.value }
])

const answer = computed(() => {
  const latest = years.value[0]
  if (!latest) return trailing.value !== null ? `${shortName.value}（${code.value}）還沒有完整年度的總費用率；近 12 個月估算 ${etfPct(trailing.value)}。` : null
  const parts = [`${shortName.value}（${code.value}）${latest.year} 年總費用率 ${etfPct(latest.value)}`]
  if (trailing.value !== null) parts.push(`近 12 個月估算 ${etfPct(trailing.value)}`)
  const management = num('managementFeeRate')
  if (management !== null) parts.push(`其中經理費 ${etfPct(management)}`)
  return `${parts.join('，')}；總費用率從淨值裡每天扣，不另外收。`
})
</script>

<template>
  <EtfPage :etf-data="etfData" facet="expenses" :description="answer">
    <StockQuestionSection id="etf-expenses" :question="`${shortName}（${code}）一年被收多少費用？`" :answer="answer">
      <EtfFacetChart v-if="data" :data="data" facet="expenses" />
      <SharedTableScroll v-if="years.length" :label="`${shortName}歷年總費用率`">
        <table class="seo-table" data-ssr-table>
          <caption class="visually-hidden">{{ shortName }} {{ code }} 歷年總費用率（新的在上）</caption>
          <thead>
            <tr>
              <th scope="col">年度</th>
              <th scope="col" class="seo-table__num">總費用率</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in years" :key="row.year">
              <th scope="row">{{ row.year }} 年</th>
              <td class="seo-table__num">{{ etfPct(row.value) }}</td>
            </tr>
          </tbody>
        </table>
      </SharedTableScroll>
      <p v-if="years.length" class="hub-answer">各項費用是 {{ years[0]!.year }} 年全年的實際比率，不是契約費率。總費用率含交易成本、並扣掉 ETF 申購買回交易費，所以可能比經理費加保管費還低。</p>
      <SharedFactList :items="fees" :label="years.length ? `${shortName} ${years[0]!.year} 年各項費用` : `${shortName}各項費用`" />
    </StockQuestionSection>
  </EtfPage>
</template>
