import type { ScreenerTemplate } from '~/composables/screener/useScreenerTemplates'

// Owns ONLY the signed-out strategy-picker's own state now — per direct request ("普通股篩選
// 對陌生用戶還是要給完整的篩選功能" then "選完模板後可以繼續自由編輯條件") the actual tab/search
// logic moved into useScreenerTabs.ts itself (see its own buildGuestTab/addGuestTab), so guest
// editing reuses the exact same picker/range-editor/column-management machinery a signed-in tab
// already has, instead of a second parallel implementation here. This composable's only job is:
// let the visitor pick one starting filter strategy (a compliance requirement per direct
// follow-up — "要自選 篩選條件 避免觸法": the app choosing conditions FOR them would read as a
// stock recommendation), then hand the resolved filters + 總覽's own column fieldKeys back to the
// caller (screener/index.vue), which feeds them into useScreenerTabs.ts's addGuestTab.
//
// Was a dialog that opened itself on every fresh visit until 2026-09-19 (interface-complexity
// review) — a `close-on-click-modal="false"` modal springing open the instant a signed-out
// visitor landed measured as one of the four places complexity concentrated site-wide, and once
// dismissed left nothing but an empty state with no way to reopen it. The picker is now rendered
// in-page instead (ScreenerOrganismGuestStrategyPicker.vue), so `dialogVisible`/`openDialog` are
// gone — `loadTemplates` replaces `openDialog` minus the "make a dialog visible" step, called
// from the same place screener/index.vue's own watcher used to call `openDialog`.
//
// Session-scoped (useState resets on a real reload, not persisted to localStorage) —
// reappearing on every fresh visit/reload is the whole basis for the registration pitch ("不想
// 每次都重新選嗎？現在就註冊，保留您自訂的篩選條件"): a signed-out visitor who never registers is
// meant to see this picker again next time, not have their choice silently remembered for them
// for free — that's the exact convenience registering is meant to buy.
const OVERVIEW_COLUMN_TEMPLATE_KEY = 'overview'

// Only FREE, actually-runnable templates are offered here — a PENDING template has no real
// `filters` to run (see ScreenerTemplate's own comment) and a PAID one is exactly the kind of
// thing this "try it before you register" flow shouldn't hand out for free to a signed-out
// visitor with no account to eventually gate it behind.
export function guestSelectableTemplates(templates: ScreenerTemplate[]): ScreenerTemplate[] {
  return templates.filter(template => template.status === 'AVAILABLE' && template.tier === 'FREE')
}

export function useGuestScreener() {
  const { list: listTemplatesApi } = useScreenerTemplates()
  const { listTemplates: listColumnTemplatesApi } = useScreenerColumnPresets()

  const onboarded = useState('guest-screener-onboarded', () => false)
  const selectedTemplateId = useState<string | null>('guest-screener-template-id', () => null)

  const templates = useState<ScreenerTemplate[]>('guest-screener-templates', () => [])
  const templatesLoading = ref(false)
  let hasLoadedTemplates = false

  // Not user-facing — resolved purely so confirmOnboarding has 總覽's own fieldKeys ready by the
  // time the visitor actually picks a strategy and hits 確定.
  let overviewFieldKeysPromise: Promise<string[]> | null = null
  function resolveOverviewFieldKeys(): Promise<string[]> {
    overviewFieldKeysPromise ??= listColumnTemplatesApi().then(
      list => list.find(item => item.key === OVERVIEW_COLUMN_TEMPLATE_KEY)?.fieldKeys ?? []
    )
    return overviewFieldKeysPromise
  }

  async function loadTemplatesIfNeeded() {
    if (hasLoadedTemplates) return
    hasLoadedTemplates = true
    templatesLoading.value = true
    templates.value = await listTemplatesApi()
    templatesLoading.value = false
  }

  function loadTemplates() {
    loadTemplatesIfNeeded()
    // Kicked off in parallel with the templates fetch above (not awaited here) so 總覽's field
    // keys are usually already resolved by the time the visitor hits 套用這組條件.
    resolveOverviewFieldKeys()
  }

  // Returns null if the picker's own selection isn't actually resolvable (shouldn't happen —
  // the confirm button is disabled until a template is picked) rather than ever handing the
  // caller a half-formed selection.
  async function resolveSelection(): Promise<{ filters: ScreenerTemplate['filters']; fieldKeys: string[] } | null> {
    const template = templates.value.find(item => item.id === selectedTemplateId.value)
    if (!template) return null
    const fieldKeys = await resolveOverviewFieldKeys()
    onboarded.value = true
    return { filters: template.filters, fieldKeys }
  }

  // Deep link from a /screener/{slug} condition page's「套用至篩選器」(2026-09-19, the SEO build):
  // the visitor already picked a strategy on that page, so the in-page picker is skipped and
  // the same resolveSelection() path runs with the template found by name（the slug table is
  // shared/utils/hub-slugs.ts）. Null when the slug names no runnable FREE template — the caller
  // then falls back to showing the picker as on any other visit.
  async function resolveTemplateBySlug(slug: string): Promise<{ filters: ScreenerTemplate['filters']; fieldKeys: string[] } | null> {
    const name = screenerTemplateNameBySlug(slug)
    if (!name) return null
    await loadTemplatesIfNeeded()
    const template = guestSelectableTemplates(templates.value).find(item => item.name === name)
    if (!template) return null
    selectedTemplateId.value = template.id
    return resolveSelection()
  }

  return {
    onboarded,
    selectedTemplateId,
    templates,
    templatesLoading,
    loadTemplates,
    resolveSelection,
    resolveTemplateBySlug
  }
}
