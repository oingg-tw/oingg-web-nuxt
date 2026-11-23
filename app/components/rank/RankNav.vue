<script setup lang="ts">
// 排行的側欄（2026-10-21，使用者：「rank 希望 sidebar 區分 普通股與 etf」）。同日改成只列一組（使用者：「rank sidebar 項目請減少」，選
//「只列目前這一組」），「類別」切換另一組（SharedScopeSwitch）。切換只換側欄的清單、不換頁；換頁或重新整理回到這一頁所屬的那一組。
// 排行總覽（/rank）先列普通股。類別放在清單上面（使用者：「類別放上是否更合理」）：它決定下面列哪一組，先選再看；持股的帳戶切換在下面，
// 因為換帳戶時頁面清單不變。
// 只列熱門的排行（2026-11-23，使用者選「只列熱門的」，清單在 RANK_NAV），最後一列「全部排行」連到總覽；從總覽卡片進來、不在清單上的
// 排行頁標在「全部排行」底下（SharedSectionNav 的 activeTo）。手機的膠囊列用同一份清單（pages/rank/[slug].vue）。
// 手機底部條「目前：」後面接是哪一組（兩組都有「殖利率」這類名字）。版面與兩份 DOM 的理由在 SharedSectionNav.vue
const props = defineProps<{ etf?: boolean }>()
const route = useRoute()

const GROUPS = [{ id: 'common', name: '普通股' }, { id: 'etf', name: 'ETF' }]
const group = ref<'common' | 'etf'>(props.etf ? 'etf' : 'common')
const items = computed(() => {
  const total = RANK_PAGES.filter(page => (page.universe === 'etf') === (group.value === 'etf')).length
  return [
    ...RANK_NAV[group.value].flatMap(slug => findRankPage(slug) ?? []).map(page => ({ label: page.short ?? page.label, to: rankPath(page.slug) })),
    { label: `全部排行（${total} 種）`, to: '/rank', divided: true }
  ]
})
const activeTo = computed(() => (items.value.some(item => item.to === route.path) ? undefined : '/rank'))
</script>

<template>
  <SharedSectionNav label="排行" :items="items" :active-to="activeTo" :current-detail="etf ? 'ETF' : null">
    <template #before>
      <SharedScopeSwitch class="rail-group--lead" heading="類別" :items="GROUPS" :active-id="group" @select="(id) => { if (id === 'common' || id === 'etf') group = id }" />
    </template>
  </SharedSectionNav>
</template>
