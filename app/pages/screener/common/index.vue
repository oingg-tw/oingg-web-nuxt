<script setup lang="ts">
import type { HubSector } from '#shared/types/hub'
import type { GuestSelection } from '~/composables/screener/useGuestScreener'

// 普通股篩選（2026-10-15 三組篩選重新設計）：整頁交給 ScreenerPageShell，跟特別股、ETF 同一份畫面。這一頁只剩普通股自己的：
// 訪客先選一組範本（使用者決定普通股維持「先選範本才出結果」）、條件頁與產業頁的深層連結。
// 原本的兩排分頁（PresetFolder）、類股的「包含／排除＋多選」（現在是「類股」條件膠囊）、訪客橫幅（現在是「未儲存」＋「存成我的篩選」）
// 都拿掉了。
const route = useRoute()
const hasHydrated = useHasHydrated()
const showPeriod = useScreenerShowPeriod()

// <head> (2026-09-19): the canonical is the bare path — `?template=`/`?sector=` are entry points that open a screen, not
// separate pages. Since 2026-10-22 the URL then carries the screen itself (?f=…&c=…&sort=…, for bookmarks and sharing);
// the canonical stays bare so those variants never become pages of their own.
const requestUrl = useRequestURL()
useSeoMeta({
  title: '普通股篩選：依財報指標設定條件',
  description: '依 ROE、負債比率、殖利率等財報指標設定條件，篩出符合的上市櫃公司；可限定或排除證交所類股、依任一欄位排序，未登入也能使用，登入後可儲存自己的篩選條件。',
  robots: undefined
})
useHead({ link: [{ rel: 'canonical', href: `${requestUrl.origin}${SCREENER_PATHS.common}` }] })

// await（不只是解構）：條件膠囊的名稱在建立當下就從型錄烤進去，型錄在 GET /metrics 完成前被讀到，伺服器會拿到空型錄的名稱、
// 瀏覽器 hydration 拿到真的（從 SSR payload 還原），於是 hydration mismatch。
//
// 證交所類股：/api/hub/sectors（首頁、/stock、產業頁共用的那一支，有 Nitro SWR，型錄已經跟真實的公司清單對過一次）。
// 2026-10-01 從直打 業務中台 改過來的理由見 git 歷史（型錄說 33 家、點進去 404 的代號 13）。用在挑選面板的「類股」條件。
// （標題下那個「官方篩選條件說明與依類股瀏覽」連結區塊 2026-10-15 依使用者要求拿掉；條件說明頁另有新手專區文章與條件頁之間互連，
// 類股頁有 /industries 與首頁，sitemap 也都列著。）
//
// 兩者同時抓（2026-10-16）：互不相依，快取冷的時候原本要等型錄回來才開始問類股
const [, { data: sectors }] = await Promise.all([
  useFilterSchema(),
  useFetch<HubSector[]>('/api/hub/sectors', { key: 'hub-sectors', default: () => [] })
])
const linkedSectors = computed(() => sectors.value.filter(sector => sectorPath(sector.code)))

const screener = reactive(useScreenerTabs(linkedSectors))

const guest = useGuestScreener()
// 範本與「總覽」欄位一進來就先抓（2026-10-16）：不必等登入狀態確定（hydration 之後），?template 的解析與選範本稍後會等同一個請求。
// 登入的人用不到也只是一支有伺服器快取的小請求。
// 伺服器端也抓、等它回來再畫（2026-10-18）：訪客的範本格子第一次繪製就在。原本只在瀏覽器抓，先畫一行「載入中…」再換成整片格子，
// 「套用這組條件」那一列被推下去（全站量測 1440 寬 0.022）
const templatesReady = guest.loadTemplates()
if (import.meta.server) await templatesReady
const { open: openLogin } = useLoginDialog()

// ---- 深層連結（2026-09-19）：條件頁的「套用至篩選器」帶 ?template={slug}、產業頁的「想用更多條件篩選？」帶 ?sector={code}。
// 2026-10-15 起兩者都打開一組「未儲存」的篩選，不替登入的人新建（原本每點一次就多一組、吃三組合計的額度），也不改到已存的那一組。
// 網址帶篩選（2026-10-22，使用者要書籤與分享，選了條件＋欄位＋排序）：?f=…&c=…&sort=…（格式在 app/utils/screener-url.ts）。打開時
// 跟已存的哪一組條件一樣就選那一組（重新整理、書籤打開自己的篩選），不一樣就開一組「網址帶入的篩選」；之後網址跟著目前這一組走
//（useScreenerUrlSync），用過的 ?template／?sector 也在那時候換掉
const templateQuery = computed(() => (typeof route.query.template === 'string' ? route.query.template : null))
const sectorQuery = computed(() => (typeof route.query.sector === 'string' && linkedSectors.value.some(sector => sector.code === route.query.sector) ? route.query.sector : null))
// 只在進到這一頁時讀一次：之後的網址是畫面寫的
const urlState = decodeScreenerQuery(route.query)

type DeepLinkSelection = GuestSelection & { options?: { ownColumns: boolean, sort: { field: string, order: 'asc' | 'desc' } | null } }
async function urlSelection(): Promise<DeepLinkSelection | null> {
  // 業務中台要至少一個條件：只有欄位或排序的網址不另外開一組
  const filters = urlState ? filtersFromUrl(urlState.filters, screener.categories) : []
  if (!urlState || !filters.length) return null
  const columns = urlState.columns.filter(field => field.startsWith('stock.') || locateFieldInSchema(screener.categories, field))
  // 排序的欄位要在欄位裡（或代號），不然 業務中台 回 400
  const sort = urlState.sort && (urlState.sort.field === 'symbol' || columns.includes(urlState.sort.field)) ? urlState.sort : null
  const selection = await guest.filtersSelection(filters, '網址帶入的篩選')
  return { ...selection, fieldKeys: columns.length ? columns : selection.fieldKeys, options: { ownColumns: columns.length > 0, sort } }
}

const deepLinkSelection = (): Promise<DeepLinkSelection | null> => (templateQuery.value ? guest.templateBySlug(templateQuery.value) : urlSelection())

// ?template 還在解析時外殼維持骨架（2026-10-16）：不然選範本會先出現約 0.8 秒（「載入中…」→ 範本格子），再被結果整塊換掉，手機 CLS 0.112。
// 範本代號不存在或讀失敗（templateMissing）才退回選範本。宣告在下面的 watcher 之前：站內切頁進來時它的 immediate 會在 setup 當下就跑
const templateMissing = ref(false)
const templatePending = computed(() => !!(templateQuery.value || urlState?.filters.length) && !screener.activeTab && !templateMissing.value)

// 訪客、還沒有任何一組：?template 直接打開那個範本（條件頁就是他的選擇——那個選擇步驟的合規重點是「訪客自己選」，他選了）；
// 網址帶的條件同理；沒有就顯示選範本
let deepLinkOpened = false
watch(
  () => hasHydrated.value && screener.ready && !screener.activeTab,
  async (needsTab) => {
    if (!needsTab) return
    const selection = await deepLinkSelection()
    if (selection) {
      deepLinkOpened = true
      await screener.addLocalTab(selection.filters, selection.fieldKeys, selection.name, selection.options)
    } else {
      templateMissing.value = true
      guest.loadTemplates()
    }
  },
  { immediate: true }
)

// 有一組在畫面上之後：?template／網址帶的條件另外打開一組未儲存的（上面那個 watcher 已經開過就不再開；網址的條件跟已存的哪一組一樣
// 就選那一組）。訪客也是：頁籤存在 useState，站內換頁回來時訪客已經有一組，原本只給登入的人，訪客點了連結什麼都不會發生（2026-10-22）。
// ?sector 加上「類股：包含 X」——目前這組已存的話先複製成未儲存的
let deepLinkApplied = false
const urlSyncReady = ref(false)
watch(
  () => hasHydrated.value && screener.ready && !!screener.activeTab,
  async (ready) => {
    if (!ready || deepLinkApplied) return
    deepLinkApplied = true
    if (!deepLinkOpened) {
      const saved = urlState && !templateQuery.value ? screener.tabs.find(tab => !tab.unsaved && sameFilters(urlFiltersOf(tab.slots), urlState.filters)) : undefined
      if (saved) screener.selectTab(saved.id)
      else {
        const selection = await deepLinkSelection()
        if (selection) await screener.addLocalTab(selection.filters, selection.fieldKeys, selection.name, selection.options)
      }
    }
    if (sectorQuery.value) applySector(sectorQuery.value)
    urlSyncReady.value = true
  },
  { immediate: true }
)

useScreenerUrlSync(() => {
  const tab = screener.activeTab
  if (!urlSyncReady.value || !tab) return null
  return { filters: urlFiltersOf(tab.slots), columns: tab.columns.map(column => column.field), sort: tab.sortField && tab.sortOrder ? { field: tab.sortField, order: tab.sortOrder } : null }
})

// 「包含」：這個連結的意思是「在這個產業裡篩」，原本那組是排除模式也要回到包含
function applySector(code: string) {
  const tab = screener.activeTab
  if (!tab) return
  const others = tab.slots.filter(slot => slot.fieldId !== SECTOR_FIELD_ID)
  const slots = [...others, sectorSlot(others.reduce((max, slot) => Math.max(max, slot.id), -1) + 1, [code], false)]
  if (tab.unsaved) {
    tab.slots = slots
    return
  }
  const name = linkedSectors.value.find(sector => sector.code === code)?.name ?? code
  screener.addLocalCopy(tab, `${tab.name}（${name}）`.slice(0, 20), slots)
}

async function confirmGuestOnboarding() {
  const selection = await guest.resolveSelection()
  if (selection) await screener.addLocalTab(selection.filters, selection.fieldKeys, selection.name)
}
</script>

<template>
  <ScreenerPageShell universe="common" :screener="screener" :pending="templatePending">
    <!-- 只有普通股有期別（TTM、單季…）與每格各自的資料日期 -->
    <template #result-meta>
      <label class="common-screener__period-toggle">
        <el-switch v-model="showPeriod" />
        <!-- 手機上只畫「資料時間」（操作區方案 A，跟檔數擠同一行），名稱照樣是「顯示資料時間」 -->
        <span><span class="common-screener__period-verb">顯示</span>資料時間</span>
      </label>
    </template>

    <!-- 訪客還沒選範本：頁面內的選擇區（不是對話框，2026-09-19 介面複雜度檢討） -->
    <template #no-tab>
      <ScreenerGuestStrategyPicker
        :templates="guest.templates.value"
        :templates-loading="guest.templatesLoading.value"
        v-model:selected-template-id="guest.selectedTemplateId.value"
        @confirm="confirmGuestOnboarding"
        @register="openLogin()"
      />
    </template>
  </ScreenerPageShell>
</template>

<style scoped>
.common-screener__period-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 1rem;
  color: var(--el-text-color-secondary);
  cursor: pointer;
}

@media (max-width: 559px) {
  .common-screener__period-verb {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
}
</style>
