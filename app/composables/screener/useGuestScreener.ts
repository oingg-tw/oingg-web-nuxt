import type { ScreenerTemplate } from '~/composables/screener/useScreenerTemplates'

// 只擁有訪客「挑選起始策略」的狀態。分頁／搜尋邏輯在 useScreenerTabs（buildGuestTab／addGuestTab），訪客編輯條件用的是登入分頁
// 同一套挑選器／範圍編輯器／欄位管理（「對陌生用戶還是要給完整的篩選功能」「選完模板後可以繼續自由編輯條件」）。訪客必須自己
// 選一個起始策略——由網站替他選條件會像推薦股票（「要自選 篩選條件 避免觸法」）；選好的 filters 與總覽欄位交給 screener/index.vue
// 餵進 addGuestTab。
// 2026-09-19 前是一進站就彈出、不能點遮罩關的對話框（介面複雜度檢視列為四個熱點之一，關掉後只剩空狀態）；現在挑選器直接在頁內
// （ScreenerGuestStrategyPicker），`loadTemplates` 取代了 openDialog。
// 只存在 session 裡（useState，重新整理就重置，不進 localStorage）：每次來都要重選正是註冊的賣點（「不想每次都重新選嗎？現在就
// 註冊，保留您自訂的篩選條件」）。
const OVERVIEW_COLUMN_TEMPLATE_KEY = 'overview'

// Only actually-runnable templates are offered here — a PENDING template has no real `filters`
// to run (see ScreenerTemplate's own comment). 原本還只給 tier FREE 的範本；2026-10-06 業務中台 把 tier 整個拿掉
// （使用者決定：範本＝篩選結果，依投信投顧法不分付費），所以訪客看到的是全部可執行的範本。
// 訪客挑的範本（或條件頁的 ?template）：條件、欄位（官方「總覽」組合）、名稱（未儲存那一組的名字）
export interface GuestSelection {
  filters: ScreenerTemplate['filters']
  fieldKeys: string[]
  name: string
}

export function guestSelectableTemplates(templates: ScreenerTemplate[]): ScreenerTemplate[] {
  return templates.filter(template => template.status === 'AVAILABLE')
}

export function useGuestScreener() {
  const { list: listTemplatesApi } = useScreenerTemplates()
  const { listTemplates: listColumnTemplatesApi } = useScreenerColumnPresets()

  const onboarded = useState('guest-screener-onboarded', () => false)
  const selectedTemplateId = useState<string | null>('guest-screener-template-id', () => null)

  const templates = useState<ScreenerTemplate[]>('guest-screener-templates', () => [])
  const templatesLoading = ref(false)
  // 進行中的那一次：再被呼叫時等同一個（2026-10-16 普通股頁在 setup 就先抓，?template 的解析稍後才來問；原本是布林旗標，
  // 進行中被呼叫會直接回傳，templateBySlug 拿到空清單、誤退回選範本）。失敗就清掉，重試才會再抓
  let templatesPromise: Promise<void> | null = null

  // Not user-facing — resolved purely so confirmOnboarding has 總覽's own fieldKeys ready by the
  // time the visitor actually picks a strategy and hits 確定.
  let overviewFieldKeysPromise: Promise<string[]> | null = null
  function resolveOverviewFieldKeys(): Promise<string[]> {
    // 讀不到時照舊用空欄位（訪客流程不因為欄位範本讀不到而卡住）；範本清單本身的失敗由下面的載入器報給彈窗
    overviewFieldKeysPromise ??= listColumnTemplatesApi().then(
      list => list.find(item => item.key === OVERVIEW_COLUMN_TEMPLATE_KEY)?.fieldKeys ?? [],
      () => []
    )
    return overviewFieldKeysPromise
  }

  // 失敗時重設旗標並報給全站讀取失敗彈窗（2026-10-11）；原本先設已載入，失敗之後整個 session 都是空清單
  const templatesFailure = shallowRef<unknown>(null)
  watchLoadFailure('guest-screener-templates', () => templatesFailure.value, () => loadTemplatesIfNeeded(), { scope: 'section' })

  function loadTemplatesIfNeeded(): Promise<void> {
    // 伺服器端已經抓好（頁面資料帶過來）就不再抓：重抓那段時間 templatesLoading 是 true，格子會換回「載入中…」再換回來
    if (templates.value.length) return Promise.resolve()
    templatesPromise ??= (async () => {
      templatesLoading.value = true
      try {
        templates.value = await listTemplatesApi()
        templatesFailure.value = null
      } catch (error) {
        templatesPromise = null
        templatesFailure.value = error
      } finally {
        templatesLoading.value = false
      }
    })()
    return templatesPromise
  }

  function loadTemplates(): Promise<void> {
    const loading = loadTemplatesIfNeeded()
    // Kicked off in parallel with the templates fetch above (not awaited here) so 總覽's field
    // keys are usually already resolved by the time the visitor hits 套用這組條件. 只在瀏覽器：套用時才用得到
    if (import.meta.client) resolveOverviewFieldKeys()
    return loading
  }

  async function selectionOf(template: ScreenerTemplate): Promise<GuestSelection> {
    const fieldKeys = await resolveOverviewFieldKeys()
    return { filters: template.filters, fieldKeys, name: template.name }
  }

  // Returns null if the picker's own selection isn't actually resolvable (shouldn't happen —
  // the confirm button is disabled until a template is picked) rather than ever handing the
  // caller a half-formed selection.
  async function resolveSelection(): Promise<GuestSelection | null> {
    const template = templates.value.find(item => item.id === selectedTemplateId.value)
    if (!template) return null
    const selection = await selectionOf(template)
    onboarded.value = true
    return selection
  }

  // 條件頁的 ?template：登入的人也用（打開一組未儲存的），所以不改訪客的狀態
  async function templateBySlug(slug: string): Promise<GuestSelection | null> {
    const name = screenerTemplateNameBySlug(slug)
    if (!name) return null
    // 欄位範本跟範本清單一起打（2026-10-16）：原本要等範本清單回來才開始問欄位，這段時間畫面是骨架，少等一趟
    resolveOverviewFieldKeys()
    await loadTemplatesIfNeeded()
    const template = guestSelectableTemplates(templates.value).find(item => item.name === name)
    return template ? selectionOf(template) : null
  }

  // 網址帶來的條件（?f=…，2026-10-22）：一組未儲存的篩選，欄位同範本（總覽）；網址也帶了欄位的話頁面會換掉
  async function filtersSelection(filters: GuestSelection['filters'], name: string): Promise<GuestSelection> {
    return { filters, fieldKeys: await resolveOverviewFieldKeys(), name }
  }

  // Deep link from a /screener/{slug} condition page's「套用至篩選器」(2026-09-19, the SEO build):
  // the visitor already picked a strategy on that page, so the in-page picker is skipped and
  // the same resolveSelection() path runs with the template found by name（the slug table is
  // shared/utils/hub-slugs.ts）. Null when the slug names no runnable FREE template — the caller
  // then falls back to showing the picker as on any other visit.
  return {
    onboarded,
    selectedTemplateId,
    templates,
    templatesLoading,
    loadTemplates,
    resolveSelection,
    templateBySlug,
    filtersSelection
  }
}
