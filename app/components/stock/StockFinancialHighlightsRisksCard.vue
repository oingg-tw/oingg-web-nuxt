<script setup lang="ts">
import { Trophy, TrophyBase, WarnTriangleFilled } from '@element-plus/icons-vue'
import { buildGuruBadges, guruBadgeMetricCode, GURU_BADGE_CATEGORIES, GURU_BADGE_DISCLAIMER } from '~/utils/guru-badges'
import type { GuruBadge } from '~/utils/guru-badges'
import type { StockBadgeEntry } from '~/composables/stock/useStockBadges'
import { locateFieldInSchema } from '~/composables/screener/useFilterSchema'
import { formatSignificantDigits } from '~/utils/format-significant-digits'
import { nullReasonShortText } from '~/utils/metric-null-reason'

// 財報亮點／財報風險（2026-09-19「個股瀏覽 stock/2330 放財報亮點跟財報風險」），2026-09-20 從三張 el-card 改成一張
// data-ssr-table、三組列群（文件優先：問句→答句→一張表，不是卡片格）。判定整個沿用徽章系統：財報亮點＝GET /stocks/:symbol/badges
// 標 passed: true 的徽章（跨 8 個分類攤平）；passed: null 不在三組裡（「不知道」既不是亮點也不是風險）。未達成拆成兩組（2026-09-19
// 使用者更正「沒達成的就說是風險也太粗暴了，至少要分三塊」）：只有安全韌性分類（Altman Z／Ohlson O／Zmijewski 等財務困境模型）
// 未達成才叫財報風險，其餘未達成是中性（2026-09-20 從「未達成指標」改名）——葛拉漢倍數沒過只代表不是那位價值投資者定義的便宜股。
// 只渲染這家公司真的有 entryFor() 的徽章（2026-09-15 Basel III 幽靈 chip 的 bug：buildGuruBadges 回的是全域型錄）。
// 每列的入口：有專頁（BADGE_PAGES）就 NuxtLink，否則開 StockGuruBadgeDialog（2026-09-19「chip 點開彈窗」）；「看說明 →」的文字
// 讓鍵盤與朗讀器使用者分得出哪一列是導頁、哪一列是開對話框。
const props = defineProps<{
  symbol: string
}>()

const symbolRef = computed(() => props.symbol)

const { data: filterSchema } = await useFilterSchema()
const { data: stockBadges, pending } = useStockBadges(symbolRef)

const allBadges = computed<GuruBadge[]>(() => buildGuruBadges(filterSchema.value?.categories ?? []))

function entryFor(badge: GuruBadge): StockBadgeEntry | null {
  return findStockBadgeEntry(stockBadges.value, guruBadgeMetricCode(badge))
}

// null = insufficient data — never coerced to true/false.
function isMet(badge: GuruBadge): boolean | null {
  return entryFor(badge)?.passed ?? null
}

const realBadges = computed<GuruBadge[]>(() => {
  if (pending.value || !stockBadges.value) return []
  return allBadges.value.filter(badge => entryFor(badge) !== null)
})

// 安全韌性 category ONLY（renamed from 財務韌性 2026-09-21）— see this file's own top comment for
// why unmet badges outside this category aren't labeled "風險". The literal is safe to write here
// because it is this app's OWN display taxonomy（financial-analysis-dimensions.ts）, reached from
// analysis-ts's stable category key via guru-badges.ts, not from any backend display string.
const RISK_CATEGORY: GuruBadge['category'] = '安全韌性'

// All three derive from markFor(), the one place the met/neutral/risk rule lives — these feed the
// summary cards and the per-category header counts, the rows feed their icon shapes, and the
// three must never disagree. They used to inline the rule themselves, which would have silently
// split from markFor() the moment the backend `warning` tier was added to it.
// Undetermined badges (isMet === null) fall into none of the three, as before.
const highlights = computed(() => realBadges.value.filter(badge => isMet(badge) !== null && markFor(badge) === 'met'))
const risks = computed(() => realBadges.value.filter(badge => isMet(badge) !== null && markFor(badge) === 'risk'))
const unmetOther = computed(() => realBadges.value.filter(badge => isMet(badge) !== null && markFor(badge) === 'neutral'))

// 目前數值與門檻是兩欄（2026-09-20）：不照要求寫成一格「Altman Z-Score 15.5 > 2.99」——未達成的徽章會印出一句假話
//（2330 的葛拉漢倍數「265.7 < 22.5」）。一欄一個屬性，每格自己為真。piotroskiFScore 是唯一分母 9 的徽章（0–9 清單總分），
// 印成「7／9」對「≥ 8」；其餘分母 1，印值加型錄單位。
function currentValueText(badge: GuruBadge): string {
  const entry = entryFor(badge)
  const value = entry?.value ?? null
  // Three-way, via the shared helper: 不適用 / 無法計算 / 尚無資料. It was a two-way split until
  // 2026-09-22, which reported「尚無資料」for every null that wasn't an industry exclusion — see
  // nullReasonShortText's own comment for what that was hiding. Only reachable defensively here:
  // the three groups are built from passed === true/false, and a null value with a non-null
  // `passed` shouldn't occur.
  if (value === null) return nullReasonShortText(entry?.nullReason)
  // 這兩支的 `value` 是門檻那一邊，被判斷的那一邊在 COMPARE_AGAINST 裡（見那段註解）。
  const against = COMPARE_AGAINST[badge.fieldId.split('.')[0]!]
  if (against) {
    // 比較對象與徽章值同單位（市值與 NCAV 都是元、CAGR 與 SGR 都是 %），所以借徽章自己的 fieldId 取單位。
    const compared = entry?.thresholdValue
    if (compared != null) return `${against.label} ${fieldText(badge.fieldId, compared)}`
  }
  if (badge.threshold.denominator > 1) return `${Math.round(value)}／${badge.threshold.denominator}`
  const unit = locateFieldInSchema(filterSchema.value?.categories ?? [], badge.fieldId)?.metric.unit
  const raw = unit && unit !== '無單位' ? `${formatSignificantDigits(value, 3)}${unit}` : formatSignificantDigits(value, 3)
  // A percentileRank badge's threshold is「前 20%」— a position, not a value — so a raw「6.07%」in
  // this column sits beside it in a different unit and cannot be compared（2026-09-22,「我怎麼知道
  // 6.07 是 pr多少」）. The payload already carries where the company sits: `percentile` is the
  // share of the market it beats in the badge's own direction（verified: sue pct 99.4 ↔ rank
  // 10/1446; beta pct 10.3 ↔ rank 916/1020）, so 前 N% is 100 − percentile and lands in exactly
  // the unit the 門檻 column speaks. Both are shown: the raw figure is what the metric IS, the
  // position is what the badge JUDGES.
  const percentile = entry?.percentile
  if (badge.threshold.isPercentileRank && percentile != null) return `${raw}（前 ${(100 - percentile).toFixed(1)}%）`
  return raw
}

// 門檻欄：絕對門檻的 description 本身就是比較式（「≥ 40%」）；percentileRank 徽章是位置（「前 20%」），2026-09-22 起 entry 也帶那個
// 位置對應的指標值 thresholdValue，印成「前 20%（≥ 10.42%）」，兩欄才同單位。比較子跟徽章方向：desc 要 ≥ 界線、asc 相反；判定仍讀
// passed，這裡只畫線。`!= null` 不用 truthiness：shareholderYield 的界線是真的 0。
// 「跟另一個數量比」的徽章（2026-09-28「Higgins 永續成長率警訊我看不出來哪個是實際成長率哪個是 SGR」）：型錄帶 compareAgainstFieldId
// 的兩支（查過 158 支沒有第三支），形狀相反——value 是門檻那一邊（SGR／NCAV 本身），被判斷的那一邊在 thresholdValue，所以兩欄要各自
// 標名字。thresholdValue 一度是 null、前端自己抓比較對象，analysis-ts 同日補上（填的是 passed 判斷當下的值，期別一致），那段刪了。
const COMPARE_AGAINST: Record<string, { quantity: string; label: string }> = {
  sgr: { quantity: 'SGR', label: '實際成長率(3年)' },
  ncav: { quantity: 'NCAV', label: '市值' }
}

function fieldText(fieldId: string, value: number): string {
  const unit = locateFieldInSchema(filterSchema.value?.categories ?? [], fieldId)?.metric.unit
  return unit && unit !== '無單位' ? `${formatSignificantDigits(value, 3)}${unit}` : formatSignificantDigits(value, 3)
}

function thresholdText(badge: GuruBadge): string {
  const description = badge.threshold.description
  const against = COMPARE_AGAINST[badge.fieldId.split('.')[0]!]
  if (against) {
    const value = entryFor(badge)?.value
    if (value == null) return description
    const text = fieldText(badge.fieldId, value)
    // 數字接在名字後面，不是整句後面加括號：「實際成長率(3年) > SGR 18.1%」讀得出 18.1% 是 SGR，
    // 「…> SGR（18.1%）」則讀不出來（兩欄同號的時候尤其讀不出來）。兩個門檻描述的結尾剛好都是那個
    // 具名數量，所以直接接；萬一上游改了描述、結尾不再是它，退回括號，不會拼出一句錯的話。
    return description.endsWith(against.quantity) ? `${description} ${text}` : `${description}（${against.quantity} ${text}）`
  }
  if (!badge.threshold.isPercentileRank) return description
  const entry = entryFor(badge)
  const boundary = entry?.thresholdValue
  if (boundary == null) return description
  const unit = locateFieldInSchema(filterSchema.value?.categories ?? [], badge.fieldId)?.metric.unit
  const boundaryText = unit && unit !== '無單位' ? `${formatSignificantDigits(boundary, 3)}${unit}` : formatSignificantDigits(boundary, 3)
  const comparator = badge.threshold.percentileDirection === 'asc' ? '≤' : '≥'
  return `${description}（${comparator} ${boundaryText}）`
}

// 無法判定：有 entry 但 passed 是 null，不是裁決，排除在主表與三個狀態之外，另開一張表（2026-09-20「無法判定的徽章單獨一個表格」）。
// 數量因公司差很多（2330 零、1101 5、2891 銀行 14），空的時候整段不畫。
const undetermined = computed(() => realBadges.value.filter(badge => isMet(badge) === null))

// 後端的 nullReason 代碼寫成讀者看得懂的短句（NULL_REASON_SHORT_LABELS）：「不適用於此產業」跟「歷史資料期數不足」是不同的事實，
// 正是看這張表的人要分的東西

function nullReasonText(badge: GuruBadge): string {
  const reason = entryFor(badge)?.nullReason
  return (reason && NULL_REASON_SHORT_LABELS[reason]) || '尚無資料'
}

const hasAnyData = computed(() => !pending.value && (highlights.value.length > 0 || risks.value.length > 0 || unmetOther.value.length > 0 || undetermined.value.length > 0))

// Entry-point links for the badge-page family (2026-09-20, "希望入口是好好被設計的而不是只是個
// 超連結") — see this file's own top comment.
function badgePageFor(badge: GuruBadge) {
  return findBadgePageByMetric(badge.id)
}

// One of the three icon shapes, per BADGE (filled medal / hollow ring / filled triangle). Shape,
// not colour, is what distinguishes them — a colour-only split fails for colour-blind readers.
//
// This moved from group level to ROW level on 2026-09-20 when the table's grouping axis became
// category: a category group mixes met and unmet badges, so a single shape per group would have
// been wrong for most rows. The rule itself is unchanged — it's the same three-way split the
// `highlights` / `unmetOther` / `risks` computeds above make, just evaluated one badge at a time.
function markFor(badge: GuruBadge): 'met' | 'neutral' | 'risk' {
  if (isMet(badge) === true) return 'met'
  // An explicit backend `warning` outranks the category rule (2026-09-20). Reported live:
  // 5314's F-Score is 2 — the bottom band of a 0–9 scale — yet it was landing in 中性, because
  // the category rule only ever called 安全韌性 badges a risk and piotroskiFScore's category is
  // 獲利品質. The backend now says outright which readings are warnings (analysis-ts commit
  // 9d7a8141: 0–2 → warning), so where it does, that answer wins; the category rule stays as the
  // fallback for the 22 badges that carry no warning tier.
  if (entryFor(badge)?.warning === true) return 'risk'
  return badge.category === RISK_CATEGORY ? 'risk' : 'neutral'
}

interface BadgeGroup {
  key: string
  title: string
  badges: GuruBadge[]
  // 亮點／中性／風險 counts WITHIN this category, shown in the group header as「（1/3/0）」
  // (2026-09-20, direct request「要用分數…才知道亮點中性風險的分布」). Always three numbers in
  // that fixed order, zeros included — a bare「1/3」that silently dropped an empty bucket would
  // change what the reader has to infer from position. The order is the same one the summary
  // cards use directly above, which is what makes the bare digits legible: those cards are the
  // legend. Screen readers get the spelled-out version instead, see the template.
  met: number
  neutral: number
  risk: number
}

// The summary cards' own list — the STATUS axis (亮點／中性／風險 counts), kept separate from the
// table's `groups` since 2026-09-20, when the table's axis became category. Before that both read
// one list; if the cards had been left pointing at `groups` they'd silently have turned into
// per-category counts, losing the "多少有達成多少沒達成" answer they exist to give.
const statusSummary = computed<{ key: string; title: string; mark: 'met' | 'neutral' | 'risk'; count: number }[]>(() => [
  { key: 'highlights', title: '亮點', mark: 'met', count: highlights.value.length },
  { key: 'neutral', title: '中性', mark: 'neutral', count: unmetOther.value.length },
  { key: 'risks', title: '風險', mark: 'risk', count: risks.value.length }
])

// 依分類分列群（2026-09-20「不再單純區分亮點中性風險，而是各自的類別」）。要求是一個分類一張表，先量再做、被數字否決：20 檔樣本
// 每表平均 2.2 列、38% 只有一列，表數還因公司而異（2330 6 張、1101 5 張）——一列的表不是表格資料，是 f-score 那個反模式乘七。
// 列群給同樣的分類組織：仍是一張約 18 列的真表、不加新標題（不跟資料摘要的分類 h3 撞）、稀疏公司沒有空表。亮點／中性／風險那條軸
// 搬到上面的摘要卡（讀同三個 computed）：卡＝狀態、表＝分類。依 GURU_BADGE_CATEGORIES 排，沒有徽章的分類整個不列。
// 不用 guruBadgesByCategory()（它分的是全域型錄，會把 Basel III 幽靈徽章帶回來）；來源是 isMet(badge) !== null 不是 realBadges——
// 後者含 passed: null 的 entry，換軸時曾把它們第一次拉進表裡（1101 畫了 18 列對 13 個徽章的摘要）。
const groups = computed<BadgeGroup[]>(() => {
  const byCategory = new Map<GuruBadge['category'], GuruBadge[]>()
  for (const badge of realBadges.value.filter(badge => isMet(badge) !== null)) {
    const list = byCategory.get(badge.category)
    if (list) list.push(badge)
    else byCategory.set(badge.category, [badge])
  }
  return GURU_BADGE_CATEGORIES.flatMap(category => {
    const badges = byCategory.get(category)
    if (!badges?.length) return []
    // Counted through markFor() rather than re-deriving the rule, so the header's numbers can
    // never disagree with the icon shapes on the rows underneath them.
    const marks = badges.map(markFor)
    return [{
      key: category,
      title: category,
      badges,
      met: marks.filter(mark => mark === 'met').length,
      neutral: marks.filter(mark => mark === 'neutral').length,
      risk: marks.filter(mark => mark === 'risk').length
    }]
  })
})

// The badge whose detail dialog is open (StockGuruBadgeDialog's v-model); null = closed.
const selectedBadge = ref<GuruBadge | null>(null)
</script>

<template>
  <div v-loading="pending" class="stock-highlights-risks-table">
    <SharedEmptyState v-if="!pending && !hasAnyData" description="目前沒有可判定的財報徽章資料" />

    <!-- 摘要卡 (2026-09-20, direct request：「卡片摘要在上面，跟試作版相同，一眼就要看出多少有
         達成多少沒達成」). Summary → detail, not the same data twice: these carry ONLY the three
         counts, the table below carries which badges and their numbers. That distinction is what
         separates this from the duplicate badge table that was added and removed earlier the same
         day — a count you can read at a glance is the one thing the table genuinely can't give,
         since reading it means counting rows yourself.
         Static on purpose: no links or buttons, so there are no new hitboxes to space out and
         nothing here can be mistaken for a control. The detail is immediately below. -->
    <!-- One v-else branch wrapping BOTH the summary and the table: they share the single
         "we have data" condition. Written as a <template v-else> rather than a second
         `v-if="hasAnyData"` because a sibling carrying its own v-if between a v-if and a v-else
         steals the v-else — which silently inverted the table's condition when this was first
         added (it rendered only when there was NO data). -->
    <template v-else>
      <ul class="stock-highlights-risks-table__summary">
        <li v-for="status in statusSummary" :key="status.key" :class="`stock-highlights-risks-table__summary-card--${status.mark}`" class="stock-highlights-risks-table__summary-card">
          <span class="stock-highlights-risks-table__icon" :class="`stock-highlights-risks-table__icon--${status.mark}`" aria-hidden="true">
            <el-icon>
              <Trophy v-if="status.mark === 'met'" />
              <TrophyBase v-else-if="status.mark === 'neutral'" />
              <WarnTriangleFilled v-else />
            </el-icon>
          </span>
          <span class="stock-highlights-risks-table__summary-body">
            <span class="stock-highlights-risks-table__summary-title">{{ status.title }}</span>
            <span class="stock-highlights-risks-table__summary-count">{{ status.count }}<span class="stock-highlights-risks-table__summary-unit"> 項</span></span>
          </span>
        </li>
      </ul>

      <!-- SharedTableScroll, same as every other data-ssr-table in this app (2026-09-20 — it was
           missing when this table was first written, and the page itself scrolled sideways at
           375px: scrollWidth 565 against a 375 viewport, measured). The wrapper keeps the overflow
           inside the table's own focusable, arrow-key-scrollable region instead. -->
      <SharedTableScroll :label="`${symbol} 的財報徽章一覽`">
      <table class="seo-table" data-ssr-table>
        <caption class="visually-hidden">{{ symbol }} 的財報徽章，依市場評價、股東回饋、獲利品質等類別分組；每個類別標題後的三個數字依序是亮點、中性、風險的項數，每列標示該徽章的目前數值與門檻</caption>
        <thead>
          <tr>
            <th scope="col">徽章</th>
            <th scope="col">目前數值</th>
            <th scope="col">門檻</th>
            <th scope="col">詳情</th>
          </tr>
        </thead>
        <tbody v-for="group in groups" :key="group.key">
          <tr class="stock-highlights-risks-table__group-row">
            <!-- Digits are aria-hidden and the spelled-out form is visually hidden: a screen
                 reader announcing「獲利能力（1/3/0）」gives a listener three numbers with no way
                 to know which bucket each belongs to, since the summary cards that act as the
                 visual legend aren't adjacent in the reading order. Sighted and non-sighted
                 readers get the same facts, in the form each can actually use. -->
            <th scope="colgroup" colspan="4">
              {{ group.title }}<span aria-hidden="true">（{{ group.met }}/{{ group.neutral }}/{{ group.risk }}）</span>
              <span class="visually-hidden">：亮點 {{ group.met }} 項、中性 {{ group.neutral }} 項、風險 {{ group.risk }} 項</span>
            </th>
          </tr>
          <tr v-for="badge in group.badges" :key="badge.id">
            <th scope="row">
              <span class="stock-highlights-risks-table__icon" :class="`stock-highlights-risks-table__icon--${markFor(badge)}`" aria-hidden="true">
                <el-icon>
                  <Trophy v-if="markFor(badge) === 'met'" />
                  <TrophyBase v-else-if="markFor(badge) === 'neutral'" />
                  <WarnTriangleFilled v-else />
                </el-icon>
              </span>
              {{ badge.name }}
            </th>
            <td data-label="目前數值">{{ currentValueText(badge) }}</td>
            <td data-label="門檻">{{ thresholdText(badge) }}</td>
            <td>
              <NuxtLink v-if="badgePageFor(badge)" :to="badgePagePath(symbol, badgePageFor(badge)!.slug)" class="stock-highlights-risks-table__cta">看說明 →<span class="visually-hidden">：{{ badge.name }}</span></NuxtLink>
              <button v-else type="button" class="stock-highlights-risks-table__cta stock-highlights-risks-table__cta--button" aria-haspopup="dialog" @click="selectedBadge = badge">看說明<span class="visually-hidden">：{{ badge.name }}</span></button>
            </td>
          </tr>
        </tbody>
        </table>
      </SharedTableScroll>

      <!-- 無法判定 gets its own table rather than a fourth group in the one above: those rows
           answer a different question (why is there no number?) and so need a different column
           than 目前數值/門檻. Its own <h3> because「無法判定的徽章」is not a category name, so
           unlike the category headers it collides with nothing in the digest's own h3s. -->
      <template v-if="undetermined.length">
        <h3 class="stock-highlights-risks-table__subhead">無法判定的徽章（{{ undetermined.length }}）</h3>
        <SharedTableScroll :label="`${symbol} 目前無法判定的徽章`">
          <table class="seo-table" data-ssr-table>
            <caption class="visually-hidden">{{ symbol }} 目前無法判定的徽章，列出每一項無法判定的原因與該徽章的門檻</caption>
            <thead>
              <tr>
                <th scope="col">徽章</th>
                <th scope="col">無法判定的原因</th>
                <th scope="col">門檻</th>
                <th scope="col">詳情</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="badge in undetermined" :key="badge.id">
                <th scope="row">{{ badge.name }}</th>
                <td data-label="原因">{{ nullReasonText(badge) }}</td>
                <td data-label="門檻">{{ badge.threshold.description }}</td>
                <td>
                  <NuxtLink v-if="badgePageFor(badge)" :to="badgePagePath(symbol, badgePageFor(badge)!.slug)" class="stock-highlights-risks-table__cta">看說明 →<span class="visually-hidden">：{{ badge.name }}</span></NuxtLink>
                  <button v-else type="button" class="stock-highlights-risks-table__cta stock-highlights-risks-table__cta--button" aria-haspopup="dialog" @click="selectedBadge = badge">看說明<span class="visually-hidden">：{{ badge.name }}</span></button>
                </td>
              </tr>
            </tbody>
          </table>
        </SharedTableScroll>
      </template>
    </template>

    <p v-if="hasAnyData" class="stock-highlights-risks-table__disclaimer">{{ GURU_BADGE_DISCLAIMER }}</p>

    <StockGuruBadgeDialog v-model:badge="selectedBadge" :symbol="symbol" />
  </div>
</template>

<style scoped>
.stock-highlights-risks-table {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* 摘要卡。視覺規格承接自 /highlights-lab 那支試作頁（2026-09-20 比較完就刪了，規格搬來這裡是
   它唯一的產出）：2px 實心外框、16px 圓角、擴散微陰影、左側
   色軌——破格文件對高齡介面的硬性要求（無框平鋪會讓卡片融進背景）。手機單欄堆疊，桌機三欄。 */
.stock-highlights-risks-table__summary {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}

.stock-highlights-risks-table__summary-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
  background: var(--el-bg-color);
  border: 2px solid var(--el-border-color);
  border-radius: 16px;
  box-shadow: 0 8px 24px rgb(0 0 0 / 8%);
}

/* 左側色軌是第三層冗餘（位置＋圖示形狀＋文字標題已經足夠），不是唯一線索。 */
.stock-highlights-risks-table__summary-card--met {
  border-inline-start: 6px solid var(--el-color-primary);
}

.stock-highlights-risks-table__summary-card--neutral {
  border-inline-start: 6px solid var(--el-text-color-secondary);
}

.stock-highlights-risks-table__summary-card--risk {
  border-inline-start: 6px solid var(--el-text-color-primary);
}

/* The shared icon is sized for inline use in a table cell (22px + a right margin). In a summary
   card it sits next to a 2rem number, so it scales up and drops the margin — the card's own
   flex `gap` handles the spacing. */
/* Sets only the two size VARIABLES, never font-size directly. This selector is two classes and
   the --risk rule below is one, so a font-size declared here would outrank --risk's and silently
   undo its glyph scaling in this context — which is exactly what happened on the first attempt
   (the summary triangle stayed at 18px while the table one scaled correctly). */
.stock-highlights-risks-table__summary-card .stock-highlights-risks-table__icon {
  --mark-box: 40px;
  --mark-glyph: 1.125rem;
  margin-right: 0;
  flex-shrink: 0;
}

.stock-highlights-risks-table__summary-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.stock-highlights-risks-table__summary-title {
  font-size: 1rem;
  color: var(--el-text-color-regular);
}

/* 「一眼看出」靠的就是這個字級落差：數字 2rem，標題 1rem。 */
.stock-highlights-risks-table__summary-count {
  font-size: 2rem;
  font-weight: 700;
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
  color: var(--el-text-color-primary);
}

.stock-highlights-risks-table__summary-unit {
  font-size: 1rem;
  font-weight: 400;
  color: var(--el-text-color-secondary);
}

.stock-highlights-risks-table__group-row th {
  background: var(--el-fill-color-light);
  font-size: 1rem;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.stock-highlights-risks-table__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  /* Box size as a variable: --risk below sizes its glyph off the BOX, not off the other two
     glyphs, because that's what it has to visually match (see that rule). One variable keeps
     the two contexts — this 22px inline box and the 40px summary-card one — in step. */
  --mark-box: 22px;
  --mark-glyph: 0.75rem;
  width: var(--mark-box);
  height: var(--mark-box);
  margin-right: 8px;
  border-radius: 50%;
  border: 2px solid transparent;
  font-size: var(--mark-glyph);
  vertical-align: middle;
}

/* Shape language, three ways (2026-09-20): filled medal = 亮點, hollow ring = 中性, filled
   triangle = 風險. The triangle is what keeps 中性 and 風險 apart WITHOUT a colour pair — both
   are unmet badges, so the old two-shape scheme would have rendered them identically once the
   third bucket got its own name. Still no success/danger colour pair (safe-harbor wording). */
.stock-highlights-risks-table__icon--met {
  background: var(--el-color-primary);
  color: var(--app-on-primary);
}

.stock-highlights-risks-table__icon--neutral {
  background: transparent;
  border-color: var(--el-text-color-secondary);
  color: var(--el-text-color-secondary);
}

/* 風險 is the one mark with neither a filled disc nor a ring, so the box around it contributes no
   visual mass and the bare glyph read far smaller than its two siblings (direct report 2026-09-20:
   「警示三角形的icon數量太小了」). It gets that mass back from the glyph instead of from a
   container — a container would be a third circle, which is what the shape language is trying to
   avoid. Sized off --mark-box (not off the other glyphs): what it has to match is the DISC's
   diameter, and the two contexts have different box-to-glyph ratios (22/12 vs 40/18), so a single
   multiplier of the glyph size would only ever be right in one of them. */
.stock-highlights-risks-table__icon--risk {
  background: transparent;
  border-color: transparent;
  color: var(--el-text-color-primary);
  font-size: calc(var(--mark-box) * 0.92);
}

/* Visible affordance that distinguishes a row that navigates (has its own /stock/:code page)
   from one that opens the shared dialog — see this file's own top comment. */
.stock-highlights-risks-table__cta {
  display: inline-flex;
  min-height: 44px;
  align-items: center;
  padding: 0 4px;
  font: inherit;
  font-weight: 600;
  color: var(--el-color-primary-dark-2);
  white-space: nowrap;
  text-decoration: none;
}

.stock-highlights-risks-table__cta--button {
  border: 0;
  background: transparent;
  cursor: pointer;
}

/* 表格每一格垂直置中（2026-09-28「文字排版與樣式請優化，置中甚麼的要做好」）。
   量到的成因：「看說明」那一格是一顆 min-height: 44px 的按鈕（觸控目標），把列撐到 61px，而其他
   三格的內容只有 22～24px 且吃 vertical-align 的預設值靠上——徽章名的中心因此比列中心高 8px。
   44px 是本站的觸控底線不該動，所以改的是其他格的對齊。 */
:deep(.seo-table tbody th),
:deep(.seo-table tbody td) {
  vertical-align: middle;
}

.stock-highlights-risks-table__subhead {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.stock-highlights-risks-table__disclaimer {
  margin: 0;
  font-size: 1rem;
  color: var(--el-text-color-secondary);
}

/* 手機版（2026-10-06「亮點與風險 請重新設計手機版的 UIUX，他現在在手機版近乎不可用」）。
   量到的問題：375px 時徽章表 918px 寬、可視 328px，只看得到徽章名，目前數值／門檻／看說明全在畫面外；
   三張摘要卡各佔滿一列，三項數字就吃掉大半個螢幕。
   改法：摘要卡維持三欄、改成直排（圖示／標題／數字）；表格同一份 DOM，每一列改成兩段——第一行是
   圖示＋徽章名＋右側「看說明」，下面是「目前數值：…」「門檻：…」，標籤取自 td 的 data-label。
   只改 CSS 不出第二份 DOM：SSR 表格是這一頁的 SEO 主體，兩份會讓同一段文字在 HTML 裡出現兩次。
   ponytail: tr/td 改 display 後，舊版 Safari 會把表格語意丟掉（新版已修）；真的有回報再補 ARIA role。 */
@media (max-width: 719px) {
  .stock-highlights-risks-table__summary {
    gap: 8px;
  }

  .stock-highlights-risks-table__summary-card {
    flex-direction: column;
    gap: 6px;
    padding: 12px 8px;
    text-align: center;
  }

  .stock-highlights-risks-table__summary-body {
    align-items: center;
  }

  .stock-highlights-risks-table__summary-card .stock-highlights-risks-table__icon {
    --mark-box: 32px;
    --mark-glyph: 1rem;
  }

  .stock-highlights-risks-table__summary-count {
    font-size: 1.5rem;
  }

  .stock-highlights-risks-table :deep(.seo-table),
  .stock-highlights-risks-table :deep(.seo-table tbody) {
    display: block;
  }

  .stock-highlights-risks-table :deep(.seo-table thead) {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }

  .stock-highlights-risks-table :deep(.seo-table tbody tr) {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    column-gap: 8px;
    align-items: center;
    padding: 8px 0;
    border-bottom: 1px solid var(--el-border-color-lighter);
  }

  .stock-highlights-risks-table :deep(.seo-table tbody th),
  .stock-highlights-risks-table :deep(.seo-table tbody td) {
    position: static;
    padding: 0;
    border: 0;
    white-space: normal;
    background: none;
  }

  /* 類別標題列：整列一格，底色鋪滿 */
  .stock-highlights-risks-table :deep(.seo-table .stock-highlights-risks-table__group-row) {
    display: block;
    padding: 8px 12px;
    background: var(--el-fill-color-light);
  }

  .stock-highlights-risks-table :deep(.seo-table tbody th[scope='row']) {
    grid-column: 1;
    grid-row: 1;
  }

  .stock-highlights-risks-table :deep(.seo-table tbody td:last-child) {
    grid-column: 2;
    grid-row: 1;
  }

  .stock-highlights-risks-table :deep(.seo-table tbody td[data-label]) {
    grid-column: 1 / -1;
    padding-left: 30px;
    color: var(--el-text-color-regular);
  }

  .stock-highlights-risks-table :deep(.seo-table tbody td[data-label]::before) {
    content: attr(data-label) '：';
    color: var(--el-text-color-secondary);
  }
}
</style>
