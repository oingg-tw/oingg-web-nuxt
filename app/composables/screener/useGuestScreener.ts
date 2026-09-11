import { columnLabelFrom } from '~/composables/screener/useFilterSchema'
import type { FilterCriterion } from '~/composables/screener/useFilterSearch'
import type { ScreenerTab } from '~/composables/screener/useScreenerTabs'
import type { ScreenerTemplate } from '~/composables/screener/useScreenerTemplates'
import type { ColumnPresetTemplate } from '~/composables/screener/useScreenerColumnPresets'

// The signed-out counterpart to useScreenerTabs.ts's own multi-tab, backend-persisted flow —
// per direct request ("選股篩選 陌生用戶造訪時就先跳彈窗...選兩個選項...確定再帶入") a first-time
// anonymous visitor picks one official filter strategy (ScreenerTemplate) + one official column
// set (ColumnPresetTemplate) from a single onboarding dialog, then sees real results immediately
// via bff-ts's stateless POST /screener (confirmed fully public 2026-09-11, see
// useScreenerPresets.ts's own runStateless) — no ScreenerPreset/ColumnPreset is ever created,
// nothing here survives past this browser tab unless the visitor actually registers, which is
// the whole basis for the registration nudge this flow leads into.
//
// Deliberately independent of useScreenerTabs.ts's own templates/columnPresetTemplates lists —
// those are only ever lazily loaded from behind openNewTabDialog/openNewColumnPresetDialog,
// both of which gate on currentUser and redirect a guest straight to openLogin() before ever
// fetching. GET /screener/templates and GET /screener/column-preset-templates are both
// confirmed public, so this composable fetches its own copies independently rather than
// threading a login-conditional dependency through a flow that must work with zero login.
//
// `guestTab` is shaped exactly like useScreenerTabs.ts's own ScreenerTab so it can be handed
// straight to ScreenerOrganismResultBody/ScreenerOrganismResultTable unmodified — most of its
// fields (slots/sectorCodes/columnPresetId/columnViewCache/renaming/renameDraft) are simply
// unused placeholders here, since this flow has no tab strip, no editable conditions, no column
// picker — just one read-only result view built from the two template choices.
const DEFAULT_PAGE_SIZE = 20

// Only FREE, actually-runnable templates are offered here — a PENDING template has no real
// `filters` to run (see ScreenerTemplate's own comment) and a PAID one is exactly the kind of
// thing this "try it before you register" flow shouldn't hand out for free to a signed-out
// visitor with no account to eventually gate it behind.
export function guestSelectableTemplates(templates: ScreenerTemplate[]): ScreenerTemplate[] {
  return templates.filter(template => template.status === 'AVAILABLE' && template.tier === 'FREE')
}

export function useGuestScreener() {
  const { runStateless } = useScreenerPresets()
  const { list: listTemplatesApi } = useScreenerTemplates()
  const { listTemplates: listColumnTemplatesApi } = useScreenerColumnPresets()

  // Session-scoped (useState resets on a real reload, not persisted to localStorage) —
  // reappearing on every fresh visit/reload is the whole basis for the registration pitch
  // ("不想每次都重新選嗎？現在就註冊，保留您自訂的篩選條件"): a signed-out visitor who never
  // registers is meant to see this dialog again next time, not have their choice silently
  // remembered for them for free — that's the exact convenience registering is meant to buy.
  const onboarded = useState('guest-screener-onboarded', () => false)
  const dialogVisible = useState('guest-screener-dialog-visible', () => false)
  const selectedTemplateId = useState<string | null>('guest-screener-template-id', () => null)
  const selectedColumnTemplateKey = useState<string | null>('guest-screener-column-template-key', () => null)

  // The two choices' own raw filters/fieldKeys, kept alongside the picked ids so a page-change
  // or sort-change follow-up request (loadMoreGuestResults/changeGuestSort below) can re-run the
  // exact same query without re-deriving it from the templates list — a guest run's filters/
  // columns never change mid-session anyway (no picker exists to edit them with).
  const lastFilters = useState<FilterCriterion[]>('guest-screener-last-filters', () => [])
  const lastFieldKeys = useState<string[]>('guest-screener-last-field-keys', () => [])

  const guestTab = useState<ScreenerTab>('guest-screener-tab', () => ({
    id: 'guest',
    name: '訪客瀏覽',
    slots: [],
    sectorCodes: [],
    columns: [],
    columnPresetId: null,
    columnViewCache: {},
    results: [],
    resultColumns: [],
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    totalPages: 1,
    sortField: null,
    sortOrder: null,
    loading: false,
    loadingMore: false,
    searched: false,
    renaming: false,
    renameDraft: ''
  }))

  // Same fetched-lazily-once pattern as useScreenerTabs.ts's own templates/columnPresetTemplates
  // — the catalog doesn't change within a session, so this only ever fetches once per mount.
  const templates = useState<ScreenerTemplate[]>('guest-screener-templates', () => [])
  const templatesLoading = ref(false)
  let hasLoadedTemplates = false

  const columnTemplates = useState<ColumnPresetTemplate[]>('guest-screener-column-templates', () => [])
  const columnTemplatesLoading = ref(false)
  let hasLoadedColumnTemplates = false

  async function loadTemplatesIfNeeded() {
    if (hasLoadedTemplates) return
    hasLoadedTemplates = true
    templatesLoading.value = true
    templates.value = await listTemplatesApi()
    templatesLoading.value = false
  }

  async function loadColumnTemplatesIfNeeded() {
    if (hasLoadedColumnTemplates) return
    hasLoadedColumnTemplates = true
    columnTemplatesLoading.value = true
    columnTemplates.value = await listColumnTemplatesApi()
    columnTemplatesLoading.value = false
  }

  function openDialog() {
    dialogVisible.value = true
    loadTemplatesIfNeeded()
    loadColumnTemplatesIfNeeded()
  }

  // page omitted (a real choice, or a sort change) resets to page 1 and replaces results;
  // append=true (load-more) keeps the accumulated rows — mirrors useScreenerTabs.ts's own
  // handleSearch split for the exact same infinite-scroll reasoning.
  async function runGuestSearch(page?: number, append = false) {
    const tab = guestTab.value
    const targetPage = page ?? 1
    if (append) tab.loadingMore = true
    else tab.loading = true
    tab.searched = true
    try {
      const result = await runStateless({
        filters: lastFilters.value,
        columns: lastFieldKeys.value,
        pagination: { page: targetPage, pageSize: tab.pageSize },
        sort: tab.sortField && tab.sortOrder ? { field: tab.sortField, order: tab.sortOrder } : undefined
      })
      if (!result) {
        if (!append) {
          tab.results = []
          tab.resultColumns = []
        }
        showErrorMessage('搜尋失敗，請稍後再試')
        return
      }
      tab.results = append ? [...tab.results, ...result.results] : result.results
      tab.resultColumns = result.columns
      tab.columns = result.columns.map(column => ({ field: column.field, label: columnLabelFrom(column.metricName, column.fieldName) }))
      tab.page = result.page
      tab.pageSize = result.pageSize
      tab.totalPages = result.totalPages
    } catch (error) {
      if (import.meta.dev) console.error('[guest-screener] search failed', error)
      showErrorMessage('搜尋失敗，請稍後再試')
    } finally {
      if (append) tab.loadingMore = false
      else tab.loading = false
    }
  }

  // Confirm button in the onboarding dialog — both choices are required (see the dialog
  // component's own disabled-until-both-picked confirm button), so templates/columnTemplates
  // are trusted here to actually contain the selected ids by the time this runs.
  async function confirmOnboarding() {
    const template = templates.value.find(item => item.id === selectedTemplateId.value)
    const columnTemplate = columnTemplates.value.find(item => item.key === selectedColumnTemplateKey.value)
    if (!template || !columnTemplate) return
    lastFilters.value = template.filters
    lastFieldKeys.value = columnTemplate.fieldKeys
    onboarded.value = true
    dialogVisible.value = false
    await runGuestSearch()
  }

  async function loadMoreGuestResults() {
    const tab = guestTab.value
    if (tab.loading || tab.loadingMore) return
    if (tab.page >= tab.totalPages) return
    await runGuestSearch(tab.page + 1, true)
  }

  async function changeGuestSort(field: string | null, order: 'asc' | 'desc' | null) {
    const tab = guestTab.value
    if (field === tab.sortField && order === tab.sortOrder) return
    tab.sortField = field
    tab.sortOrder = order
    await runGuestSearch(1)
  }

  return {
    onboarded,
    dialogVisible,
    selectedTemplateId,
    selectedColumnTemplateKey,
    templates,
    templatesLoading,
    columnTemplates,
    columnTemplatesLoading,
    guestTab,
    openDialog,
    confirmOnboarding,
    loadMoreGuestResults,
    changeGuestSort
  }
}
