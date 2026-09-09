<script setup lang="ts">
import { Folder, OfficeBuilding, Search } from '@element-plus/icons-vue'
import type { LoadFunction, TreeInstance } from 'element-plus'
import type { IndustryTreeCompany, IndustryTreeChild } from '~/composables/industries/useIndustryTree'
import type { IndustryFlatCompany } from '~/composables/industries/useIndustryFlatIndex'

// 產業追蹤 — replaces the earlier breadcrumb-drill-down version with a top-to-bottom expanding
// el-tree per direct request ("我希望他是個從上到下展開的結構，有套件支援嗎"). el-tree is part
// of Element Plus (already a dependency of this app), not a new package — its `lazy`/`load` mode
// fetches a node's children only when the user expands it, which maps directly onto
// GET /industries/tree's own "give a code, get that code's children" shape (see
// useIndustryTree.ts's own comment for the full API contract).
//
// Two kinds of tree node share one el-tree: a CATEGORY node (section/division/group/class/
// subclass, always expandable since 0-company categories are filtered out before a node is ever
// constructed — see buildCategoryNodes) and a COMPANY node (a real company only ever appears
// under a subclass leaf, per bff-ts's own design). Company nodes are the only leaves (isLeaf:
// true) — clicking one navigates to its stock page instead of expanding.
const router = useRouter()
const { load } = useIndustryTree()

interface CategoryNodeData {
  kind: 'category'
  code: string
  label: string
  isLeaf: false
}

interface CompanyNodeData {
  kind: 'company'
  code: string
  label: string
  symbol: string
  isLeaf: true
}

type IndustryNodeData = CategoryNodeData | CompanyNodeData

// Same "hide 0-company rows" rule as the earlier version (per direct request "產業樹，如果有那種
// 0家的，可以就隱藏嗎") — safe because bff-ts's companyCount is aggregated across the whole
// subtree, so 0 means nothing exists anywhere underneath, never just "not at this level."
function buildCategoryNodes(children: IndustryTreeChild[]): CategoryNodeData[] {
  return children
    .filter(child => child.companyCount > 0)
    .map(child => ({ kind: 'category', code: child.code, label: `${child.name}（${child.companyCount}）`, isLeaf: false }))
}

function buildCompanyNodes(companies: IndustryTreeCompany[]): CompanyNodeData[] {
  return companies.map(company => ({
    kind: 'company',
    code: `co:${company.symbol}`,
    label: `${company.symbol}　${company.companyName}`,
    symbol: company.symbol,
    isLeaf: true
  }))
}

// A node's real children after filtering 0-company rows — resolved to either more category
// nodes, or (once a subclass leaf is actually reached) the company list. Also auto-skips a chain
// of categories that each only reduce to exactly one visible sub-category, per direct request
// ("有機會把那些底下只有一個項目的，層級打掉嗎...點開以後直接跑出 1435 中福 就好") — e.g.
// 農作物栽培業 only ever branches into one real sub-category at every level down to its one
// actual company, so expanding it shows that company directly instead of a chain of single-item
// rows each needing its own click. Capped at 5 iterations (the tree's own max depth) so a bug in
// the response shape can't spin this into an infinite loop.
async function resolveChildren(result: { children: IndustryTreeChild[]; companies: IndustryTreeCompany[] }): Promise<IndustryNodeData[]> {
  let categoryNodes = buildCategoryNodes(result.children)
  for (let i = 0; i < 5 && categoryNodes.length === 1; i++) {
    const next = await load(categoryNodes[0]!.code)
    if (!next?.found) return categoryNodes
    if (next.companies.length > 0) return buildCompanyNodes(next.companies)
    categoryNodes = buildCategoryNodes(next.children)
  }
  return categoryNodes
}

// node-key uses `code`, which must be unique across BOTH node kinds sharing this tree — category
// codes (section letters/division-group-class digit strings/subclass "nnnn-nn") and company
// symbols never collide in practice, but prefixed here defensively rather than relying on that.
const loadNode: LoadFunction = async (node, resolve) => {
  if (node.level === 0) {
    const root = await load(undefined)
    resolve(await resolveChildren({ children: root?.children ?? [], companies: [] }))
    return
  }
  const nodeData = node.data as IndustryNodeData
  if (nodeData.kind === 'company') {
    resolve([])
    return
  }
  const result = await load(nodeData.code)
  if (!result?.found) {
    resolve([])
  } else if (result.companies.length > 0) {
    resolve(buildCompanyNodes(result.companies))
  } else {
    resolve(await resolveChildren(result))
  }
}

function handleNodeClick(nodeData: IndustryNodeData) {
  if (nodeData.kind === 'company') router.push(`/stock/${nodeData.symbol}`)
}

// Search — per direct request ("加上 search 功能，比如搜尋 1435，樹狀圖自動打開到農作物栽培頁。
// 輸入半導體，自動打開到半導體製造業"). GET /industries/tree alone has no lookup-by-symbol or
// keyword-search capability (only "give a code, get its children"), so this needed a real new
// endpoint — GET /industries/flat (bff-ts/analysis-ts shipped it live 2026-09-09, commit
// 1a0605c on bff-ts's side — see useIndustryFlatIndex.ts's own comment) returns all 999
// companies with their full 5-level ancestor path, which this searches against client-side.
const treeRef = ref<TreeInstance>()
// Real bug fixed same day (reported live: "產業搜尋功能無法正常輸入 按鍵無反應") — the
// <el-autocomplete> below originally had no v-model at all. Without one, its `modelValue` prop
// is permanently undefined, so every re-render (any reactive state change anywhere on this page,
// not just typing itself) snapped the displayed text back to empty — keystrokes visually
// registered for an instant and then vanished, reading as "can't type at all." keyword also gets
// set explicitly in handleSelect (matching StockHealthCheckCard.vue's own established pattern)
// since SearchResult uses `label`, not the `value` key el-autocomplete's own valueKey default
// looks for to auto-fill the input on selection.
const keyword = ref('')
const { ensureLoaded } = useIndustryFlatIndex()

interface SearchResult {
  kind: 'company' | 'category'
  label: string
  // Ancestor codes to expand through, root-first. For a company result this is its full 5-level
  // path (the company itself isn't a "level" — it's the tree's own separate company-node child of
  // the last category); for a category result this INCLUDES the matched category itself as the
  // last entry, since that's the node to end up expanding, not just its ancestors.
  path: string[]
  symbol?: string
}

// A company hit if the query looks like a stock code (all digits) and the symbol starts with it,
// or if it matches the company's own name; a category hit for every ancestor level whose name
// contains the query, deduped by code (the same category name/code repeats once per company
// under it — e.g. dozens of companies share "半導體製造業" as an ancestor). Capped at 30 so the
// dropdown stays scannable rather than dumping every one of 999 companies for a broad keyword.
function search(query: string, companies: IndustryFlatCompany[]): SearchResult[] {
  const trimmed = query.trim()
  if (!trimmed) return []
  const isNumeric = /^\d+$/.test(trimmed)
  const results: SearchResult[] = []
  const seenCategoryCodes = new Set<string>()

  for (const company of companies) {
    if (results.length >= 30) break
    const matchesCompany = isNumeric ? company.symbol.startsWith(trimmed) : company.companyName.includes(trimmed)
    if (matchesCompany) {
      results.push({
        kind: 'company',
        label: `${company.symbol}　${company.companyName}`,
        path: company.path.map(entry => entry.code),
        symbol: company.symbol
      })
    }
    if (!isNumeric) {
      for (let i = 0; i < company.path.length; i++) {
        const entry = company.path[i]!
        if (entry.name.includes(trimmed) && !seenCategoryCodes.has(entry.code)) {
          seenCategoryCodes.add(entry.code)
          results.push({
            kind: 'category',
            label: `${entry.name}（分類）`,
            path: company.path.slice(0, i + 1).map(item => item.code)
          })
        }
      }
    }
  }
  return results
}

async function fetchSuggestions(query: string, callback: (results: SearchResult[]) => void) {
  const companies = await ensureLoaded()
  callback(search(query, companies))
}

// Walks `path` root-first, expanding each ancestor that still exists as its own tree node.
// Codes that got flattened away by resolveChildren's own single-child auto-skip (see its own
// comment) simply never got created as separate nodes — getNode returns undefined for those,
// which this treats as "already resolved through by an earlier ancestor's expand," not an error.
// Returns the last real node actually found/expanded, since that's what a category search result
// should end up highlighting once its own code turns out to have been flattened away too.
async function expandPath(path: string[]) {
  let lastNode: ReturnType<TreeInstance['getNode']> | undefined
  for (const code of path) {
    const node = treeRef.value?.getNode(code)
    if (!node) continue
    lastNode = node
    if (!node.isLeaf) await new Promise<void>(resolve => node.expand(resolve, true))
  }
  return lastNode
}

function scrollToKey(key: string) {
  nextTick(() => {
    treeRef.value?.$el.querySelector(`[data-key="${key}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  })
}

async function handleSelect(result: SearchResult) {
  keyword.value = result.label
  const lastFoundAncestor = await expandPath(result.path)
  const targetKey = result.kind === 'company' ? `co:${result.symbol}` : result.path[result.path.length - 1]!
  // Falls back to the deepest real ancestor expandPath actually found when the precise target
  // code was itself one of the flattened-away levels (a category search hit whose own code never
  // became a separate node — its parent already expanded straight through it).
  const targetNode = treeRef.value?.getNode(targetKey) ?? lastFoundAncestor
  if (!targetNode) return
  // A category target should end up EXPANDED (revealing what's under it, matching "自動打開到
  // 半導體製造業"), not just scrolled to — a company target is already a leaf, nothing to expand.
  if (!targetNode.isLeaf && !targetNode.expanded) await new Promise<void>(resolve => targetNode.expand(resolve, true))
  treeRef.value?.setCurrentKey(targetNode.data.code)
  scrollToKey(targetNode.data.code)
}
</script>

<template>
  <div class="industries-page">
    <h1 class="industries-page__title">產業追蹤</h1>
    <p class="industries-page__subtitle">
      依台灣稅籍登記行業分類逐層展開——與個股頁的證交所產業分類是不同的兩套系統，不能互相對照
    </p>

    <el-autocomplete
      v-model="keyword"
      class="industries-page__search"
      :fetch-suggestions="fetchSuggestions"
      placeholder="搜尋股票代號、公司名稱或分類，例如 1435 或 半導體"
      clearable
      @select="handleSelect"
    >
      <template #prefix>
        <el-icon><Search /></el-icon>
      </template>
      <template #default="{ item }">
        <div class="industries-page__search-option">
          <span>{{ (item as SearchResult).label }}</span>
        </div>
      </template>
    </el-autocomplete>

    <el-tree
      ref="treeRef"
      lazy
      node-key="code"
      highlight-current
      :load="loadNode"
      :props="{ label: 'label', isLeaf: 'isLeaf' }"
      @node-click="handleNodeClick"
    >
      <template #default="{ data: nodeData }">
        <span class="industries-page__node">
          <el-icon class="industries-page__node-icon">
            <OfficeBuilding v-if="(nodeData as IndustryNodeData).kind === 'company'" />
            <Folder v-else />
          </el-icon>
          {{ nodeData.label }}
        </span>
      </template>
    </el-tree>
  </div>
</template>

<style scoped>
.industries-page {
  width: 100%;
}

.industries-page__title {
  font-size: 20px;
  font-weight: 600;
  margin: 0 0 16px;
}

.industries-page__subtitle {
  font-size: 16px;
  color: var(--el-text-color-secondary);
  margin: -8px 0 20px;
}

.industries-page__search {
  width: 100%;
  max-width: 420px;
  margin-bottom: 16px;
}

.industries-page__node {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 16px;
}

.industries-page__node-icon {
  color: var(--el-text-color-placeholder);
}
</style>
