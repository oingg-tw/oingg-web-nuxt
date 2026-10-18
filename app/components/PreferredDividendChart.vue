<script setup lang="ts">
// 特別股每年實際配發的股息（2026-10-18）：一年一根柱，虛線是目前公告的每年股息。重設型的特別股看得出哪一年開始變了（2881A 2.46 → 2.66、2.75 元），
// 沒有柱的年份是那一年沒有除息紀錄。卡片外殼在 SharedChartCard（圖一律在卡片裡）
const props = defineProps<{
  years: { year: string; amount: number | null }[]
  // 目前公告的每年股息；null 時不畫虛線
  dividendRate: number | null
  shortName: string
}>()

const { resolvedMode, color: accentColorName } = useAppTheme()

const option = computed(() => {
  const accent = getAccentColor(resolvedMode.value, accentColorName.value)
  const ink = getChartInk(resolvedMode.value)
  return {
    grid: { left: 8, right: 16, top: 40, bottom: 8, containLabel: true },
    tooltip: {
      trigger: 'axis',
      formatter: (params: { dataIndex: number }[]) => {
        const row = props.years[params[0]?.dataIndex ?? -1]
        return row ? `<div style="font-size:1rem"><div style="font-weight:600">${row.year} 年</div><div>實際配發 ${row.amount === null ? '沒有除息紀錄' : preferredYuan(row.amount)}</div></div>` : ''
      }
    },
    xAxis: { type: 'category', data: props.years.map(row => row.year) },
    yAxis: { type: 'value', name: '元', nameTextStyle: { align: 'left' } },
    series: [{
      type: 'bar',
      name: '實際配發',
      data: props.years.map(row => row.amount),
      itemStyle: { color: accent },
      barMaxWidth: 48,
      markLine: props.dividendRate === null
        ? undefined
        : {
            silent: true,
            symbol: 'none',
            lineStyle: { color: ink.baseline, type: 'dashed', width: 2 },
            label: { formatter: `目前每年股息 ${preferredYuan(props.dividendRate)}`, color: ink.primary, fontSize: 16, position: 'insideEndTop' },
            data: [{ yAxis: props.dividendRate }]
          }
    }]
  }
})
</script>

<template>
  <SharedChartCard>
    <SharedChart class="app-chart preferred-dividend-chart" :option="option" autoresize :aria-label="`${shortName}近 ${years.length} 年每年實際配發的股息長條圖，虛線是目前公告的每年股息`" />
  </SharedChartCard>
</template>

<style scoped>
.preferred-dividend-chart {
  height: 320px;
}
</style>
