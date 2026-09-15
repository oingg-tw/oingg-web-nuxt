<script setup lang="ts">
import { Folder, OfficeBuilding, Search } from '@element-plus/icons-vue'
import type { TreeInstance } from 'element-plus'
import type { IndustryTreeNode, IndustryChainTree } from '~/composables/industries/useIndustryChainTree'

// 產業追蹤 — REBUILT 2026-09-14 per direct request ("產業追蹤還是要的，只是接新的API"): same
// page, migrated off gov-ts's 財政部稅籍行業標準分類 (the old 5-level lazy-loaded tree) onto
// oingg-playwright-py's real supply-chain data — browse-oriented tree (GET /industries/chain-tree,
// confirmed live 2026-09-15) — see useIndustryChainTree.ts's own comment for why this REPLACED
// the earlier flat GET /industries/chain-classification data source here specifically (one
// category flattening 99 companies at one level was a real browse problem); chain-classification
// itself is untouched and still backs peer-group/industry-tag elsewhere in the app.
//
// 聚落 (clusters) tab — REMOVED from this page 2026-09-15 per direct request ("產業追蹤 只保留
// 分類就好 聚落先不要"). "先" reads as temporary/paused, not a permanent decision, so the
// underlying composable (useIndustryChainClusters.ts, GET /industries/chain-clusters) is left
// untouched on disk rather than deleted — it's genuinely reusable, already-verified backend
// integration work, just not currently wired into this page's UI. If/when 聚落 comes back, that
// composable's own buildClusterTree/search logic can be restored from git history (this file's
// own history has the full working implementation, tab switcher included) rather than rebuilt
// from scratch.
const { ensureLoaded: ensureTreeLoaded, pending: classificationPending } = useIndustryChainTree()

interface GroupNodeData {
  kind: 'group'
  code: string
  label: string
  children: (GroupNodeData | CompanyNodeData)[]
}

interface CompanyNodeData {
  kind: 'company'
  code: string
  label: string
  symbol: string
}

type ClassificationNodeData = GroupNodeData | CompanyNodeData

// Backend already nests the whole tree (coarse_group → category → segment → misc, ≤4 deep,
// members only on real leaves) — this just relabels each node with its own company-count and
// converts `members` into actual child tree rows (the API's members are plain {symbol,
// companyName} data, not tree nodes themselves — confirmed live 2026-09-15 after a real bug:
// assumed the same {code,name} shape chain-clusters' own members use, which produced
// "undefined　undefined" for every company row, see useIndustryChainTree.ts's own comment).
// Per playwright-py's explicit warning, 'misc' is NOT always a leaf (a long-tail bucket can
// itself be sub-divided further) — deliberately branches on whether `children`/`members` are
// non-empty, never on `node.nodeType === 'misc'`.
function buildGroupNode(node: IndustryTreeNode): GroupNodeData {
  const childGroups = node.children.map(buildGroupNode)
  const memberNodes: CompanyNodeData[] = node.members.map(member => ({
    kind: 'company',
    code: `co:${member.symbol}`,
    label: `${member.symbol}　${member.companyName}`,
    symbol: member.symbol
  }))
  return { kind: 'group', code: node.nodeId, label: `${node.label}（${node.size}）`, children: [...childGroups, ...memberNodes] }
}

const tree = ref<IndustryChainTree>({ roots: [] })
const classificationTreeData = ref<GroupNodeData[]>([])

onMounted(async () => {
  tree.value = await ensureTreeLoaded()
  classificationTreeData.value = tree.value.roots.map(buildGroupNode)
})

// Moved out of the inline `:props` template binding — Vue template expressions are parsed as
// plain JS, not TS, so a typed arrow function param (`(data: unknown) => ...`) there is a real
// syntax error, not just a style choice (confirmed live: 500 "Unexpected token '}'").
const classificationTreeProps = {
  label: 'label',
  children: 'children',
  isLeaf: (data: unknown) => (data as ClassificationNodeData).kind === 'company'
}

const classificationTreeRef = ref<TreeInstance>()

interface ClassificationSearchResult {
  kind: 'company' | 'group'
  label: string
  path: string[]
  symbol?: string
}

function searchClassification(query: string, data: IndustryChainTree): ClassificationSearchResult[] {
  const trimmed = query.trim()
  if (!trimmed) return []
  const isNumeric = /^\d+$/.test(trimmed)
  const results: ClassificationSearchResult[] = []

  function walk(node: IndustryTreeNode, ancestry: string[]) {
    if (results.length >= 30) return
    const path = [...ancestry, node.nodeId]
    if (!isNumeric && node.label.includes(trimmed)) {
      results.push({ kind: 'group', label: `${node.label}（分類）`, path })
    }
    for (const member of node.members) {
      if (results.length >= 30) return
      const matches = isNumeric ? member.symbol.startsWith(trimmed) : member.companyName.includes(trimmed)
      if (matches) results.push({ kind: 'company', label: `${member.symbol}　${member.companyName}`, path, symbol: member.symbol })
    }
    for (const child of node.children) {
      if (results.length >= 30) return
      walk(child, path)
    }
  }

  for (const root of data.roots) walk(root, [])
  return results
}

// ============================================================================
// Search — reveal, don't require picking a suggestion (see git history for why: a live report
// that clicking a dropdown suggestion sometimes silently did nothing).
// ============================================================================

const keyword = ref('')

async function expandPath(treeRef: TreeInstance | undefined, path: string[]) {
  let lastNode: ReturnType<TreeInstance['getNode']> | undefined
  for (const code of path) {
    const node = treeRef?.getNode(code)
    if (!node) continue
    lastNode = node
    if (!node.isLeaf && !node.expanded) await new Promise<void>(resolve => node.expand(resolve, true))
  }
  return lastNode
}

function scrollToKey(treeRef: TreeInstance | undefined, key: string) {
  nextTick(() => {
    treeRef?.$el.querySelector(`[data-key="${key}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  })
}

async function revealInTree(treeRef: TreeInstance | undefined, path: string[], targetKey: string) {
  const lastFoundAncestor = await expandPath(treeRef, path)
  const targetNode = treeRef?.getNode(targetKey) ?? lastFoundAncestor
  if (!targetNode) return
  if (!targetNode.isLeaf && !targetNode.expanded) await new Promise<void>(resolve => targetNode.expand(resolve, true))
  treeRef?.setCurrentKey(targetNode.data.code)
  scrollToKey(treeRef, targetNode.data.code)
}

let debounceTimer: ReturnType<typeof setTimeout> | undefined
watch(keyword, value => {
  if (debounceTimer) clearTimeout(debounceTimer)
  const trimmed = value.trim()
  if (!trimmed) return
  debounceTimer = setTimeout(async () => {
    const results = searchClassification(trimmed, tree.value)
    if (results.length > 0) {
      const result = results[0]!
      await revealInTree(classificationTreeRef.value, result.path, result.kind === 'company' ? `co:${result.symbol}` : result.path[result.path.length - 1]!)
    }
  }, 300)
})
</script>

<template>
  <div class="industries-page">
    <h1 class="industries-page__title">產業追蹤</h1>

    <p class="industries-page__subtitle">
      依真實供應鏈關係分類（資料來源：產業研究報告解析），與個股頁的證交所產業分類是不同的兩套系統，不能互相對照
    </p>

    <el-input v-model="keyword" class="industries-page__search" placeholder="搜尋股票代號、公司名稱或分類，例如 1435 或 半導體" clearable>
      <template #prefix>
        <el-icon><Search /></el-icon>
      </template>
    </el-input>

    <div v-if="classificationTreeData.length > 0" class="industries-page__tree-scroll">
      <el-tree
        ref="classificationTreeRef"
        v-loading="classificationPending"
        :data="classificationTreeData"
        node-key="code"
        highlight-current
        :props="classificationTreeProps"
      >
        <template #default="{ data: nodeData }">
          <NuxtLink
            v-if="(nodeData as ClassificationNodeData).kind === 'company'"
            :to="`/stock/${(nodeData as CompanyNodeData).symbol}`"
            class="industries-page__node industries-page__node--link"
          >
            <el-icon class="industries-page__node-icon"><OfficeBuilding /></el-icon>
            {{ nodeData.label }}
          </NuxtLink>
          <span v-else class="industries-page__node">
            <el-icon class="industries-page__node-icon"><Folder /></el-icon>
            {{ nodeData.label }}
          </span>
        </template>
      </el-tree>
    </div>
    <el-empty v-else-if="!classificationPending" description="目前查無產業分類資料" :image-size="64" />
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
  margin: 0 0 20px;
}

.industries-page__search {
  width: 100%;
  max-width: 420px;
  margin-bottom: 16px;
}

/* 280 節點的樹狀圖沒有高度限制時會把整個頁面撐得非常長，捲動體驗很差——限制卡片本身的高度、
   讓樹狀內容自己捲動，比照大部分產業/分類瀏覽 UI 的慣例。 */
.industries-page__tree-scroll {
  max-height: 640px;
  overflow-y: auto;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  padding: 8px;
}

.industries-page__node {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 16px;
}

/* 公司節點改成真的 <a href> — per直接要求（"每間公司節點要用 anchor 去放連結，這樣我滑鼠才可以
   右鍵選擇在新分頁打開"），瀏覽器原生的右鍵選單/中鍵點擊/Ctrl+點擊都要能用，不能只靠 JS
   onClick 模擬導航（那樣右鍵選單只會看到「檢查」，沒有「在新分頁開啟連結」）。顏色/底線故意
   跟旁邊的資料夾列一致（color:inherit、no underline），只在 hover 時才顯出連結感，避免看起來
   像整棵樹只有公司列被特別強調。 */
.industries-page__node--link {
  color: inherit;
  text-decoration: none;
}

.industries-page__node--link:hover {
  text-decoration: underline;
}

.industries-page__node-icon {
  color: var(--el-text-color-placeholder);
}
</style>
