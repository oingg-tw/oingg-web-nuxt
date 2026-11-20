<script setup lang="ts">
import type { MaterialAnnouncementsResponse } from '#shared/types/material-announcements'

// 重大訊息（使用者 2026-11-12 定的頁面，資料 2026-11-21 上線）：上市讀證交所、上櫃讀櫃買的每日重大訊息。版面沿用近期新聞（依日期分組、
// 寫發言時刻），每則在原地展開看全文（.app-disclosure，原文換行照留）。公開資料，給搜尋引擎收錄；沒有任何一則就 noindex。每則沒有對外
// 連結：OpenAPI 不給每則的網址。出處照政府資料開放授權條款第 1 版的附件寫在頁尾：機關、年份、資料集名稱，加上授權條款與網址
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
// 興櫃沒有來源（dataSince 是 null）：不畫空的卡片，說為什麼沒有
const noSource = computed(() => !!data.value && data.value.dataSince === null)

const answer = computed(() => {
  if (!data.value) return null
  if (noSource.value) return '興櫃公司的重大訊息目前沒有資料來源，這裡不列。'
  const first = groups.value[0]
  const latest = first?.items[0]
  if (!first || !latest) return `${stockShortName.value}從 ${data.value.dataSince} 起還沒有重大訊息。`
  return `${stockShortName.value}最近有 ${total.value} 則重大訊息，最新一則的發言時間是 ${first.prefix || shortDayLabel(first.day)}${latest.time ? ` ${latest.time}` : ''}。`
})
const description = computed(() => clampDescription(`${stockShortName.value}（${code.value}）的重大訊息：發言日期、時刻與公告全文，依時間由新到舊，資料取自臺灣證券交易所與證券櫃檯買賣中心。`))

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

// 出處（政府資料開放授權條款第 1 版附件的三項：機關／年份／資料集名稱、授權條款、條款網址）。這一頁沒有財報數字，免責改寫
const footer = {
  sources: ['臺灣證券交易所（2026）上市公司每日重大訊息', '證券櫃檯買賣中心（2026）上櫃公司每日重大訊息'],
  links: [{ to: 'https://data.gov.tw/license', label: '政府資料開放授權條款第 1 版', external: true }],
  disclaimer: '以上重大訊息依政府資料開放授權條款第 1 版，取自臺灣證券交易所與證券櫃檯買賣中心的開放資料，原文照錄；正式內容以公開資訊觀測站為準，不代表本站對此個股之評等或投資建議。'
}
// 更新時間兩個市場都寫：證交所的檔案每天約 05:24 換、06:20 抓（11-13 證交所確認）；櫃買的 14:00 換、15:20 抓，週末照常（11-16 櫃買中心
// 量過）。兩邊都是前一天的公告
const GUIDE = [
  '上市公司的重大訊息取自臺灣證券交易所（2026-08-28 起），上櫃公司取自證券櫃檯買賣中心（2026-11-11 起）；興櫃公司目前沒有來源。',
  '上市的每天早上約 6 點半更新，上櫃的每天下午約 3 點半更新，都是前一天的公告，所以今天發布的公告最快明天才會出現在這裡。',
  '每則點開是公告全文，原文照錄；正式內容以公開資訊觀測站為準。這裡列最近 30 則，依發言時間由新到舊排列，時間是台灣時間。'
]
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
      <section v-if="!noSource" class="app-card stock-announcements" aria-labelledby="stock-announcements-title">
        <div class="stock-announcements__head">
          <h3 id="stock-announcements-title" class="stock-announcements__title">重大訊息・{{ total }} 則</h3>
          <span v-if="total > shown" class="stock-announcements__hint">列最近 {{ shown }} 則</span>
        </div>
        <div v-for="group in groups" :key="group.day">
          <h4 class="stock-announcements__day">{{ group.label }}</h4>
          <ul class="stock-announcements__list">
            <li v-for="(item, index) in group.items" :key="`${group.day}-${index}`" class="stock-announcements__item">
              <details class="app-disclosure">
                <summary>
                  <span class="stock-announcements__subject">{{ item.subject }}</span>
                  <time v-if="item.time" class="stock-announcements__time" :datetime="item.announcedAt ?? undefined">{{ item.time }}</time>
                </summary>
                <p class="stock-announcements__body">{{ item.description }}</p>
              </details>
            </li>
          </ul>
        </div>
        <p v-if="!shown" class="stock-announcements__empty">目前沒有重大訊息</p>
      </section>
    </StockQuestionSection>
    <template #guide>
      <StockMetricGuide id-prefix="stock-announcements" :topic="TOPIC" definition-question="這些重大訊息怎麼來的？" :definition="GUIDE" />
    </template>
  </StockPageShell>
</template>

<style scoped>
.stock-announcements {
  overflow: hidden;
}

.stock-announcements__head {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: baseline;
  gap: 4px 16px;
  padding: 16px;
}

.stock-announcements__title {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 700;
}

.stock-announcements__hint,
.stock-announcements__time {
  font-size: 0.875rem;
  color: var(--el-text-color-secondary);
}

/* 日期分組的標題同近期新聞：暖色底、一般文字色 */
.stock-announcements__day {
  margin: 0;
  padding: 8px 16px;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--el-text-color-regular);
  background: var(--app-table-head-bg);
}

.stock-announcements__list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.stock-announcements__item {
  padding: 4px 16px;
}

.stock-announcements__item + .stock-announcements__item {
  border-top: 1px solid var(--app-divider);
}

/* 主旨換行照排（上游有的主旨中間就有換行），時刻接在主旨後面、靠右 */
.stock-announcements__subject {
  flex: 1;
  font-weight: 600;
  line-height: 1.5;
}

.stock-announcements__time {
  flex: none;
}

/* 全文：原文的換行照留，長的網址或數字也能斷行 */
.stock-announcements__body {
  margin: 0 0 12px;
  white-space: pre-line;
  overflow-wrap: anywhere;
  line-height: 1.8;
}

.stock-announcements__empty {
  margin: 0;
  padding: 40px 16px;
  text-align: center;
  color: var(--el-text-color-secondary);
}
</style>
