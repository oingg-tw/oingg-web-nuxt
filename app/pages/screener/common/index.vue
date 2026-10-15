<script setup lang="ts">
import type { HubSector, ScreenerTemplateWithSlug } from '#shared/types/hub'

// 普通股篩選（2026-10-15 三組篩選重新設計）：整頁交給 ScreenerPageShell，跟特別股、ETF 同一份畫面。這一頁只剩普通股自己的：
// SEO 用的官方範本與類股連結、訪客先選一組範本（使用者決定普通股維持「先選範本才出結果」）、條件頁與產業頁的深層連結。
// 原本的兩排分頁（PresetFolder）、類股的「包含／排除＋多選」（現在是「類股」條件膠囊）、訪客橫幅（現在是「未儲存」＋「存成我的篩選」）
// 都拿掉了。
const route = useRoute()
const router = useRouter()
const hasHydrated = useHasHydrated()
const showPeriod = useScreenerShowPeriod()
const currentUser = useCurrentUser()

// <head> (2026-09-19): the canonical is the bare path — `?template=`/`?sector=` are entry points that open a screen, not
// separate pages, and the query is dropped from the URL once applied (see the deep-link watchers below).
const requestUrl = useRequestURL()
useSeoMeta({
  title: '普通股篩選：依財報指標設定條件',
  description: '依 ROE、負債比率、殖利率等財報指標設定條件，篩出符合的上市櫃公司；可限定或排除證交所類股、依任一欄位排序，未登入也能使用，登入後可儲存自己的篩選條件。',
  robots: undefined
})
useHead({ link: [{ rel: 'canonical', href: `${requestUrl.origin}${SCREENER_PATHS.common}` }] })

// await（不只是解構）：條件膠囊的名稱在建立當下就從型錄烤進去，型錄在 GET /metrics 完成前被讀到，伺服器會拿到空型錄的名稱、
// 瀏覽器 hydration 拿到真的（從 SSR payload 還原），於是 hydration mismatch。
await useFilterSchema()

// 證交所類股：/api/hub/sectors（首頁、/stock、產業頁共用的那一支，有 Nitro SWR，型錄已經跟真實的公司清單對過一次）。
// 2026-10-01 從直打 業務中台 改過來的理由見 git 歷史（型錄說 33 家、點進去 404 的代號 13）。這裡兩個用途：挑選面板的「類股」條件、
// 下面 SEO 區塊的類股連結。
const { data: sectors } = await useFetch<HubSector[]>('/api/hub/sectors', { key: 'hub-sectors', default: () => [] })
const linkedSectors = computed(() => sectors.value.filter(sector => sectorPath(sector.code)))

// The official templates with their /screener/common/{slug} pages — server-rendered links in the collapsible block under
// the title, so a crawler reaches every condition page and every sector page from here（/api/hub/screener-templates, cached 24h）.
const { data: hubTemplates } = await useFetch<ScreenerTemplateWithSlug[]>('/api/hub/screener-templates', { key: 'hub-screener-templates', default: () => [] })
const linkedTemplates = computed(() => hubTemplates.value.filter(item => item.slug && item.status === 'AVAILABLE'))

const screener = reactive(useScreenerTabs(linkedSectors))

const guest = useGuestScreener()
const { open: openLogin } = useLoginDialog()

// ---- 深層連結（2026-09-19）：條件頁的「套用至篩選器」帶 ?template={slug}、產業頁的「想用更多條件篩選？」帶 ?sector={code}。
// 2026-10-15 起兩者都打開一組「未儲存」的篩選，不替登入的人新建（原本每點一次就多一組、吃三組合計的額度），也不改到已存的那一組。
// 套用一次之後把 query 拿掉（畫面狀態不留在網址裡）。
const templateQuery = computed(() => (typeof route.query.template === 'string' ? route.query.template : null))
const sectorQuery = computed(() => (typeof route.query.sector === 'string' && linkedSectors.value.some(sector => sector.code === route.query.sector) ? route.query.sector : null))

function clearDeepLinkQuery() {
  if (templateQuery.value || route.query.sector !== undefined) router.replace({ query: {} })
}

// 訪客、還沒有任何一組：?template 直接打開那個範本（條件頁就是他的選擇——那個選擇步驟的合規重點是「訪客自己選」，他選了）；
// 沒有就顯示選範本
watch(
  () => hasHydrated.value && screener.ready && !screener.activeTab,
  async (needsTab) => {
    if (!needsTab) return
    const selection = templateQuery.value ? await guest.templateBySlug(templateQuery.value) : null
    if (selection) await screener.addLocalTab(selection.filters, selection.fieldKeys, selection.name)
    else guest.loadTemplates()
  },
  { immediate: true }
)

// 有一組在畫面上之後：登入的人的 ?template 打開一組未儲存的；?sector 加上「類股：包含 X」——目前這組已存的話先複製成未儲存的
let deepLinkApplied = false
watch(
  () => hasHydrated.value && screener.ready && !!screener.activeTab,
  async (ready) => {
    if (!ready || deepLinkApplied) return
    deepLinkApplied = true
    if (templateQuery.value && currentUser.value) {
      const selection = await guest.templateBySlug(templateQuery.value)
      if (selection) await screener.addLocalTab(selection.filters, selection.fieldKeys, selection.name)
    }
    if (sectorQuery.value) applySector(sectorQuery.value)
    clearDeepLinkQuery()
  },
  { immediate: true }
)

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
  <ScreenerPageShell universe="common" :screener="screener">
    <!-- Server-rendered, JavaScript-free entry points (2026-09-19, the SEO build): the official condition pages and the
         sector pages in a closed <details> — links every condition page and /industry/… page can be reached through
         without taking vertical space from the screener itself. -->
    <template #before>
      <details class="common-screener__seo">
        <summary class="common-screener__seo-summary">官方篩選條件說明與依類股瀏覽</summary>
        <div class="common-screener__seo-body">
          <h2 class="common-screener__seo-heading">官方篩選條件</h2>
          <ul class="hub-chip-list">
            <li v-for="item in linkedTemplates" :key="item.id">
              <NuxtLink :to="screenerTemplatePath(item.slug!)" class="hub-chip">{{ item.name }}</NuxtLink>
            </li>
          </ul>
          <h2 class="common-screener__seo-heading">依類股瀏覽</h2>
          <ul class="hub-chip-list">
            <li v-for="sector in linkedSectors" :key="sector.code">
              <NuxtLink :to="sectorPath(sector.code) ?? '/stock'" class="hub-chip">{{ sector.name }}（{{ sector.companyCount }}）</NuxtLink>
            </li>
          </ul>
        </div>
      </details>
    </template>

    <!-- 只有普通股有期別（TTM、單季…）與每格各自的資料日期 -->
    <template #result-meta>
      <label class="common-screener__period-toggle">
        <el-switch v-model="showPeriod" />
        <span>顯示資料時間</span>
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
/* A real <details>: works without JavaScript and by keyboard; the summary is a ≥44px row. */
.common-screener__seo {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 12px;
}

.common-screener__seo-summary {
  display: flex;
  align-items: center;
  min-height: 44px;
  padding: 0 16px;
  cursor: pointer;
  font-size: 1rem;
  font-weight: 600;
}

.common-screener__seo-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 0 16px 16px;
}

.common-screener__seo-heading {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}

.common-screener__period-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 1rem;
  color: var(--el-text-color-secondary);
  cursor: pointer;
}
</style>
