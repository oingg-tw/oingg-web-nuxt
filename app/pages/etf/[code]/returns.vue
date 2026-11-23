<script setup lang="ts">
import type { AnnualReturnYear } from '#shared/types/screener-detail'
// ETF 面向：報酬率（2026-10-18）。投信投顧公會委託臺大財金系的 ETF 績效評比，一個期間一根柱。定義（sitca-ts 2026-10-18 實測回推、已寫進
// export.v_etf_monthly_returns 的欄位註解）：含息報酬率＝配息再投入、以淨值計算，累積不年化，已處理分割，基準是那個月的月底。公會沒公布方法，
// 這是實測（0056 2025 年：公會 12.26、自算再投入 12.14、只看淨值 0.36）。不自己用淨值算：每日淨值沒有還原分割（0050 2025-06 一拆四）
// 2026-11-23（使用者：「etf 欄位要加上不同持續時間的年化報酬率」）：近 3／5／10 年加一欄年化（數據中台 annualizedReturnNy，由累積幾何年化），
// 再加一段各年度報酬率（annualReturnHistory，FundClear 公布的日曆年度含息報酬率）。怎麼讀放在最後的定義段，卡片之間只留問句與答句
const etfData = await useEtf()
const { code, data, values, etf, num, shortName } = etfData

const ANNUALIZED: Record<string, string> = { return3y: 'annualizedReturn3y', return5y: 'annualizedReturn5y', return10y: 'annualizedReturn10y' }
const rows = computed(() => ETF_RETURN_FIELDS.map(({ field, label }) => ({ label, value: num(field), annualized: ANNUALIZED[field] ? num(ANNUALIZED[field]) : null, annualizable: field in ANNUALIZED })))
const reportMonth = computed(() => etf.value?.yearMonth ?? null)
const month = computed(() => (reportMonth.value ? `${reportMonth.value.slice(0, 4)} 年 ${Number(reportMonth.value.slice(5))} 月` : null))

const answer = computed(() => {
  const known = rows.value.filter(row => row.value !== null)
  if (!known.length) return null
  const longest = known.at(-1)!
  const oneYear = rows.value.find(row => row.label === '近1年')?.value ?? null
  const longer = longest.annualizable ? `${longest.label}累積 ${etfPct(longest.value)}${longest.annualized !== null ? `、年化 ${etfPct(longest.annualized)}` : ''}` : null
  const parts = [oneYear !== null ? `近 1 年含息報酬率 ${etfPct(oneYear)}` : null, longer ?? (oneYear === null ? `${longest.label}累積 ${etfPct(longest.value)}` : null)].filter(Boolean)
  return `截至${month.value ?? '最新一期'}，${shortName.value}（${code.value}）${parts.join('，')}。`
})

// 新的年份在上面；上游由舊到新
const years = computed(() => {
  const history = values.value.annualReturnHistory
  return Array.isArray(history) ? [...(history as AnnualReturnYear[])].reverse() : []
})
const annualAnswer = computed(() => {
  const list = years.value
  if (!list.length) return null
  if (list.length === 1) return `${list[0]!.year} 年含息報酬率 ${etfPct(list[0]!.returnPct)}。`
  const best = list.reduce((a, b) => (b.returnPct > a.returnPct ? b : a))
  const worst = list.reduce((a, b) => (b.returnPct < a.returnPct ? b : a))
  return `${list.at(-1)!.year}～${list[0]!.year} 年裡，最高是 ${best.year} 年 ${etfPct(best.returnPct)}，最低是 ${worst.year} 年 ${etfPct(worst.returnPct)}。`
})
</script>

<template>
  <EtfPage :etf-data="etfData" facet="returns" :description="answer">
    <StockQuestionSection id="etf-returns" :question="`${shortName}（${code}）過去各期間的含息報酬率是多少？`" :answer="answer">
      <EtfFacetChart v-if="data" :data="data" facet="returns" />
      <SharedTable :label="`${shortName}各期間報酬率`" :caption="`${shortName} ${code} 各期間報酬率，累積與年化（投信投顧公會基金月報${month ? `，${month}` : ''}）`">
        <thead>
          <tr>
            <th scope="col">期間</th>
            <th scope="col" class="seo-table__num">含息報酬率（累積）</th>
            <th scope="col" class="seo-table__num">年化</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.label">
            <th scope="row">{{ row.label }}</th>
            <td class="seo-table__num" :class="priceDirectionClass(row.value)">{{ etfPct(row.value) }}</td>
            <td class="seo-table__num" :class="row.annualizable ? priceDirectionClass(row.annualized) : ''">{{ row.annualizable ? etfPct(row.annualized) : '－' }}</td>
          </tr>
        </tbody>
      </SharedTable>
    </StockQuestionSection>
    <StockQuestionSection v-if="years.length" id="etf-annual-returns" :question="`${shortName}（${code}）每一年的含息報酬率是多少？`" :answer="annualAnswer">
      <EtfFacetChart v-if="data" :data="data" facet="annualReturns" />
      <SharedTable :label="`${shortName}各年度報酬率`" :caption="`${shortName} ${code} 各年度的含息報酬率（新的在上）`">
        <thead>
          <tr>
            <th scope="col">年度</th>
            <th scope="col" class="seo-table__num">含息報酬率</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in years" :key="row.year">
            <th scope="row">{{ row.year }} 年</th>
            <td class="seo-table__num" :class="priceDirectionClass(row.returnPct)">{{ etfPct(row.returnPct) }}</td>
          </tr>
        </tbody>
      </SharedTable>
    </StockQuestionSection>
    <StockMetricGuide
      id-prefix="etf-returns"
      topic="含息報酬率"
      :definition="[
        '含息報酬率是把每次配息都再投入買回同一檔 ETF、以淨值計算的報酬，所以配息不會讓報酬率變低，也不是用收盤價算的報酬率。',
        `各期間的數字來自投信投顧公會委託臺大財務金融學系做的 ETF 績效評比，計算到那個月的月底${month ? `（目前是 ${month}）` : ''}；分割已經處理過。累積是整段期間的報酬；年化是把累積報酬換算成每年平均（幾何平均），只算 3 年以上的期間。`,
        '各年度報酬率是集保基金資訊觀測站（FundClear）公布的日曆年度含息報酬率，一年從 1 月到 12 月。',
        '過去的報酬不代表未來；表格裡的「－」是這檔 ETF 成立的時間比那個期間短，或那個期間不算年化。'
      ]"
    />
  </EtfPage>
</template>
