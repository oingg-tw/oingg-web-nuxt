<script setup lang="ts">
import type { MacroPageData } from '#shared/types/hub'

// 經濟成長率頁的各需求項目（2026-11-24，使用者 11-23「GDP 加上各項年增率」）：民間消費、政府消費、固定資本形成、輸出、輸入近 8 季的
// 實質年增率，一項一列、新的季在左。項目名與順序在 GDP_COMPONENTS（shared/utils/macro-series.ts）
const props = defineProps<{ components: NonNullable<MacroPageData['gdpComponents']> }>()

const pct = (value: number | null) => (value === null ? '－' : minusSign(`${value.toFixed(2)}%`))
const nameOf = (category: string) => GDP_COMPONENTS.find(component => component.category === category)?.name ?? category
const quarters = computed(() => [...(props.components[0]?.entries.map(entry => entry.period) ?? [])].reverse())
const valueAt = (component: (typeof props.components)[number], period: string) => component.entries.find(entry => entry.period === period)?.realYoyChangePct ?? null
const answer = computed(() => {
  const period = quarters.value[0]
  if (!period) return ''
  const parts = props.components.map(component => `${nameOf(component.category)} ${pct(valueAt(component, period))}`)
  return `${period} 各需求項目的實質年增率：${parts.join('、')}。`
})
</script>

<template>
  <section class="stock-page-section" aria-labelledby="macro-gdp-components-heading">
    <h2 id="macro-gdp-components-heading" class="stock-page-section__title">消費、投資、進出口各成長多少？</h2>
    <p class="hub-answer">{{ answer }}</p>
    <SharedTable label="各需求項目的實質年增率" caption-visible caption="各需求項目的實質年增率（跟去年同季相比，新的季在左）">
      <thead>
        <tr>
          <th scope="col">項目</th>
          <th v-for="period in quarters" :key="period" scope="col" class="seo-table__num">{{ period }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="component in components" :key="component.category">
          <th scope="row">{{ nameOf(component.category) }}</th>
          <td v-for="period in quarters" :key="period" class="seo-table__num">{{ pct(valueAt(component, period)) }}</td>
        </tr>
      </tbody>
    </SharedTable>
  </section>
</template>
