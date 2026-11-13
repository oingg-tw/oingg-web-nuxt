<script setup lang="ts">
import type { StockNewsResponse } from '#shared/types/stock-news'

// 近期新聞（2026-11-12，使用者：「個股要有一個頁面是呈現該個股的最近新聞用。資料來源會是playwright這個後台」；設計頁
// https://claude.ai/artifact/3n25Tvhai5n8ZzkdCqkRhu）：只列標題、來源、時間和連回原網站的連結，內容不轉載。
// 不給搜尋引擎收錄、不進 sitemap（使用者：「不收錄 noindex」）。「另開新視窗」只在卡片標題列寫一次、每則標題後放小箭頭（使用者：「小箭頭」；
// 站上其他外部連結把它寫在連結字裡），螢幕閱讀器每則仍唸得到
const route = useRoute()
const code = computed(() => String(route.params.code))

const TOPIC = '近期新聞'

const { stock, profile, stockShortName, stockPending } = useStockDetailSummary(code)
// 等它到了才換頁（Nitro 快取的小回應）：頁面沒有讀取中的樣子，就不會有資料晚到把版面往下推
const { data, error, refresh } = await useFetch<StockNewsResponse>(() => `/api/stock/${code.value}/news`, { key: () => `stock-news-${code.value}`, watch: [code] })
watchLoadFailure(() => `stock-news:${code.value}`, () => error.value, refresh)
// 伺服器算的「今天」帶到瀏覽器：今天／昨天的組名在 hydration 時不會不一樣
const today = useState('taipei-today', () => holdingsTaipeiDate())
const groups = computed(() => stockNewsGroups(data.value?.articles ?? [], today.value)
  .map(group => ({ ...group, label: `${group.prefix ? `${group.prefix} ` : ''}${shortDayLabel(group.day)}` })))
const count = computed(() => groups.value.reduce((sum, group) => sum + group.items.length, 0))
// 幾分鐘前要讀者看的時刻，掛上之後才算；接在行尾，補上時版面不動
const now = ref<number | null>(null)
onMounted(() => { now.value = Date.now() })

// 簡稱不比對的公司（統一、全家、世界…）一定是空的：不說「沒有新聞」，說為什麼不列，也不畫「0 則」的卡片
const searchable = computed(() => data.value?.isNameSearchable !== false)
const answer = computed(() => {
  if (!searchable.value) return `${stockShortName.value}的簡稱沒辦法從新聞標題比對（例如跟常用詞、地名或別家公司相同），所以這裡不列新聞。`
  const first = groups.value[0]
  const latest = first?.items[0]
  if (!first || !latest) return `最近 30 天沒有${stockShortName.value}的新聞。`
  const when = first.prefix ? `${first.prefix} ` : ` ${shortDayLabel(first.day)}`
  return `最近 30 天列出 ${count.value} 則${stockShortName.value}的新聞，最新一則是${when}${latest.time} ${latest.source}的報導。`
})
const description = computed(() => clampDescription(`${stockShortName.value}（${code.value}）最近 30 天的新聞：標題、來源與發布時間，依日期由新到舊排列，點標題到原網站看全文。`))

const { breadcrumbs } = useStockPageSeo({
  code,
  shortName: stockShortName,
  topic: TOPIC,
  titleKeywords: '近期新聞：最近 30 天的新聞標題與來源',
  pathSuffix: '/news',
  stock,
  description,
  sectorCode: computed(() => profile.value?.sectorCode ?? null),
  noindex: true
})

// 個股頁預設的免責聲明寫「以上數字整理自公開財報…」，這一頁沒有數字
const footer = {
  sources: ['各新聞網站：新聞標題與連結'],
  disclaimer: '以上新聞標題與連結整理自各新聞網站，內容以原網站為準，不代表本站對此個股之評等或投資建議。'
}
// 怎麼對到這家公司：數據中台的合約（8f4bd1a）寫的規則，給讀者的版本
const GUIDE = [
  '標題與連結取自各新聞網站公開的 RSS 與網站地圖，每則都標出來源；這裡不轉載內容，全文以原網站為準。',
  '標題含這家公司的簡稱才列出，不比對代號，也不看內文。同一處取最長的簡稱，例如「南亞科」不算南亞；兩個字的簡稱比對得比較嚴，少數新聞會漏掉。',
  '簡稱是常用詞或地名、或跟別家公司同名的（例如世界、全家、統一）不比對，這些公司這裡不會有新聞。',
  '只列最近 30 天、最多 30 則，依發布時間由新到舊排列，時間是台灣時間；來源沒給發布時間的，用第一次抓到的時間。'
]
</script>

<template>
  <StockPageShell
    class="stock-news-page"
    :code="code"
    :stock="stock"
    :pending="stockPending"
    :short-name="stockShortName"
    :topic="TOPIC"
    :breadcrumbs="breadcrumbs"
    :footer="footer"
  >
    <StockQuestionSection v-if="data" id="stock-news" :question="`${stockShortName}（${code}）最近有哪些新聞？`" :answer="answer">
      <section v-if="searchable" class="app-card stock-news" aria-labelledby="stock-news-title">
        <div class="stock-news__head">
          <h3 id="stock-news-title" class="stock-news__title">近 30 天的新聞・{{ count }} 則</h3>
          <span v-if="count" class="stock-news__hint">點標題到原網站看全文，另開新視窗</span>
        </div>
        <div v-for="group in groups" :key="group.day">
          <h4 class="stock-news__day">{{ group.label }}</h4>
          <ul class="stock-news__list">
            <li v-for="item in group.items" :key="item.link" class="stock-news__item">
              <a v-if="websiteHref(item.link)" :href="websiteHref(item.link)" target="_blank" rel="noopener" class="stock-news__link">{{ item.title }}<svg class="stock-news__arrow" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6" /><path d="M20 4 10 14" /><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></svg><span class="visually-hidden">（另開新視窗）</span></a>
              <span v-else class="stock-news__link">{{ item.title }}</span>
              <span class="stock-news__meta">{{ item.source }}・<time :datetime="item.publishedAt">{{ item.time }}</time>{{ now === null ? '' : stockNewsAgo(item.publishedAt, now) }}</span>
            </li>
          </ul>
        </div>
        <p v-if="!count" class="stock-news__empty">目前沒有新聞</p>
      </section>
    </StockQuestionSection>
    <template #guide>
      <StockMetricGuide id-prefix="stock-news" :topic="TOPIC" definition-question="這些新聞怎麼來的？" :definition="GUIDE" />
    </template>
  </StockPageShell>
</template>

<style scoped>
.stock-news {
  overflow: hidden;
}

.stock-news__head {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: baseline;
  gap: 4px 16px;
  padding: 16px;
}

.stock-news__title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
}

.stock-news__hint,
.stock-news__meta {
  font-size: 14px;
  color: var(--el-text-color-secondary);
}

/* 日期分組的標題同表頭：暖色底、一般文字色 */
.stock-news__day {
  margin: 0;
  padding: 8px 16px;
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-regular);
  background: var(--app-table-head-bg);
}

.stock-news__list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.stock-news__item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 14px 16px;
}

.stock-news__item + .stock-news__item {
  border-top: 1px solid var(--app-divider);
}

/* 標題最多兩行，多的用刪節號收尾 */
.stock-news__link {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  font-size: 17px;
  font-weight: 600;
  line-height: 1.5;
  color: var(--el-color-primary-dark-2);
  text-decoration: none;
}

span.stock-news__link {
  color: var(--el-text-color-primary);
}

a.stock-news__link:hover,
a.stock-news__link:focus-visible {
  text-decoration: underline;
  text-underline-offset: 3px;
}

.stock-news__arrow {
  width: 0.875em;
  height: 0.875em;
  margin-left: 6px;
  vertical-align: -1px;
}

.stock-news__empty {
  margin: 0;
  padding: 40px 16px;
  text-align: center;
  color: var(--el-text-color-secondary);
}

@media (max-width: 767px) {
  .stock-news__link {
    font-size: 16px;
  }
}
</style>
