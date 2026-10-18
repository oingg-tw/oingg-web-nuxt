<script setup lang="ts">
// ETF 面向：報酬率（2026-10-18）。投信投顧公會基金月報的各期間報酬率，一個期間一根柱。累積、不年化（analysis-ts 2026-10-18 核對：sitca
// export.v_etf_monthly_returns 原樣轉發）；含不含息、基準日還在問 sitca-ts，問到之前不寫。不自己用股價算：日線沒有還原分割（0050 2025-06 一拆四），
// 自己算會在分割那天斷崖
const etfData = await useEtf()
const { code, data, values, etf, shortName } = etfData

const rows = computed(() => ETF_RETURN_FIELDS.map(({ field, label }) => ({ label, value: typeof values.value[field] === 'number' ? values.value[field] as number : null })))
const month = computed(() => (etf.value?.yearMonth ? `${etf.value.yearMonth.slice(0, 4)} 年 ${Number(etf.value.yearMonth.slice(4))} 月` : null))

const answer = computed(() => {
  const known = rows.value.filter(row => row.value !== null)
  if (!known.length) return null
  const longest = known.at(-1)!
  const oneYear = rows.value.find(row => row.label === '近1年')?.value ?? null
  return `截至${month.value ?? '最新一期'}基金月報，${shortName.value}（${code.value}）${oneYear !== null ? `近 1 年報酬率 ${etfPct(oneYear)}，` : ''}有資料的最長期間是${longest.label}，累積報酬率 ${etfPct(longest.value)}（整段期間合計，不是每年平均）。`
})
</script>

<template>
  <EtfPage :etf-data="etfData" facet="returns" :description="answer">
    <StockQuestionSection id="etf-returns" :question="`${shortName}（${code}）過去各期間的報酬率是多少？`" :answer="answer">
      <EtfFacetChart v-if="data" :data="data" facet="returns" />
      <SharedTableScroll :label="`${shortName}各期間報酬率`">
        <table class="seo-table" data-ssr-table>
          <caption class="visually-hidden">{{ shortName }} {{ code }} 各期間報酬率（投信投顧公會基金月報{{ month ? `，${month}` : '' }}）</caption>
          <thead>
            <tr>
              <th scope="col">期間</th>
              <th scope="col" class="seo-table__num">累積報酬率</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.label">
              <th scope="row">{{ row.label }}</th>
              <td class="seo-table__num">{{ etfPct(row.value) }}</td>
            </tr>
          </tbody>
        </table>
      </SharedTableScroll>
      <p class="hub-answer">報酬率是整段期間的累積報酬，不是每年平均。過去的報酬不代表未來；「－」通常是這檔 ETF 成立的時間比那個期間短。</p>
    </StockQuestionSection>
  </EtfPage>
</template>
