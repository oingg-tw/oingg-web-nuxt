<script setup lang="ts">
import { Folder, OfficeBuilding, Search } from '@element-plus/icons-vue'
import type { TreeInstance } from 'element-plus'
import type { IndustryChainCompany, IndustryChainClassification } from '~/composables/industries/useIndustryChainClassification'
import type { IndustryCluster, IndustryClusterMember, IndustryChainClusters } from '~/composables/industries/useIndustryChainClusters'

// 產業追蹤 — REBUILT 2026-09-14 per direct request ("產業追蹤還是要的，只是接新的API"): same
// page, migrated off gov-ts's 財政部稅籍行業標準分類 (the old 5-level lazy-loaded tree) onto
// oingg-playwright-py's real supply-chain data, now as TWO independent tabs per direct request
// ("在現有 /industries 頁面加切換 tab（分類/聚落）"):
//   分類 (classification) — same product category (GET /industries/chain-classification),
//     coarseGroup → category → company, unchanged from the same-day rebuild earlier.
//   聚落 (clusters) — companies that actually TRADE with each other on the real supply-chain
//     graph (GET /industries/chain-clusters, Louvain/dendrogram community detection), cluster →
//     sub-cluster → member. Genuinely different axis from 分類 (same category ≠ real trading
//     relationship, see useIndustryChainClusters.ts's own comment) — neither replaces the other.
const router = useRouter()
const activeView = ref<'分類' | '聚落'>('分類')

// ============================================================================
// 分類 (classification) — unchanged from the earlier same-day rebuild
// ============================================================================

const { ensureLoaded: ensureClassificationLoaded, pending: classificationPending } = useIndustryChainClassification()

interface GroupNodeData {
  kind: 'group'
  code: string
  label: string
  children: CategoryNodeData[]
}

interface CategoryNodeData {
  kind: 'category'
  code: string
  label: string
  children: CompanyNodeData[]
}

interface CompanyNodeData {
  kind: 'company'
  code: string
  label: string
  symbol: string
}

type ClassificationNodeData = GroupNodeData | CategoryNodeData | CompanyNodeData

const UNCLASSIFIED_GROUP_CODE = '__unclassified__'

function companyNode(company: IndustryChainCompany): CompanyNodeData {
  return { kind: 'company', code: `co:${company.symbol}`, label: `${company.symbol}　${company.companyName}`, symbol: company.symbol }
}

// 271 of 1984 companies currently have no classification at all (confirmed live via bff-ts) —
// bucketed into their own "尚未分類" top-level node rather than silently dropped from the tree,
// same "don't hide real data gaps" discipline as every other empty/insufficient state in this app.
function buildClassificationTree(data: IndustryChainClassification): GroupNodeData[] {
  const companiesByCategory = new Map<string, IndustryChainCompany[]>()
  const unclassified: IndustryChainCompany[] = []
  for (const company of data.companies) {
    if (company.category === null) {
      unclassified.push(company)
      continue
    }
    const list = companiesByCategory.get(company.category) ?? []
    list.push(company)
    companiesByCategory.set(company.category, list)
  }

  const groupNodes: GroupNodeData[] = data.groups
    .map(group => {
      const categoryNodes: CategoryNodeData[] = group.fineCategories
        .map((category): CategoryNodeData | null => {
          const companies = companiesByCategory.get(category)
          if (!companies || companies.length === 0) return null
          return { kind: 'category', code: category, label: `${category}（${companies.length}）`, children: companies.map(companyNode) }
        })
        .filter((node): node is CategoryNodeData => node !== null)
      const totalCompanies = categoryNodes.reduce((sum, node) => sum + node.children.length, 0)
      return { kind: 'group' as const, code: group.coarseGroup, label: `${group.coarseGroup}（${totalCompanies}）`, children: categoryNodes }
    })
    .filter(group => group.children.length > 0)

  if (unclassified.length > 0) {
    groupNodes.push({
      kind: 'group',
      code: UNCLASSIFIED_GROUP_CODE,
      label: `尚未分類（${unclassified.length}）`,
      children: [{ kind: 'category', code: UNCLASSIFIED_GROUP_CODE, label: `尚未分類（${unclassified.length}）`, children: unclassified.map(companyNode) }]
    })
  }

  return groupNodes
}

const classification = ref<IndustryChainClassification>({ companies: [], groups: [] })
const classificationTreeData = ref<GroupNodeData[]>([])

onMounted(async () => {
  classification.value = await ensureClassificationLoaded()
  classificationTreeData.value = buildClassificationTree(classification.value)
})

function handleClassificationNodeClick(nodeData: ClassificationNodeData) {
  if (nodeData.kind === 'company') router.push(`/stock/${nodeData.symbol}`)
}

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
  kind: 'company' | 'category' | 'group'
  label: string
  path: string[]
  symbol?: string
}

function searchClassification(query: string, data: IndustryChainClassification): ClassificationSearchResult[] {
  const trimmed = query.trim()
  if (!trimmed) return []
  const isNumeric = /^\d+$/.test(trimmed)
  const results: ClassificationSearchResult[] = []
  const seenCodes = new Set<string>()

  for (const company of data.companies) {
    if (results.length >= 30) break
    const matchesCompany = isNumeric ? company.symbol.startsWith(trimmed) : company.companyName.includes(trimmed)
    if (matchesCompany) {
      const group = company.coarseGroup ?? UNCLASSIFIED_GROUP_CODE
      const category = company.category ?? UNCLASSIFIED_GROUP_CODE
      results.push({ kind: 'company', label: `${company.symbol}　${company.companyName}`, path: [group, category], symbol: company.symbol })
    }
  }

  if (!isNumeric) {
    for (const group of data.groups) {
      if (results.length >= 30) break
      if (group.coarseGroup.includes(trimmed) && !seenCodes.has(group.coarseGroup)) {
        seenCodes.add(group.coarseGroup)
        results.push({ kind: 'group', label: `${group.coarseGroup}（分類）`, path: [group.coarseGroup] })
      }
      for (const category of group.fineCategories) {
        if (results.length >= 30) break
        if (category.includes(trimmed) && !seenCodes.has(category)) {
          seenCodes.add(category)
          results.push({ kind: 'category', label: `${category}（分類）`, path: [group.coarseGroup, category] })
        }
      }
    }
  }

  return results
}

// Freshness note — deliberately vague per analysis-ts's own caution ("不要暗示是即時同步"): the
// classification cache is loaded once at analysis-ts's own server startup with no scheduled
// refresh, so `updatedAt` reflects when a company's classification last changed, not when this
// app last synced with it. Uses the single most-recent updatedAt across all companies as a rough
// "as of" marker rather than claiming a precise sync time.
const latestClassificationUpdatedAt = computed(() => {
  const dates = classification.value.companies.map(company => company.updatedAt).filter((date): date is string => date !== null)
  return dates.length > 0 ? dates.sort().at(-1)! : null
})

// ============================================================================
// 聚落 (clusters) — real supply-chain trading relationships, added 2026-09-14
// ============================================================================

const { ensureLoaded: ensureClustersLoaded, pending: clustersPending } = useIndustryChainClusters()

interface MetaGroupNodeData {
  kind: 'meta'
  code: string
  label: string
  children: ClusterTopNodeData[]
}

interface ClusterTopNodeData {
  kind: 'cluster'
  code: string
  label: string
  children: ClusterMemberNodeData[]
}

interface ClusterMemberNodeData {
  kind: 'member'
  code: string
  label: string
  symbol: string
  isListed: boolean
}

type ClusterNodeData = MetaGroupNodeData | ClusterTopNodeData | ClusterMemberNodeData

const UNKNOWN_META_GROUP = '其他'

// `isListed: false` nodes (confirmed live: ~5,654 of ~7,566 total — Apple/Nvidia-style
// international supply-chain participants) have no stock-detail page on this site — labeled
// distinctly (dimmed, no code prefix) rather than shown as if they were a real TWSE/TPEx symbol,
// and never navigated to on click (see handleClusterNodeClick below).
function clusterMemberNode(member: IndustryClusterMember): ClusterMemberNodeData {
  return {
    kind: 'member',
    code: `mem:${member.code}`,
    label: member.isListed ? `${member.code}　${member.name}` : `${member.name}（非上市櫃）`,
    symbol: member.code,
    isListed: member.isListed
  }
}

// 3-level tree since 2026-09-15 (metaGroup added — see useIndustryChainClusters.ts's own
// comment): metaGroup → cluster → member. Added specifically because 233 flat top-level clusters,
// while the el-tree itself handles that fine (confirmed live, see git history), was still a real
// cognitive-load problem for a user who browses instead of searching — playwright-py corrected
// their own earlier "meta-cluster isn't necessary" call once they re-checked against actual HCI
// decision-fatigue research, not just our UI's technical tolerance for a long list.
//
// Grouped client-side (not requested as pre-grouped from the API) since IndustryCluster is still
// a flat array with its own metaGroup field, same shape every other client-built tree in this
// file already handles. Null metaGroup (0/233 confirmed live, but the type stays nullable — see
// that field's own comment) buckets into UNKNOWN_META_GROUP, same "don't hide a real data gap"
// discipline as buildClassificationTree()'s own unclassified bucket.
function buildClusterTree(data: IndustryChainClusters): MetaGroupNodeData[] {
  const clustersByMetaGroup = new Map<string, IndustryCluster[]>()
  for (const cluster of data.clusters) {
    const key = cluster.metaGroup ?? UNKNOWN_META_GROUP
    const list = clustersByMetaGroup.get(key) ?? []
    list.push(cluster)
    clustersByMetaGroup.set(key, list)
  }

  return Array.from(clustersByMetaGroup.entries())
    .map(([metaGroup, clustersInGroup]): MetaGroupNodeData | null => {
      const clusterNodes = clustersInGroup
        .map((cluster): ClusterTopNodeData | null => {
          const memberNodes = cluster.directMembers.map(clusterMemberNode)
          if (memberNodes.length === 0) return null
          return { kind: 'cluster', code: `cl:${cluster.clusterId}`, label: `${cluster.label}（${memberNodes.length}）`, children: memberNodes }
        })
        .filter((node): node is ClusterTopNodeData => node !== null)
      if (clusterNodes.length === 0) return null
      const totalMembers = clusterNodes.reduce((sum, node) => sum + node.children.length, 0)
      return { kind: 'meta', code: `meta:${metaGroup}`, label: `${metaGroup}（${totalMembers}）`, children: clusterNodes }
    })
    .filter((node): node is MetaGroupNodeData => node !== null)
    .sort((a, b) => b.children.length - a.children.length)
}

const clusters = ref<IndustryChainClusters>({ clusters: [] })
const clusterTreeData = ref<MetaGroupNodeData[]>([])
const clustersLoaded = ref(false)

// Lazy-loaded only once the 聚落 tab is actually opened — no reason to fetch a second, genuinely
// large (~8,000-member) payload for every visitor who only ever looks at 分類.
watch(activeView, async view => {
  if (view !== '聚落' || clustersLoaded.value) return
  clustersLoaded.value = true
  clusters.value = await ensureClustersLoaded()
  clusterTreeData.value = buildClusterTree(clusters.value)
}, { immediate: true })

function handleClusterNodeClick(nodeData: ClusterNodeData) {
  if (nodeData.kind === 'member' && nodeData.isListed) router.push(`/stock/${nodeData.symbol}`)
}

const clusterTreeProps = {
  label: 'label',
  children: 'children',
  isLeaf: (data: unknown) => (data as ClusterNodeData).kind === 'member'
}

// Moved out of the inline `:class` template binding for the same reason as `treeProps` above —
// a compound expression chaining two `as` casts through `&&` inside an attribute binding is
// also a real template-compiler syntax error (confirmed live: 500 "Unexpected identifier 'text'"),
// not just a style choice.
function isUnlistedMemberNode(data: unknown): boolean {
  const node = data as ClusterNodeData
  return node.kind === 'member' && !node.isListed
}

const clusterTreeRef = ref<TreeInstance>()

interface ClusterSearchResult {
  kind: 'member' | 'cluster'
  label: string
  path: string[]
  symbol?: string
}

function searchClusters(query: string, data: IndustryChainClusters): ClusterSearchResult[] {
  const trimmed = query.trim()
  if (!trimmed) return []
  const isNumeric = /^\d+$/.test(trimmed)
  const results: ClusterSearchResult[] = []

  for (const cluster of data.clusters) {
    if (results.length >= 30) break
    const metaCode = `meta:${cluster.metaGroup ?? UNKNOWN_META_GROUP}`
    const clusterCode = `cl:${cluster.clusterId}`
    for (const member of cluster.directMembers) {
      if (results.length >= 30) break
      const matches = isNumeric ? member.code.startsWith(trimmed) : member.name.includes(trimmed)
      if (matches) results.push({ kind: 'member', label: member.isListed ? `${member.code}　${member.name}` : `${member.name}（非上市櫃）`, path: [metaCode, clusterCode], symbol: member.code })
    }
  }

  return results
}

// ============================================================================
// Search — shared reveal mechanics (generic over either tree), scoped to whichever tab is
// active. Same "reveal, don't require picking a suggestion" behavior as before (see git history
// for why: a live report that clicking a dropdown suggestion sometimes silently did nothing).
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
    if (activeView.value === '分類') {
      const results = searchClassification(trimmed, classification.value)
      if (results.length > 0) {
        const result = results[0]!
        await revealInTree(classificationTreeRef.value, result.path, result.kind === 'company' ? `co:${result.symbol}` : result.path[result.path.length - 1]!)
      }
    } else {
      const results = searchClusters(trimmed, clusters.value)
      if (results.length > 0) {
        const result = results[0]!
        await revealInTree(clusterTreeRef.value, result.path, `mem:${result.symbol}`)
      }
    }
  }, 300)
})

const searchPlaceholder = computed(() =>
  activeView.value === '分類' ? '搜尋股票代號、公司名稱或分類，例如 1435 或 半導體' : '搜尋股票代號或公司名稱，例如 1435 或 台積電'
)
</script>

<template>
  <div class="industries-page">
    <h1 class="industries-page__title">產業追蹤</h1>

    <el-radio-group v-model="activeView" class="industries-page__view-switch">
      <el-radio-button label="分類" value="分類" />
      <el-radio-button label="聚落" value="聚落" />
    </el-radio-group>

    <template v-if="activeView === '分類'">
      <p class="industries-page__subtitle">
        依真實供應鏈關係分類（資料來源：產業研究報告解析），與個股頁的證交所產業分類是不同的兩套系統，不能互相對照
      </p>
      <p v-if="latestClassificationUpdatedAt" class="industries-page__freshness">分類資料最後更新：{{ latestClassificationUpdatedAt }}（非即時同步）</p>
    </template>
    <p v-else class="industries-page__subtitle">
      依真實供應鏈交易關係聚類（同一聚落內的公司彼此有實際往來，不代表同產業）——聚落編號每次重新分群都會變動，僅供本次瀏覽參考，不可收藏或分享連結
    </p>

    <el-input v-model="keyword" class="industries-page__search" :placeholder="searchPlaceholder" clearable>
      <template #prefix>
        <el-icon><Search /></el-icon>
      </template>
    </el-input>

    <el-tree
      v-if="activeView === '分類' && classificationTreeData.length > 0"
      ref="classificationTreeRef"
      v-loading="classificationPending"
      :data="classificationTreeData"
      node-key="code"
      highlight-current
      :props="classificationTreeProps"
      @node-click="handleClassificationNodeClick"
    >
      <template #default="{ data: nodeData }">
        <span class="industries-page__node">
          <el-icon class="industries-page__node-icon">
            <OfficeBuilding v-if="(nodeData as ClassificationNodeData).kind === 'company'" />
            <Folder v-else />
          </el-icon>
          {{ nodeData.label }}
        </span>
      </template>
    </el-tree>
    <el-empty v-else-if="activeView === '分類' && !classificationPending" description="目前查無產業分類資料" :image-size="64" />

    <el-tree
      v-if="activeView === '聚落' && clusterTreeData.length > 0"
      ref="clusterTreeRef"
      v-loading="clustersPending"
      :data="clusterTreeData"
      node-key="code"
      highlight-current
      :props="clusterTreeProps"
      @node-click="handleClusterNodeClick"
    >
      <template #default="{ data: nodeData }">
        <span class="industries-page__node" :class="{ 'industries-page__node--unlisted': isUnlistedMemberNode(nodeData) }">
          <el-icon class="industries-page__node-icon">
            <OfficeBuilding v-if="(nodeData as ClusterNodeData).kind === 'member'" />
            <Folder v-else />
          </el-icon>
          {{ nodeData.label }}
        </span>
      </template>
    </el-tree>
    <el-empty v-else-if="activeView === '聚落' && !clustersPending" description="目前查無產業聚落資料" :image-size="64" />
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

.industries-page__view-switch {
  margin-bottom: 12px;
}

.industries-page__subtitle {
  font-size: 16px;
  color: var(--el-text-color-secondary);
  margin: 0 0 4px;
}

.industries-page__freshness {
  font-size: 16px;
  color: var(--el-text-color-placeholder);
  margin: 0 0 20px;
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

.industries-page__node--unlisted {
  color: var(--el-text-color-placeholder);
  cursor: default;
}

.industries-page__node-icon {
  color: var(--el-text-color-placeholder);
}
</style>
