<script setup lang="ts">
import type { NormalizedCompanyProfile } from '~/composables/stock/useCompanyProfile'

const props = defineProps<{
  profile: NormalizedCompanyProfile
}>()

function formatDate(date: Date | null) {
  if (!date) return '—'
  return date.toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

function formatShares(value: bigint | null) {
  if (value === null) return '—'
  return `${Number(value).toLocaleString('zh-TW')} 股`
}

function formatCapital(value: bigint | null) {
  if (value === null) return '—'
  return `${(Number(value) / 1e8).toLocaleString('zh-TW', { maximumFractionDigits: 2 })} 億元`
}

// Cut from 27 fields (5 sections) down to 9 (one flat list) — 2026-09-02, per direct user
// request applying first-principles reasoning to "does this actually help a retirement
// investor decide anything about this stock". Removed entirely: 公司名稱/簡稱 (already on
// StockSummaryCard above this card — same-page duplication), 英文簡稱/英文地址/電話/傳真/
// Email/網站/統一編號 (contact-directory info, not investment-decision input), 董事長/總經理/
// 發言人/代理發言人 (a bare name has no actionable signal without external research — this
// product does financial decision-support, not a corporate-officer lookup), 財報類別/面額
// (near-constant across TW listings, no discriminating value), 股務代理機構/電話/地址
// (administrative — relevant only to someone handling paper share certificates, not
// evaluating whether to hold the stock), 簽證會計師 individual name (the FIRM is a real
// trust/fraud-risk signal per docs/investment-knowledge/財務諸表の主要投資指標ガイド.md's Beneish M-Score
// discussion; the specific person who signed it isn't, on its own).
// Kept because each answers a real question a retirement investor would ask: 產業別
// (diversification context), 成立日期/上市日期 (track record depth — see
// docs/investment-knowledge/基本面財報觀察年限分析.md on why a longer operating history matters), 外國企業註冊地
// (KY-stock risk flag, ties directly to the KY 股專區 checklist), 實收資本額/已發行股數/
// 私募股數/特別股股數 (capital structure and dilution-history signals), 簽證會計師事務所
// (audit-quality/trust signal).
const fields = computed<[string, string][]>(() => [
  ['產業別', props.profile.industryName ?? '—'],
  ['成立日期', formatDate(props.profile.establishedDate)],
  ['上市日期', formatDate(props.profile.listedDate)],
  ['外國企業註冊地', props.profile.foreignRegistrationCountry ?? '—'],
  ['實收資本額', formatCapital(props.profile.paidInCapital)],
  ['已發行股數', formatShares(props.profile.issuedShares)],
  ['私募股數', formatShares(props.profile.privatePlacementShares)],
  ['特別股股數', formatShares(props.profile.preferredStockShares)],
  ['簽證會計師事務所', props.profile.auditingFirm]
])
</script>

<template>
  <el-card class="profile-card" shadow="never">
    <template #header>
      <span class="profile-card__title">公司基本資訊</span>
    </template>

    <div class="profile-card__grid">
      <div v-for="[label, value] in fields" :key="label" class="profile-card__field">
        <span class="profile-card__label">{{ label }}</span>
        <span class="profile-card__value">{{ value }}</span>
      </div>
    </div>
  </el-card>
</template>

<style scoped>
.profile-card {
  border-radius: 12px;
}

.profile-card__title {
  font-weight: 600;
}

.profile-card__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px 16px;
}

.profile-card__field {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

/* 16px per docs/ui-ux/accessibility-guidelines.md §1.1 (site-wide floor, no exceptions for new/
   touched components) — was 12px/14px pre-existing, fixed while this file was already being
   rewritten. Label vs. value stays visually distinguished by color, not size (same principle
   as that doc's §1.1.2 guidance for sub-16px heading levels). */
.profile-card__label {
  font-size: 16px;
  color: var(--el-text-color-secondary);
}

.profile-card__value {
  font-size: 16px;
  overflow-wrap: break-word;
}
</style>
