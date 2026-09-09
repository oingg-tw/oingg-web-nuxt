<script setup lang="ts">
import { Folder, OfficeBuilding } from '@element-plus/icons-vue'
import type { LoadFunction } from 'element-plus'
import type { IndustryTreeChild } from '~/composables/industries/useIndustryTree'

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

// node-key uses `code`, which must be unique across BOTH node kinds sharing this tree — category
// codes (section letters/division-group-class digit strings/subclass "nnnn-nn") and company
// symbols never collide in practice, but prefixed here defensively rather than relying on that.
const loadNode: LoadFunction = async (node, resolve) => {
  if (node.level === 0) {
    const root = await load(undefined)
    resolve(buildCategoryNodes(root?.children ?? []))
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
  } else if (result.children.length > 0) {
    resolve(buildCategoryNodes(result.children))
  } else if (result.companies.length > 0) {
    resolve(
      result.companies.map(company => ({
        kind: 'company',
        code: `co:${company.symbol}`,
        label: `${company.symbol}　${company.companyName}`,
        symbol: company.symbol,
        isLeaf: true
      }))
    )
  } else {
    resolve([])
  }
}

function handleNodeClick(nodeData: IndustryNodeData) {
  if (nodeData.kind === 'company') router.push(`/stock/${nodeData.symbol}`)
}
</script>

<template>
  <div class="industries-page">
    <h1 class="industries-page__title">產業追蹤</h1>
    <p class="industries-page__subtitle">
      依台灣稅籍登記行業分類逐層展開——與個股頁的證交所產業分類是不同的兩套系統，不能互相對照
    </p>

    <el-tree lazy node-key="code" :load="loadNode" :props="{ label: 'label', isLeaf: 'isLeaf' }" @node-click="handleNodeClick">
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
