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

const sections = computed(() => [
  {
    title: '公司資訊',
    fields: [
      ['公司名稱', props.profile.name],
      ['簡稱', props.profile.shortName],
      ['英文簡稱', props.profile.englishShortName],
      ['產業別', props.profile.industry],
      ['統一編號', props.profile.taxId],
      ['成立日期', formatDate(props.profile.establishedDate)],
      ['上市日期', formatDate(props.profile.listedDate)],
      ['外國企業註冊地', props.profile.foreignRegistrationCountry ?? '—']
    ]
  },
  {
    title: '經營團隊',
    fields: [
      ['董事長', props.profile.chairman],
      ['總經理', props.profile.generalManager],
      [`發言人（${props.profile.spokespersonTitle}）`, props.profile.spokesperson],
      ['代理發言人', props.profile.deputySpokesperson ?? '—']
    ]
  },
  {
    title: '聯絡資訊',
    fields: [
      ['地址', props.profile.address],
      ['英文地址', props.profile.englishAddress],
      ['電話', props.profile.phone],
      ['傳真', props.profile.faxNumber ?? '—'],
      ['Email', props.profile.email ?? '—'],
      ['網站', props.profile.website ?? '—']
    ]
  },
  {
    title: '股務資訊',
    fields: [
      ['財報類別', props.profile.financialReportType],
      ['面額', props.profile.parValue ? `${props.profile.parValue} 元` : '—'],
      ['實收資本額', formatCapital(props.profile.paidInCapital)],
      ['已發行股數', formatShares(props.profile.issuedShares)],
      ['私募股數', formatShares(props.profile.privatePlacementShares)],
      ['特別股股數', formatShares(props.profile.preferredStockShares)],
      ['股務代理機構', props.profile.stockTransferAgency],
      ['股務代理電話', props.profile.transferAgencyPhone],
      ['股務代理地址', props.profile.transferAgencyAddress]
    ]
  },
  {
    title: '簽證會計師',
    fields: [
      ['簽證會計師事務所', props.profile.auditingFirm],
      ['簽證會計師', [props.profile.auditor1, props.profile.auditor2].filter(Boolean).join('、')]
    ]
  }
])
</script>

<template>
  <el-card class="profile-card" shadow="never">
    <template #header>
      <span class="profile-card__title">公司詳細資料</span>
    </template>

    <div v-for="section in sections" :key="section.title" class="profile-card__section">
      <p class="profile-card__section-title">{{ section.title }}</p>
      <div class="profile-card__grid">
        <div v-for="[label, value] in section.fields" :key="label" class="profile-card__field">
          <span class="profile-card__label">{{ label }}</span>
          <span class="profile-card__value">{{ value }}</span>
        </div>
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

.profile-card__section + .profile-card__section {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.profile-card__section-title {
  margin: 0 0 12px;
  font-size: 13px;
  font-weight: 600;
  color: var(--el-color-primary);
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

.profile-card__label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.profile-card__value {
  font-size: 14px;
  overflow-wrap: break-word;
}
</style>
