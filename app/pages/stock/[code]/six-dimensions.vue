<script setup lang="ts">
import type { RadarBreakdown } from '~/utils/six-dimensions'

// 六面向（2026-11-27，使用者：「設計一個個股 卡片 / 頁面 應用到雷達圖。跟數據中台核對計算方式。」；設計圖
// https://claude.ai/artifact/FWP3mJfa44md4csrM31MAb）：一家公司在成長動能、價格趨勢、體質改善、價值型、財務安全、股東回饋六件事上，各排在
// 上市櫃公司的哪個位置。第一段是雷達圖加六列的表，第二段把每個面向的組成指標攤開（這家公司的數字與它的百分位），讀者看得出數字怎麼來。
// 合規（使用者同日）：畫這個不算評等，「因為我沒給買進賣出持有與價位建議」。所以文字只寫位置，不寫強弱好壞、不寫回測報酬；
// 不出總分（使用者在數據中台的決定）。數字全部是數據中台算好的（radar-breakdown），算法見 app/utils/six-dimensions.ts 開頭
const route = useRoute()
const code = computed(() => String(route.params.code))

const TOPIC = '六面向'

const { stock, profile, stockShortName, stockPending } = useStockDetailSummary(code)
// 六面向與型錄（組成指標的名稱、單位、選項）一起等到了才換頁：頁面沒有讀取中的樣子，資料晚到不會把版面往下推
const [{ data, error, refresh }, { data: filterSchema }] = await Promise.all([
  useFetch<RadarBreakdown>(() => `/api/cached/stocks/${code.value}/radar-breakdown`, { key: () => `stock-six-dimensions-${code.value}`, watch: [code] }),
  useFilterSchema()
])
// 404（興櫃、不在母體）是沒有資料，不是讀不到。讀不到的時候畫面不說「目前沒有」，交給全站的讀取失敗提示（它會自動重讀）：
// 數據中台改了面向的定義、那一批還沒重算完時會回 503（經業務中台是 502，2026-11-27 起；之前是把舊的值配上新的組成名稱）
const failure = computed(() => (error.value && error.value.statusCode !== 404 ? error.value : null))
watchLoadFailure(() => `stock-six-dimensions:${code.value}`, () => failure.value, refresh)

const axes = computed(() => sixDimensionAxes(data.value))
const hasAny = computed(() => axes.value.some(axis => axis.value !== null))
const asOf = computed(() => data.value?.asOf ?? null)
const emerging = computed(() => profile.value?.market === 'rotc')

const answer = computed(() => {
  if (emerging.value) return '六面向只算上市櫃公司，興櫃公司不在比較範圍裡。'
  if (failure.value) return ''
  if (!data.value) return `目前沒有${stockShortName.value}的六面向資料。`
  // 六個都算不出來：原因每個面向不一定一樣（產業不適用、歷史不夠長、不到一半有值），寫在下面的表
  return sixDimensionsAnswer(axes.value, asOf.value) ?? `${stockShortName.value}的六個面向目前都算不出來，各自的原因在下面的表。`
})

// 第二段：每個面向的組成指標。名稱、單位、選項（均線排列）照型錄；有好幾種期別的才寫期別（只有一種的寫了也沒有資訊）。
// 型錄還不認得的指標不畫那一列（明細比型錄早到的那段時間會這樣，2026-11-27 本機就是）：畫面不印欄位代號
const categories = computed(() => filterSchema.value?.categories ?? [])
const groups = computed(() => axes.value.map(axis => ({
  axis,
  scope: sixDimensionScopeText(axis),
  rows: axis.components.flatMap((component) => {
    const found = locateFieldInSchema(categories.value, component.fieldId)
    if (!found) return []
    return [{
      key: component.fieldId,
      name: metricDisplayName(found.metric),
      period: found.metric.fields.length > 1 ? formatPeriodLabel(found.field.period) : null,
      to: stockMetricPath(code.value, component.fieldId),
      value: component.value === null ? nullReasonShortText(component.nullReason) : formatScreenerValue(component.value, found.metric.unit, component.fieldId, found.metric.options),
      percentile: percentileText(component.percentile),
      lowerIsHigher: component.order === 'asc'
    }]
  })
})))
// 每個面向有幾個指標照資料寫（不是照畫出來的列數：型錄晚到時少畫的那幾列還是算）。不適用的面向沒有組成（sixDimensionAxes），不算進來：
// 金融保險業只剩成長動能、價格趨勢、股東回饋，寫「3 到 4 個」
const componentsAnswer = computed(() => {
  const counts = axes.value.map(axis => axis.components.length).filter(Boolean)
  const [min, max] = [Math.min(...counts), Math.max(...counts)]
  const count = !counts.length ? '幾' : min === max ? ` ${min} ` : ` ${min} 到 ${max} `
  return `每個面向由${count}個指標組成。下表是${stockShortName.value}這些指標的數字，以及每個數字在比較對象裡的位置。`
})
// 段落最後一句：哪些指標是數字越低、百分位越高（照 order），每個面向跟誰比（照 scope）。都從資料來，組成改了這一句跟著改
const closingNote = computed(() => {
  const lowerIsHigher = [...new Set(groups.value.flatMap(group => group.rows.filter(row => row.lowerIsHigher).map(row => row.name)))]
  return `${lowerIsHigher.length ? `${lowerIsHigher.join('、')}是數字越低、百分位越高。` : ''}${sixDimensionScopeNote(axes.value)}`
})
// 六個名稱只寫在 six-dimensions.ts（2026-11-27「價值」改叫「價值型」時，這一頁還有兩句各抄了一份）；跟著實際畫的軸走，第 5 軸換了也對
const axisNames = computed(() => axes.value.map(axis => axis.label).join('、'))
const description = computed(() => clampDescription(`${stockShortName.value}（${code.value}）的六面向：${axisNames.value}各自在上市櫃公司裡的百分位，以及每個面向由哪些指標組成。`))

const { breadcrumbs } = useStockPageSeo({
  code,
  shortName: stockShortName,
  topic: TOPIC,
  // 標題至多 32 字（check-stock-pages）：六個面向的名稱寫在 description，標題只寫這一頁有什麼
  titleKeywords: '六面向雷達圖與組成指標',
  pathSuffix: '/six-dimensions',
  stock,
  description,
  sectorCode: computed(() => profile.value?.sectorCode ?? null),
  noindex: computed(() => !hasAny.value)
})

const footer = computed(() => ({
  sources: ['公開資訊觀測站、臺灣證券交易所、證券櫃檯買賣中心的公開資料（百分位由本站計算）'],
  freshness: asOf.value ? `資料日期 ${asOf.value}` : null,
  disclaimer: '百分位是統計上的位置，不代表本站對此個股之評等或投資建議。'
}))
const guide = computed(() => [
  `六面向把一家公司放進全部上市櫃公司裡，看它在六件事上各排在哪裡：${axisNames.value}。每個面向取幾個指標，各自換成百分位之後平均，再換成全體的百分位。`,
  '百分位是位置，不是分數：0 是最低、100 是最高，同分的公司排在同一個位置。六個數字各自獨立，不能相加當成總分。',
  '一個面向的組成指標不到一半有值（剛掛牌、歷史資料還不夠長的也算）時，這個面向算不出來，圖上那一個軸不連線。金融保險業，以及用異業合併格式申報財報的公司，只看其中幾個面向，其餘寫「不適用」。興櫃公司不在比較範圍裡。',
  '百分位只跟同一天的上市櫃公司相比，不代表股價之後的漲跌。'
])
</script>

<template>
  <StockPageShell
    class="stock-six-dimensions-page"
    :code="code"
    :stock="stock"
    :pending="stockPending"
    :short-name="stockShortName"
    :topic="TOPIC"
    :breadcrumbs="breadcrumbs"
    :footer="footer"
  >
    <StockQuestionSection id="stock-six-dimensions" :question="`${stockShortName}在六個面向各排在哪裡？`" :answer="answer">
      <div v-if="data" class="stock-six-dimensions-page__overview">
        <div class="stock-six-dimensions-page__overview-grid">
          <SharedChartCard v-if="hasAny">
            <SharedChartLegend :groups="SIX_DIMENSIONS_LEGEND" />
            <StockSixDimensionsRadar :axes="axes" :label="sixDimensionsAriaLabel(stockShortName, axes)" />
          </SharedChartCard>
          <SharedTable :label="`${stockShortName}六個面向的百分位${asOf ? `（${asOf}）` : ''}`">
            <thead>
              <tr>
                <th scope="col">面向</th>
                <th scope="col" class="seo-table__num">百分位</th>
                <th scope="col">位置</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="axis in axes" :key="axis.code">
                <th scope="row">{{ axis.label }}</th>
                <td class="seo-table__num">{{ axis.value === null ? sixDimensionMissingLabel(axis.nullReason) : percentileText(axis.value) }}</td>
                <td class="stock-six-dimensions-page__position">
                  <span v-if="axis.value !== null" class="stock-six-dimensions-page__track" aria-hidden="true"><span :style="{ width: `${axis.value}%` }" /></span>
                  <template v-else>{{ sixDimensionNullText(axis.nullReason) }}</template>
                </td>
              </tr>
            </tbody>
          </SharedTable>
        </div>
      </div>
    </StockQuestionSection>
    <StockQuestionSection
      v-if="data"
      id="stock-six-dimensions-components"
      question="每個面向看的是哪些數字？"
      :answer="componentsAnswer"
    >
      <SharedTable :label="`六個面向的組成指標、${stockShortName}的數字與百分位`" table-class="stock-six-dimensions-page__components">
        <thead>
          <tr>
            <th scope="col">指標</th>
            <th scope="col" class="seo-table__num">數字</th>
            <th scope="col" class="seo-table__num">百分位</th>
          </tr>
        </thead>
        <tbody v-for="{ axis, scope, rows } in groups" :key="axis.code">
          <tr class="stock-six-dimensions-page__group">
            <th colspan="3" scope="rowgroup">
              {{ axis.label }}<template v-if="scope">（{{ scope }}）</template>
              <span class="stock-six-dimensions-page__group-value">{{ axis.value === null ? `${sixDimensionMissingLabel(axis.nullReason)}${sixDimensionNullText(axis.nullReason) ? `：${sixDimensionNullText(axis.nullReason)}` : ''}` : percentileText(axis.value) }}</span>
            </th>
          </tr>
          <tr v-for="row in rows" :key="row.key">
            <th scope="row" class="stock-six-dimensions-page__name">
              <NuxtLink v-if="row.to" :to="row.to" class="seo-table__link">{{ row.name }}</NuxtLink><template v-else>{{ row.name }}</template><template v-if="row.period">（{{ row.period }}）</template>
            </th>
            <td class="seo-table__num">{{ row.value }}</td>
            <td class="seo-table__num">{{ row.percentile }}</td>
          </tr>
        </tbody>
      </SharedTable>
      <p v-if="closingNote" class="hub-answer">{{ closingNote }}</p>
    </StockQuestionSection>
    <template #guide>
      <StockMetricGuide id-prefix="stock-six-dimensions" :topic="TOPIC" definition-question="六面向是什麼？" :definition="guide" />
    </template>
  </StockPageShell>
</template>

<style scoped>
/* 雷達圖與六列的表：窄的時候上下疊（手機的基本樣子），這一塊寬到 720px 以上才並排。720 是全站表格換版面的那個數字，
   一半 352px 放得下圖（軸名 64＋圖 208＋軸名 64，加卡片內距）與三欄的表 */
.stock-six-dimensions-page__overview {
  container-type: inline-size;
}

/* minmax(0, 1fr)：格子可以比表格的最小寬度窄（表格在自己的卡片裡捲），不然表格會把整塊連同雷達圖撐出畫面 */
.stock-six-dimensions-page__overview-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
}

@container (min-width: 720px) {
  .stock-six-dimensions-page__overview-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: start;
  }
}

/* 位置那一欄的橫條：0 到 100，中間一條虛線是 50。只是輔助，數字在前一欄 */
.stock-six-dimensions-page__track {
  position: relative;
  display: block;
  min-width: 4rem;
  max-width: 11.25rem;
  height: 10px;
  border-radius: 5px;
  background: var(--el-fill-color);
}

.stock-six-dimensions-page__track > span {
  position: absolute;
  inset: 0 auto 0 0;
  border-radius: 5px;
  background: var(--el-color-primary);
}

.stock-six-dimensions-page__track::after {
  content: '';
  position: absolute;
  left: 50%;
  top: -4px;
  bottom: -4px;
  border-left: 2px dashed var(--el-text-color-secondary);
}

/* 算不出來的原因寫在位置那一欄與分組列，句子可以折行（表格的格子預設不折） */
.stock-six-dimensions-page__position {
  white-space: normal;
}

:deep(.stock-six-dimensions-page__components) .stock-six-dimensions-page__group > th {
  background: var(--el-fill-color-lighter);
  font-weight: 600;
  white-space: normal;
}

/* 沒有組成列的面向（不適用的三個）分組列是那一段唯一的一列，全站「最後一列不畫底線」會把它的線拿掉，三個連在一起就分不開。
   最後一個面向除外：卡片的框就是底 */
:deep(.stock-six-dimensions-page__components) tbody:not(:last-child) > .stock-six-dimensions-page__group > th {
  border-bottom: 1px solid var(--app-divider);
}

.stock-six-dimensions-page__group-value {
  margin-left: 8px;
  font-variant-numeric: tabular-nums;
}

/* 指標欄吃掉剩下的寬度、可以折行，數字欄照內容寬 */
:deep(.stock-six-dimensions-page__components) .stock-six-dimensions-page__name {
  width: 100%;
  white-space: normal;
}
</style>
