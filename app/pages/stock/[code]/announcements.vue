<script setup lang="ts">
import type { MaterialAnnouncementsResponse } from '#shared/types/material-announcements'

// 重大訊息（使用者 2026-11-12 定的頁面，資料 2026-11-21 上線）。2026-11-24 起數據中台改讀公開資訊觀測站（2016 起，上市、上櫃、興櫃都有），
// 公開資訊觀測站還沒收進來的最近幾天接兩所的開放資料；同日每則多了負面事件的類別（公開觀測站分類，主旨前一個標籤，答句寫最近幾則裡有幾則）。
// 版面沿用近期新聞（依日期分組、寫發言時刻），每則在原地展開看全文（.app-disclosure，原文換行照留）。公開資料，給搜尋引擎收錄；沒有任何
// 一則就 noindex。每則沒有對外連結：來源不給每則的網址。出處寫在頁尾：公開資訊觀測站（使用者視為已授權），加上兩所開放資料照政府資料開放
// 授權條款第 1 版附件寫的機關、年份、資料集名稱與條款網址
// shortcut: 使用者要的是全站的「資料來源與授權」頁加頁尾連結；那一頁等數據中台的 GET /data-sources，到了之後出處改連過去
const route = useRoute()
const code = computed(() => String(route.params.code))

const TOPIC = '重大訊息'

const { stock, profile, stockShortName, stockPending } = useStockDetailSummary(code)
// 等它到了才換頁（同近期新聞）：頁面沒有讀取中的樣子，資料晚到不會把版面往下推
const { data, error, refresh } = await useFetch<MaterialAnnouncementsResponse>(() => `/api/stock/${code.value}/announcements`, { key: () => `stock-announcements-${code.value}`, watch: [code] })
watchLoadFailure(() => `stock-announcements:${code.value}`, () => error.value, refresh)
// 伺服器算的「今天」帶到瀏覽器：今天／昨天的組名在 hydration 時不會不一樣
const today = useState('taipei-today', () => holdingsTaipeiDate())
const groups = computed(() => announcementGroups(data.value?.entries ?? [], today.value)
  .map(group => ({ ...group, label: `${group.prefix ? `${group.prefix} ` : ''}${shortDayLabel(group.day)}` })))
const shown = computed(() => groups.value.reduce((sum, group) => sum + group.items.length, 0))
const total = computed(() => data.value?.count ?? 0)
// 沒有來源（dataSince 是 null；2026-11-24 起三個市場都有，留著防上游哪天又沒有）：不畫空的卡片，說為什麼沒有
const noSource = computed(() => !!data.value && data.value.dataSince === null)
// 列出來的這幾則裡標了負面事件的（還沒分類的是 null，不算）
const negatives = computed(() => groups.value.flatMap(group => group.items).flatMap(item => negativeEventLabel(item.negativeEvent) ?? []))

const answer = computed(() => {
  if (!data.value) return null
  if (noSource.value) return `目前沒有${stockShortName.value}重大訊息的資料來源，這裡不列。`
  const first = groups.value[0]
  const latest = first?.items[0]
  if (!first || !latest) return `${stockShortName.value}從 ${data.value.dataSince} 起還沒有重大訊息。`
  const negative = negatives.value.length ? `最近 ${shown.value} 則裡有 ${negatives.value.length} 則負面事件（${[...new Set(negatives.value)].join('、')}）。` : ''
  return `${stockShortName.value}最近有 ${total.value} 則重大訊息，最新一則的發言時間是 ${first.prefix || shortDayLabel(first.day)}${latest.time ? ` ${latest.time}` : ''}。${negative}`
})
const description = computed(() => clampDescription(`${stockShortName.value}（${code.value}）的重大訊息：發言日期、時刻與公告全文，依時間由新到舊，資料取自公開資訊觀測站。`))

const { breadcrumbs } = useStockPageSeo({
  code,
  shortName: stockShortName,
  topic: TOPIC,
  titleKeywords: '重大訊息：最新公告與全文',
  pathSuffix: '/announcements',
  stock,
  description,
  sectorCode: computed(() => profile.value?.sectorCode ?? null),
  noindex: computed(() => !shown.value)
})

// 出處：公開資訊觀測站（使用者 2026-11-22「Mops fundclear視為已有授權」），最近幾天接的兩所開放資料照政府資料開放授權條款第 1 版附件寫
//（機關／年份／資料集名稱、授權條款、條款網址）。這一頁沒有財報數字，免責改寫
const footer = {
  sources: ['公開資訊觀測站 重大訊息', '臺灣證券交易所（2026）上市公司每日重大訊息', '證券櫃檯買賣中心（2026）上櫃公司每日重大訊息'],
  links: [{ to: 'https://data.gov.tw/license', label: '政府資料開放授權條款第 1 版', external: true }],
  disclaimer: '以上重大訊息取自公開資訊觀測站；它還沒收進來的最近幾天，取自臺灣證券交易所與證券櫃檯買賣中心依政府資料開放授權條款第 1 版提供的開放資料。原文照錄，正式內容以公開資訊觀測站為準，不代表本站對此個股之評等或投資建議。'
}
// 最近幾天的更新時間照兩所的寫：證交所的檔案每天約 05:24 換、06:20 抓（11-13 證交所確認）；櫃買的 14:00 換、14:10 抓（11-21 起），
// 週末照常。興櫃只有公開資訊觀測站，出現的時間可能比上市、上櫃晚。負面事件的類別與分類日是數據中台的（公開觀測站分類）
const guide = computed(() => [
  '重大訊息取自公開資訊觀測站，上市、上櫃、興櫃都有，從 2016 年起；公開資訊觀測站還沒收進來的最近幾天，上市的取自臺灣證券交易所、上櫃的取自證券櫃檯買賣中心。',
  '上市的最近幾天每天早上約 6 點半更新，上櫃的每天下午約 2 點半更新，都是前一天的公告，所以今天發布的公告最快明天才會出現在這裡；興櫃的只取自公開資訊觀測站，出現的時間可能比上市、上櫃晚。',
  `標成負面事件的有八種：${Object.values(NEGATIVE_EVENT_LABELS).join('、')}，由公開資訊觀測站依公告內容分類${data.value?.classifiedThroughDate ? `，目前分類到 ${data.value.classifiedThroughDate}，之後的公告還沒分類` : ''}。沒有標的公告不代表沒有影響。`,
  '每則點開是公告全文，原文照錄；正式內容以公開資訊觀測站為準。這裡列最近 30 則，依發言時間由新到舊排列，時間是台灣時間。'
])
</script>

<template>
  <StockPageShell
    class="stock-announcements-page"
    :code="code"
    :stock="stock"
    :pending="stockPending"
    :short-name="stockShortName"
    :topic="TOPIC"
    :breadcrumbs="breadcrumbs"
    :footer="footer"
  >
    <StockQuestionSection v-if="data" id="stock-announcements" :question="`${stockShortName}（${code}）最近有哪些重大訊息？`" :answer="answer">
      <SharedAnnouncementList v-if="!noSource" :groups="groups" :title="`重大訊息・${total} 則`" :hint="total > shown ? `列最近 ${shown} 則` : ''" empty-text="目前沒有重大訊息" />
    </StockQuestionSection>
    <template #guide>
      <StockMetricGuide id-prefix="stock-announcements" :topic="TOPIC" definition-question="這些重大訊息怎麼來的？" :definition="guide" />
    </template>
  </StockPageShell>
</template>
