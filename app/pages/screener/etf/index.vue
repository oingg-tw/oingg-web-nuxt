<script setup lang="ts">
// ETF 篩選（2026-10-15 三組篩選重新設計）：整頁交給 ScreenerPageShell，跟普通股、特別股同一份畫面；這一頁只給 ETF 的資料來源。
// 原本的條件編輯器、結果表、兩排分頁（EtfFilterEditor／EtfResultTable／PresetFolder）都拿掉了，「搜尋」按鈕也是——改條件 0.6 秒後自動查。
const requestUrl = useRequestURL()
useSeoMeta({
  title: 'ETF 篩選：依規模、費用率、配息頻率比較',
  description: '依基金類型、規模、總費用率、配息頻率、折溢價與各期報酬篩選上市櫃 ETF；可存成自己的篩選與欄位組合。'
})
useHead({ link: [{ rel: 'canonical', href: `${requestUrl.origin}${SCREENER_PATHS.etf}` }] })

const screener = reactive(useUniverseScreener(useEtfSource()))
</script>

<template>
  <ScreenerPageShell universe="etf" :screener="screener" />
</template>
