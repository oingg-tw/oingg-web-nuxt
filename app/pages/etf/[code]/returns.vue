<script setup lang="ts">
// ETF 面向：報酬率（2026-10-18）。投信投顧公會委託臺大財金系的 ETF 績效評比，一個期間一根柱。定義（sitca-ts 2026-10-18 實測回推、已寫進
// export.v_etf_monthly_returns 的欄位註解）：含息報酬率＝配息再投入、以淨值計算，累積不年化，已處理分割，基準是那個月的月底。公會沒公布方法，
// 這是實測（0056 2025 年：公會 12.26、自算再投入 12.14、只看淨值 0.36）。不自己用股價或淨值算：上游日線與每日淨值都沒有還原分割（0050 2025-06 一拆四）
const etfData = await useEtf()
const { code, data, values, etf, shortName } = etfData

const rows = computed(() => ETF_RETURN_FIELDS.map(({ field, label }) => ({ label, value: typeof values.value[field] === 'number' ? values.value[field] as number : null })))
const month = computed(() => (etf.value?.yearMonth ? `${etf.value.yearMonth.slice(0, 4)} 年 ${Number(etf.value.yearMonth.slice(4))} 月` : null))

const answer = computed(() => {
  const known = rows.value.filter(row => row.value !== null)
  if (!known.length) return null
  const longest = known.at(-1)!
  const oneYear = rows.value.find(row => row.label === '近1年')?.value ?? null
  return `截至${month.value ?? '最新一期'}基金月報，${shortName.value}（${code.value}）${oneYear !== null ? `近 1 年含息報酬率 ${etfPct(oneYear)}，` : ''}有資料的最長期間是${longest.label}，累積含息報酬率 ${etfPct(longest.value)}（整段期間合計，不是每年平均）。`
})
</script>

<template>
  <EtfPage :etf-data="etfData" facet="returns" :description="answer">
    <StockQuestionSection id="etf-returns" :question="`${shortName}（${code}）過去各期間的含息報酬率是多少？`" :answer="answer">
      <EtfFacetChart v-if="data" :data="data" facet="returns" />
      <SharedTable :label="`${shortName}各期間報酬率`" :caption="`${shortName} ${code} 各期間報酬率（投信投顧公會基金月報${month ? `，${month}` : ''}）`">
        <thead>
          <tr>
            <th scope="col">期間</th>
            <th scope="col" class="seo-table__num">含息報酬率（累積）</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.label">
            <th scope="row">{{ row.label }}</th>
            <td class="seo-table__num">{{ etfPct(row.value) }}</td>
          </tr>
        </tbody>
      </SharedTable>
      <p class="hub-answer">報酬率是整段期間的累積報酬，不是每年平均。過去的報酬不代表未來；「－」是這檔 ETF 成立的時間比那個期間短。</p>
    </StockQuestionSection>
    <StockMetricGuide
      id-prefix="etf-returns"
      topic="含息報酬率"
      :definition="[
        '含息報酬率是把每次配息都再投入買回同一檔 ETF、以淨值計算的累積報酬，所以配息不會讓報酬率變低，也不是市價報酬率。',
        `數字來自投信投顧公會委託臺大財務金融學系做的 ETF 績效評比，計算到那個月的月底${month ? `（目前是 ${month}）` : ''}；分割已經處理過。`
      ]"
    />
  </EtfPage>
</template>
