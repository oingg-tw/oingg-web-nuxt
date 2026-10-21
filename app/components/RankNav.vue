<script setup lang="ts">
// 排行的側欄（2026-10-21，使用者：「rank 希望 sidebar 區分 普通股與 etf」）。同日改成只列一組（使用者：「rank sidebar 項目請減少」，選
//「只列目前這一組」）：普通股排行頁只列 8 個普通股排行、ETF 排行頁只列 5 個 ETF 排行，「類別」切換另一組（SharedScopeSwitch）。切換只換
// 側欄的清單、不換頁；換頁或重新整理回到這一頁所屬的那一組。排行總覽（/rank）先列普通股。類別放在清單上面（使用者：「類別放上是否更合理」）：
// 它決定下面列哪一組，先選再看；持股的帳戶切換在下面，因為換帳戶時頁面清單不變。
// 手機底部條「目前：」後面接是哪一組（兩組都有「殖利率」這類名字）。版面與兩份 DOM 的理由在 SectionNav.vue
const props = defineProps<{ etf?: boolean }>()

const GROUPS = [{ id: 'common', name: '普通股' }, { id: 'etf', name: 'ETF' }]
const group = ref(props.etf ? 'etf' : 'common')
const items = computed(() => RANK_PAGES
  .filter(page => (page.universe === 'etf') === (group.value === 'etf'))
  .map(page => ({ label: page.label, to: rankPath(page.slug) })))
</script>

<template>
  <SectionNav label="排行" :items="items" :current-detail="etf ? 'ETF' : null">
    <template #before>
      <SharedScopeSwitch class="rail-group--lead" heading="類別" :items="GROUPS" :active-id="group" @select="(id) => { if (id) group = id }" />
    </template>
  </SectionNav>
</template>
