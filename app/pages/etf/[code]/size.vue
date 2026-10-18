<script setup lang="ts">
// ETF 面向：規模與受益人數（2026-10-18 第二批）。每月的規模柱＋受益人數線，法定下市門檻是虛線；表列每月的規模、受益人數、淨申購贖回、
// 定期定額。基金月報 2024-01 起。「規模低於法定下市門檻」照基本資料的寫法，只陳述事實
const etfData = await useEtf()
const { code, data, shortName } = etfData

const months = computed(() => [...(data.value?.monthly ?? [])].reverse())
const monthText = (yearMonth: string) => `${yearMonth.slice(0, 4)} 年 ${Number(yearMonth.slice(5))} 月`
const people = (value: number | null) => (value === null ? '－' : `${groupThousands(value)} 人`)
const money = (value: number | null) => (value === null ? '－' : formatMoney(value))

const answer = computed(() => {
  const latest = months.value[0]
  const first = months.value.at(-1)
  if (!latest || !first) return null
  const parts = [`${shortName.value}（${code.value}）${monthText(latest.yearMonth)}規模 ${money(latest.aum)}、受益人數 ${people(latest.holders)}`]
  if (first !== latest && first.aum !== null && latest.aum !== null) parts.push(`${monthText(first.yearMonth)}是 ${money(first.aum)}、${people(first.holders)}`)
  const below = latest.belowStatutoryThreshold === true && latest.statutoryAumThreshold !== null
  return `${parts.join('；')}${below ? `。規模低於法定下市門檻 ${money(latest.statutoryAumThreshold)}` : ''}。`
})
</script>

<template>
  <EtfPage :etf-data="etfData" facet="size" :description="answer">
    <StockQuestionSection id="etf-size" :question="`${shortName}（${code}）規模多大？受益人數有沒有變？`" :answer="answer">
      <EtfFacetChart v-if="data" :data="data" facet="size" />
      <SharedTableScroll v-if="months.length" :label="`${shortName}每月規模與受益人數`">
        <table class="seo-table" data-ssr-table>
          <caption class="visually-hidden">{{ shortName }} {{ code }} 每月規模、受益人數、淨申購與定期定額金額（投信投顧公會基金月報，新的在上）</caption>
          <thead>
            <tr>
              <th scope="col">月份</th>
              <th scope="col" class="seo-table__num">規模</th>
              <th scope="col" class="seo-table__num">受益人數</th>
              <th scope="col" class="seo-table__num">淨申購（申購 − 贖回）</th>
              <th scope="col" class="seo-table__num">定期定額金額</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in months" :key="row.yearMonth">
              <th scope="row">{{ row.yearMonth }}</th>
              <td class="seo-table__num">{{ money(row.aum) }}</td>
              <td class="seo-table__num">{{ people(row.holders) }}</td>
              <td class="seo-table__num">{{ money(row.netFlow) }}</td>
              <td class="seo-table__num">{{ money(row.dcaAmount) }}</td>
            </tr>
          </tbody>
        </table>
      </SharedTableScroll>
      <p class="hub-answer">規模跌破法定門檻、而且一段時間沒有回升，ETF 可能依規定下市清算（以發行投信的公告為準）。基金月報的資料從 2024 年 1 月起。</p>
    </StockQuestionSection>
  </EtfPage>
</template>
