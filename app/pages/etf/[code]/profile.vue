<script setup lang="ts">
import type { FactItem } from '~/components/shared/SharedFactList.vue'

// ETF 面向：基本資料（2026-11-21；使用者 11-12 從基金後台沒用到的資料集只挑了這一份）。圖表看不出來的：全名、發行投信、經理人、保管機構、
// 成立日、追蹤指數、投資區域與標的、收益分配的原文（集保基金資訊觀測站）與風險等級。不放基金資訊觀測站的星等：那是別人的評等，本站不給評等；
// 費用與報酬已經有自己的面向。集保還沒收錄的新 ETF（fundProfile 是 null）只列月報與交易所有的那幾項
const etfData = await useEtf()
const { code, etf, text, num, values, shortName } = etfData

const profile = computed(() => etf.value?.fundProfile ?? null)

const answer = computed(() => {
  const item = etf.value
  if (!item) return null
  const parts = [`${shortName.value}（${code.value}）${item.fundName ? `全名「${item.fundName}」` : '是 ETF'}，由${item.issuerName}發行`]
  if (profile.value?.manager) parts.push(`經理人是${profile.value.manager}`)
  if (num('riskLevel') !== null) parts.push(`風險等級 ${etfRiskText(num('riskLevel'))}`)
  return `${parts.join('，')}。${profile.value ? '' : '集保還沒收錄它的經理人、保管機構與收益分配。'}`
})

const facts = computed<FactItem[]>(() => {
  const item = etf.value
  if (!item) return []
  const years = num('yearsSinceEstablished')
  return [
    { label: '基金全名', value: item.fundName || '－' },
    { label: '發行投信', value: item.issuerName },
    ...(profile.value ? [
      { label: '經理人', value: profile.value.manager ?? '－' },
      { label: '保管機構', value: profile.value.custodianBank ?? '－' }
    ] : []),
    { label: '成立日', value: text('establishedDate') ?? '－', note: years ? `成立 ${years} 年` : undefined },
    { label: '管理方式', value: item.trackingIndex ? `被動式，追蹤「${item.trackingIndex}」` : values.value.isActive === true ? '主動式，由經理人選股、不追蹤指數' : '－' },
    { label: '風險等級', value: etfRiskText(num('riskLevel')), note: profile.value ? `資料日期 ${profile.value.asOfDate}` : undefined },
    // 公開說明書與 PCF（2026-11-24，使用者「公開說明書連結要接上並顯示給用戶」、PCF「加連結」）：外部網址，另開新視窗、寫出會開到哪個網站。
    // 公開說明書給的是電子文件系統的入口頁（PDF 的連結每次重新產生），開了要再按一次才是 PDF。網址只收 http(s)（websiteHref），沒有就不列
    ...(websiteHref(item.prospectusUrl) ? [{ label: '公開說明書', value: `公開資訊觀測站${item.prospectusYearMonth ? `（${item.prospectusYearMonth} 版）` : ''}`, href: websiteHref(item.prospectusUrl), note: '開啟後再點一次是 PDF' }] : []),
    ...(websiteHref(item.pcfUrl) ? [{ label: '申購買回清單（PCF）', value: '投信網站', href: websiteHref(item.pcfUrl), note: '每天公布的持股明細' }] : []),
    ...(profile.value ? [
      { label: '投資區域', value: profile.value.investRegion ?? '－' },
      { label: '投資標的', value: profile.value.investTarget ?? '－', note: '集保原文', long: true },
      // 原文有的是一整段：long 讓它占滿整列
      { label: '收益分配', value: profile.value.distributionRule ?? '－', note: '集保原文', long: true }
    ] : [])
  ]
})
</script>

<template>
  <EtfPage :etf-data="etfData" facet="profile" :description="answer">
    <StockQuestionSection id="etf-profile" :question="`${shortName}（${code}）是誰在管理？收益怎麼分配？`" :answer="answer">
      <SharedChartCard v-if="facts.length"><SharedFactList :items="facts" :label="`${shortName}的基本資料`" /></SharedChartCard>
    </StockQuestionSection>
  </EtfPage>
</template>
