<script setup lang="ts">
import type { ScreenerWorkspace } from '~/composables/screener/screener-tab-model'
import type { ScreenerUniverse } from '~/utils/screener-zone'
import type { PresetChanges } from '~/utils/preset-changes'
// 三組篩選（普通股、特別股、ETF）共用的整頁（2026-10-15 三組篩選重新設計）。使用者：「三組最後使用UIUX要接近，降低用戶負擔」。
// 每一個控制項都只在這裡接一次，三頁只給「資料」（screener：useScreenerTabs 或 useUniverseScreener 包成的 ScreenerWorkspace）
// 與自己的標題、說明——改一個控制項三組一起改，不會有哪一頁漏接（同個股頁的 StockPageShell）。
//
// 順序：標題 → 側欄導覽 → 一句說明 → 設定區（我的篩選＋條件）→ 結果區（標題、符合幾檔、顯示欄位、結果表）。
//
// 版面：整頁自然往下捲，**不鎖在一個螢幕高**。原本三頁各自用 height: calc(100vh - …) 把整頁鎖住，上面的分頁與條件吃掉高度後，
// 結果表只剩小小的內捲框（2026-10-15 在 1440×800 量到 ETF 273px、特別股 317px）。結果表也不自己上下捲：跟著整頁捲，表頭黏在頁首
// 下面、橫向捲軸黏在畫面底部（SharedMetricTable 的 sticky；使用者要捲軸在第一個畫面、用滑鼠拖得到）。手機是卡片、跟著頁面捲。
// 上方盡量少佔高度（使用者：「就是擔心上面的篩選太高，佔用了下面的結果表格」）：顯示欄位與欄位設定同一列。
// 設定區 2026-10-19 重新設計（使用者：「我選了四個條件，screener-shell__setup 排版看起來就亂亂的」，選了「等寬兩欄」）：原本寬的時候
// 我的篩選與條件左右並排，條件一多就在右邊那塊各自長短地往下疊、左下空一大塊。現在我的篩選固定在上面一列，條件在下面排成
// 一樣寬的兩欄（ScreenerFilters），四個條件兩列就放完。2026-10-22 使用者選方案 B（手機與電腦一起）：條件不再各自一個框，
// 排成一張清單；手機上「我的篩選」併成一行（5 個條件時設定區從 721px 降下來）。
const props = defineProps<{
  // 標題、主詞都從 SCREENER_ZONE_ITEMS 讀（側欄也讀它），名稱不會分家
  universe: ScreenerUniverse
  screener: ScreenerWorkspace
  // 頁面還在決定要開哪一組（普通股的 ?template 解析中）：維持骨架，不先畫 #no-tab 再整塊換掉（2026-10-16，手機 CLS 0.112）
  pending?: boolean
}>()

const zone = computed(() => SCREENER_ZONE_ITEMS.find(item => item.key === props.universe)!)
const uid = useId()
const hasHydrated = useHasHydrated()
const tab = computed(() => props.screener.activeTab)
const hasConditions = computed(() => !!tab.value?.slots.some(slot => slot.fieldId !== null))

// 「全部」還是「符合上述條件」看的是這個數字查到的時候有沒有條件，不是現在：改條件到自動查詢之間的 0.6 秒，數字還是上一次的，
// 跟著現在的條件換字首會讓 live region 先念一個錯的數字（2026-10-15 量到「符合上述條件 339 檔」接著才「322 檔」）
const countedWithConditions = ref(false)
watch(() => [tab.value?.id, tab.value?.loading] as const, () => {
  if (tab.value && !tab.value.loading) countedWithConditions.value = hasConditions.value
}, { immediate: true })

// 「符合上述條件 N 檔」：條件一變就念出來；還沒查過、查詢中不念數字。個位數時加一句中性提醒（知識庫「分層篩選的樣本衰減」）。
// 分三段：手機上字首（符合上述條件／全部）不畫、照樣念（2026-10-22 操作區方案 A），檔數短了，同一行右邊的開關才不會被推走
const countParts = computed(() => {
  const current = tab.value
  if (!current?.searched) return null
  if (current.loading) return { prefix: '', main: '搜尋中…', note: '' }
  const main = `${groupThousands(current.total)} 檔`
  if (!countedWithConditions.value) return { prefix: '全部 ', main, note: '' }
  return { prefix: '符合上述條件 ', main, note: current.total > 0 && current.total < 10 ? '檔數少，條件稍微變動結果就可能不同' : '' }
})

const empty = computed(() => !!tab.value?.searched && !tab.value.loading && tab.value.total === 0 && hasConditions.value)
const conditionCount = computed(() => tab.value?.slots.filter(slot => slot.fieldId !== null).length ?? 0)
const lastSlotId = computed(() => tab.value?.slots.at(-1)?.id ?? null)

// 新增條件按「完成」之後焦點落在新膠囊的值上，不是回到「新增條件」：鍵盤使用者接著要改值或移除，不必再找一次。
// 等面板的 closed（關閉動畫結束）才移：Element Plus 的對話框在那之前會把焦點還給打開它的按鈕
const setupRef = ref<HTMLElement>()
let slotCountAtOpen = 0
watch(() => props.screener.listVisible || props.screener.pickerVisible || props.screener.rangeEditorVisible, (open, wasOpen) => {
  if (open && !wasOpen) slotCountAtOpen = tab.value?.slots.length ?? 0
})
function focusNewCondition() {
  const slots = tab.value?.slots ?? []
  if (slots.length <= slotCountAtOpen) return
  setupRef.value?.querySelector<HTMLElement>(`[data-slot-id="${slots.at(-1)!.id}"] .condition-pill__value`)?.focus()
}

// 管理彈窗按「儲存」之後的套用（我的篩選、顯示欄位各一個）：一項做完再做下一項。改名 → 複製 → 刪除 → 排序：複製要在刪除前
// （原本那一組可能也要刪），刪除要先做完才排序——業務中台 的排序要「全部已存的 id」，還沒刪掉的那一組不能少；刪到目前這一組時，
// 換選哪一組由各自的 remove 決定。排序裡副本的暫時 id 換成建好的 id，沒建成的拿掉
interface GroupOps {
  rename(id: string, name: string): Promise<void> | void
  remove(id: string): Promise<void> | void
  reorder(ids: string[]): Promise<void> | void
  copy(id: string, name: string): Promise<string | null>
}
async function applyChanges({ renames, copies, removals, order }: PresetChanges, ops: GroupOps) {
  for (const [id, name] of renames) await ops.rename(id, name)
  const created = new Map<string, string | null>()
  for (const { id, from, name } of copies) created.set(id, await ops.copy(from, name))
  for (const id of removals) await ops.remove(id)
  if (order) await ops.reorder(order.flatMap(id => (created.has(id) ? created.get(id) ?? [] : [id])))
}
const applyPresetChanges = (changes: PresetChanges) => applyChanges(changes, {
  rename: props.screener.renamePreset,
  remove: props.screener.removePreset,
  reorder: props.screener.reorderTabs,
  copy: props.screener.copyPreset
})
// 欄位組合的管理跟欄位設定分開（2026-11-01，使用者：「希望管理 欄位設定 分開」）：「顯示欄位」自己的「管理」，同「我的篩選」
const applyColumnSetChanges = (changes: PresetChanges) => applyChanges(changes, {
  rename: props.screener.renameColumnSet,
  remove: props.screener.removeColumnSet,
  reorder: props.screener.reorderColumnSets,
  copy: props.screener.copyColumnSet
})

function openRow(symbol: string) {
  navigateTo(props.screener.rowLink(symbol))
}

function toElOrder(order: 'asc' | 'desc' | null): 'ascending' | 'descending' | null {
  return order === 'asc' ? 'ascending' : order === 'desc' ? 'descending' : null
}

function fromElOrder(order: 'ascending' | 'descending' | null): 'asc' | 'desc' | null {
  return order === 'ascending' ? 'asc' : order === 'descending' ? 'desc' : null
}
</script>

<template>
  <div class="app-page app-page--compact screener-shell">
    <h1 class="app-page__title app-page__title--app screener-shell__title">
      {{ zone.label }}
      <slot name="title-extra" />
    </h1>
    <!-- 標題下面的說明文字 2026-10-22 拿掉（使用者：「screener-shell__intro 文字說明拿掉」） -->
    <ScreenerNav />

    <!-- hasHydrated 也要等：登入狀態在伺服器與瀏覽器第一次渲染時一定是「還不知道」，兩邊才畫得一樣（見 useHasHydrated） -->
    <template v-if="hasHydrated && screener.ready && !pending">
      <template v-if="tab">
        <section ref="setupRef" class="screener-shell__setup" :aria-labelledby="`${uid}-setup`">
          <h2 :id="`${uid}-setup`" class="visually-hidden">篩選條件</h2>
          <ScreenerPresetSelect
            label="我的篩選"
            compact-label="篩選"
            add-label="新增篩選"
            save-label="存成我的篩選"
            :items="screener.presetItems"
            :active-id="screener.activeTabId"
            @update:active-id="screener.selectTab"
            @add="screener.openNewTabDialog()"
            @manage="applyPresetChanges"
            @save="screener.saveActiveTab()"
          />
          <!-- 手機：條件收進面板（方案 B），頁面上只有這一顆；電腦版條件照舊攤開。兩份都在 DOM 裡、CSS 切換 -->
          <el-button class="screener-shell__conditions-open" aria-haspopup="dialog" @click="screener.openConditionList(tab!)">
            <span>篩選條件 {{ conditionCount }} 個</span><span class="screener-shell__chevron" aria-hidden="true" />
          </el-button>
          <ScreenerFilters
            class="screener-shell__conditions-inline"
            :slots="tab.slots"
            :categories="screener.categories"
            @add-condition="screener.openFieldPicker(tab!, null)"
            @change-slot-field="slotId => screener.openFieldPicker(tab!, slotId)"
            @open-value-editor="slotId => screener.openRangeEditor(tab!, slotId)"
            @remove-slot="slotId => screener.removeSlot(tab!, slotId)"
          />
        </section>

        <section class="screener-shell__results" :aria-labelledby="`${uid}-results`">
          <!-- 全站表格的卡片（SharedTable custom）：標題、顯示欄位與表格在同一張卡片上；手機（卡片版面）拿掉，見 CSS -->
          <SharedTable custom class="screener-shell__results-card">
          <div class="screener-shell__results-header">
            <h2 :id="`${uid}-results`" class="app-page__h2 screener-shell__results-title">篩選結果</h2>
            <!-- 提醒在 live region 裡照樣念，畫面上是後面那個 aria-hidden 的：擠在檔數那一格裡，手機會折成三到五行（2026-11-01），
                 窄的時候它自己一行、寬的時候接在檔數後面 -->
            <p class="screener-shell__count" role="status"><template v-if="countParts"><span class="screener-shell__count-prefix">{{ countParts.prefix }}</span>{{ countParts.main }}<span v-if="countParts.note" class="visually-hidden">；{{ countParts.note }}</span></template></p>
            <p v-if="countParts?.note" class="screener-shell__count-note" aria-hidden="true">{{ countParts.note }}</p>
            <p v-if="screener.dataDate" class="screener-shell__date">資料日期 {{ screener.dataDate }}</p>
            <div v-if="$slots['result-meta']" class="screener-shell__result-meta">
              <slot name="result-meta" />
            </div>
          </div>
          <!-- 沒有結果：說清楚是條件太嚴，給一個馬上能做的動作（三組同一段）。這時「顯示欄位」跟著表格一起收起來（沒有資料就沒有欄位可選）。
               下面結果表的名稱欄跟著資料寬（SharedMetricTable 量最長的名稱） -->
          <div v-if="empty" class="screener-shell__empty">
            <p class="screener-shell__empty-text">沒有符合上述條件的{{ zone.subject }}。可以放寬或移除條件。</p>
            <el-button v-if="lastSlotId !== null" class="screener-shell__empty-button" @click="screener.removeSlot(tab!, lastSlotId)">移除最後一個條件</el-button>
          </div>
          <SharedMetricTable
            v-else
            :loading="tab.loading"
            :rows="tab.results"
            :columns="tab.columns"
            :has-more="tab.page < tab.totalPages"
            :loading-more="tab.loadingMore"
            :sort-field="tab.sortField"
            :sort-order="toElOrder(tab.sortOrder)"
            :sort-mode="screener.sortMode"
            :categories="screener.categories"
            :show-period="screener.periodToggle ? undefined : true"
            :cell-dates="screener.periodToggle ? undefined : false"
            :row-link="screener.rowLink"
            :cell-link="screener.cellLink"
            :total="tab.total"
            sticky
            @reorder="fields => screener.handleReorderColumns(tab!, fields)"
            @remove-column="field => screener.handleRemoveColumn(tab!, field)"
            @save-columns="columns => screener.applyColumnChoices(tab!, columns)"
            @row-click="openRow"
            @load-more="screener.loadMoreResults(tab!)"
            @sort-change="(field, order) => screener.changeSort(tab!, field, fromElOrder(order))"
          >
            <!-- 放進表格的工具列：跟「欄位設定」同一列 -->
            <template #toolbar>
              <ScreenerPresetSelect
                compact-label="欄位"
                label="顯示欄位"
                add-label="新增欄位組合"
                save-label="存成我的欄位組合"
                :items="screener.columnSetItems"
                :active-id="screener.activeColumnSetId"
                @update:active-id="screener.selectColumnSet"
                @add="screener.openNewColumnPresetDialog(tab!)"
                @manage="applyColumnSetChanges"
                @save="screener.saveColumnSet()"
              />
            </template>
          </SharedMetricTable>
          </SharedTable>
        </section>
      </template>
      <!-- 還沒有任何一組可以顯示（普通股的訪客要先選一組範本） -->
      <slot v-else name="no-tab" />
    </template>

    <div v-else class="screener-shell__skeleton">
      <el-skeleton :rows="2" animated />
      <el-skeleton :rows="6" animated />
    </div>

    <!-- 新增／修改條件與新增欄位共用的面板：手機貼底、桌機置中（ScreenerConditionPanel） -->
    <ScreenerConditionPanel
      :list-visible="screener.listVisible"
      :picker-visible="screener.pickerVisible"
      :range-visible="screener.rangeEditorVisible"
      :slot="screener.rangeEditorSlot"
      :categories="screener.categories"
      :current-field-id="screener.pickerCurrentFieldId"
      @select="screener.handleSelect"
      @back="screener.backToPicker()"
      @done="screener.finishStep()"
      @close="screener.closePanel()"
      @closed="focusNewCondition"
      @change-period="screener.changeRangeEditorPeriod"
    >
      <template v-if="tab" #list>
        <ScreenerFilters
          :slots="tab.slots"
          :categories="screener.categories"
          @add-condition="screener.openFieldPicker(tab!, null)"
          @change-slot-field="slotId => screener.openFieldPicker(tab!, slotId)"
          @open-value-editor="slotId => screener.openRangeEditor(tab!, slotId)"
          @remove-slot="slotId => screener.removeSlot(tab!, slotId)"
        />
      </template>
    </ScreenerConditionPanel>

    <ScreenerNewPresetDialog
      v-model="screener.newTabDialogVisible"
      :templates="screener.templates"
      :templates-loading="screener.templatesLoading"
      @custom="screener.addTab()"
      @copy="screener.copyActiveTab()"
      @template="screener.addTemplateTab"
    />

    <ScreenerNewColumnPresetDialog
      v-model="screener.newColumnPresetDialogVisible"
      :templates="screener.columnPresetTemplates"
      :templates-loading="screener.columnPresetTemplatesLoading"
      @custom="screener.confirmCustomColumnPreset()"
      @template="screener.applyColumnPresetTemplate"
    />

    <slot />
  </div>
</template>

<style scoped>
.screener-shell {
  /* container：結果區要不要包成卡片看這一頁的寬度（見下面 .screener-shell__results） */
  container-type: inline-size;
  display: flex;
  flex-direction: column;
  gap: 16px;
  /* 至少一個畫面高（2026-10-16，頁尾被結果推下去）2026-10-18 搬到 layouts/default.vue 的 .app-shell__content，所有頁一起 */
}

.screener-shell__title {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* 設定區：我的篩選一列、條件清單在下面（2026-10-19；清單 2026-10-22 方案 B）。同日拆掉外面的卡片（使用者：「篩選條件 卡片我想拆掉
   看看效果」）：直接排在頁面上，跟結果區一樣沒有框。container：窄於 720px 時「我的篩選」併成一行（ScreenerPresetSelect 的
   compactLabel，同結果區）。不會困住裡面的對話框：container-type 不帶 layout containment，「管理」的遮罩照樣蓋滿畫面 */
/* 手機 8px：「篩選條件 N 個」跟結果區的「欄位 N 個」同一個間距（2026-11-02，對齊方案 B「使用手感一樣」）；寬的時候 12px，隔開我的篩選和攤開的條件 */
.screener-shell__setup {
  container-type: inline-size;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.screener-shell__results {
  min-width: 0;
}

/* 手機（設定區窄於 722px，同結果區換成卡片的門檻）：條件收進面板，只畫「篩選條件 N 個」；寬的時候條件攤開、這顆藏起來 */
.screener-shell__conditions-inline {
  display: none;
}

.screener-shell__conditions-open {
  justify-content: space-between;
  width: 100%;
  min-height: 44px;
  margin: 0;
}

.screener-shell__conditions-open :deep(> span) {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: space-between;
}

.screener-shell__chevron {
  width: 8px;
  height: 8px;
  border-right: 2px solid currentcolor;
  border-bottom: 2px solid currentcolor;
  transform: rotate(-45deg);
}

@container (min-width: 722px) {
  .screener-shell__setup {
    gap: 12px;
  }

  .screener-shell__conditions-inline {
    display: block;
  }

  .screener-shell__conditions-open {
    display: none;
  }
}

.screener-shell__results-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* 電腦版的結果放在一張卡片上（2026-10-23，使用者在配色方案頁選 A；同日抽成全站表格 SharedTable）：設定區留在頁面底色上，結果（標題、
   顯示欄位、表格）一張卡片，一眼分出「篩什麼」跟「結果」、視線落在下半部。只在表格版面：手機的結果本來就是一張張卡片，外面再包一張就是
   卡片包卡片，所以窄的時候拿掉。門檻 722＝表格換成卡片的 720（SharedMetricTable）加左右框線 2px。卡片的 overflow: clip（SharedTable）
   不是 hidden：hidden 會變成捲動容器，表頭與橫向捲軸就黏在卡片裡、不黏在畫面上 */
@container (max-width: 721px) {
  .screener-shell__results-card {
    border: 0;
    border-radius: 0;
    background: none;
  }
}

@container (min-width: 722px) {
  .screener-shell__results-card {
    padding-top: 16px;
  }

  .screener-shell__results-header,
  .screener-shell__results :deep(.smt-toolbar) {
    padding-inline: 16px;
  }

  .screener-shell__results-card > .screener-shell__empty {
    margin: 0 16px 16px;
  }
}

.screener-shell__results-header {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 16px;
}

.screener-shell__results-title {
  margin: 0;
}

/* 標題列右邊的控制項（普通股的期別切換）不能跟著檔數文字移動（2026-10-16）：原本排在檔數後面，檔數從「搜尋中…」變成「符合上述條件
   933 檔」，412 寬就把它擠到第二行，結果區往下 30px（手機 CLS 0.066）。窄的時候一開始就自己一行；560px 起靠右，檔數變長也推不動。
   外層是 flex，裡面的 label 才維持原寬（不會整行都點得到） */
.screener-shell__result-meta {
  display: flex;
  flex-basis: 100%;
}

@media (min-width: 560px) {
  .screener-shell__result-meta {
    flex-basis: auto;
    margin-left: auto;
  }
}

/* 標題、檔數、資料日期、開關都不折行（2026-11-01，使用者：「讓文字不要折行佔高度」）；個位數的提醒自己一行、排在最後 */
.screener-shell__results-title,
.screener-shell__count,
.screener-shell__date,
.screener-shell__result-meta {
  white-space: nowrap;
}

.screener-shell__count-note {
  flex-basis: 100%;
  order: 1;
  margin: 0;
  color: var(--el-text-color-regular);
}

/* 頁面夠寬（標題＋檔數＋提醒＋開關約 730px）就接回檔數後面，不多佔一行 */
@container (min-width: 900px) {
  .screener-shell__count-note {
    flex-basis: auto;
    order: 0;
    margin-left: -16px;
    white-space: nowrap;
  }

  .screener-shell__count-note::before {
    content: '；';
  }
}

/* 手機（操作區方案 A，2026-10-22）：標題、檔數、右邊的開關同一行。檔數只畫「528 檔」（字首照樣念）、吃剩下的寬度，太窄就省略號——
   推不動開關，上面那條 2026-10-16 的位移不會回來 */
@media (max-width: 559px) {
  .screener-shell__count {
    flex: 1 1 0;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .screener-shell__count-prefix {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  .screener-shell__result-meta {
    flex: none;
    margin-left: auto;
  }
}

.screener-shell__count,
.screener-shell__date {
  margin: 0;
  font-size: 1rem;
  color: var(--el-text-color-regular);
  font-variant-numeric: tabular-nums;
}

.screener-shell__date {
  color: var(--el-text-color-secondary);
}

.screener-shell__empty {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
  padding: 24px 16px;
  border: 1px dashed var(--el-border-color);
  border-radius: 12px;
}

.screener-shell__empty-text {
  margin: 0;
  font-size: 1rem;
  line-height: 1.6;
}

.screener-shell__empty-button {
  font-size: 1rem;
}

.screener-shell__skeleton {
  display: flex;
  flex-direction: column;
  gap: 24px;
}
</style>
