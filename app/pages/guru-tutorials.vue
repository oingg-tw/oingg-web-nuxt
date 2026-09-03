<script setup lang="ts">
import { Plus } from '@element-plus/icons-vue'
// Runtime values (GURUS, GURU_INDICATORS, GURU_INDICATOR_MAP, RADAR_AXES, computeAxisValues)
// come from Nuxt's utils/ auto-import same as APP_FEATURES/riverColors elsewhere in this app
// — only the TYPES need an explicit import here, since that auto-import isn't guaranteed to
// cover type-only exports the same way.
import type { Guru, GuruIndicator } from '~/utils/guru-radar-data'

// Design idea (user, 2026-09-03), refined across several rounds — see
// project_guru_zone_radar_chart_idea memory for the full history. Short version: this radar
// never scores a COMPANY. It scores which analytical axes the currently-selected indicator
// set covers (guru-radar-data.ts's own `computeAxisValues`) — a static field→axis weight sum,
// not a live per-stock computation, so there's no fabrication risk and no compliance question
// at this stage (that question only starts once this gets applied to real watchlist holdings,
// a separate phase gated on multi-watchlist support not existing yet — see the memory).
//
// Character-select layout (left: guru avatars, right: that guru's own starting indicators,
// editable) was the user's own second design intuition, chosen over a plain tab switcher —
// picking a guru just seeds indicatorKeys with GURUS' own starting list; nothing below this
// point treats that starting set as fixed. "還可以再加指標，雷達圖跟著變形" is why
// selectedIndicatorKeys is independent local state, not a computed straight off the active
// guru.
const activeGuruKey = ref(GURUS[0]!.key)
const activeGuru = computed(() => GURUS.find(guru => guru.key === activeGuruKey.value) ?? GURUS[0]!)

const selectedIndicatorKeys = ref<string[]>([...activeGuru.value.indicatorKeys])

function selectGuru(guru: Guru) {
  activeGuruKey.value = guru.key
  selectedIndicatorKeys.value = [...guru.indicatorKeys]
}

const selectedIndicators = computed(() =>
  selectedIndicatorKeys.value.map(key => GURU_INDICATOR_MAP[key]).filter((indicator): indicator is GuruIndicator => !!indicator)
)

// Offered in "add indicator" — the catalog minus whatever's already on the radar, so the same
// indicator can't be added twice.
const availableIndicators = computed(() =>
  GURU_INDICATORS.filter(indicator => !selectedIndicatorKeys.value.includes(indicator.key))
)

function addIndicator(key: string) {
  if (selectedIndicatorKeys.value.includes(key)) return
  selectedIndicatorKeys.value = [...selectedIndicatorKeys.value, key]
}

function removeIndicator(key: string) {
  selectedIndicatorKeys.value = selectedIndicatorKeys.value.filter(existing => existing !== key)
}

const radarAxes = computed(() => {
  const values = computeAxisValues(selectedIndicatorKeys.value)
  return RADAR_AXES.map((axis, index) => ({ label: axis.label, value: values[index] ?? 0 }))
})
</script>

<template>
  <div class="guru-tutorials-page">
    <h1 class="guru-tutorials-page__title">
      <el-icon class="guru-tutorials-page__icon"><SharedIconHexagon /></el-icon>
      大師指標
    </h1>
    <p class="guru-tutorials-page__subtitle">
      選一位大師,看看他常用的指標框架涵蓋哪些分析面向——以下呈現的是指標本身的組成,不是任何一檔股票的評分或建議
    </p>

    <div class="guru-tutorials-page__layout">
      <!-- Left: character select. Plain el-avatar initials, not fabricated portraits — this
           app doesn't have (and shouldn't invent) real likenesses for historical/public
           investors, and a name-initial avatar already reads clearly enough at this size. -->
      <div class="guru-tutorials-page__roster">
        <button
          v-for="guru in GURUS"
          :key="guru.key"
          type="button"
          class="guru-tutorials-page__guru"
          :class="{ 'is-active': guru.key === activeGuruKey }"
          @click="selectGuru(guru)"
        >
          <el-avatar :size="48" class="guru-tutorials-page__avatar">{{ guru.name.slice(0, 2) }}</el-avatar>
          <span class="guru-tutorials-page__guru-name">{{ guru.name }}</span>
        </button>
      </div>

      <!-- Right: selected guru's own framing + editable indicator chip list. -->
      <div class="guru-tutorials-page__detail">
        <p class="guru-tutorials-page__tagline">{{ activeGuru.tagline }}</p>

        <div class="guru-tutorials-page__indicators">
          <el-tag
            v-for="indicator in selectedIndicators"
            :key="indicator.key"
            closable
            size="large"
            @close="removeIndicator(indicator.key)"
          >
            {{ indicator.label }}
          </el-tag>

          <el-popover placement="bottom-start" width="240" trigger="click">
            <template #reference>
              <el-button :icon="Plus" size="small" text>加入指標</el-button>
            </template>
            <div class="guru-tutorials-page__add-list">
              <p v-if="!availableIndicators.length" class="guru-tutorials-page__add-empty">已加入全部指標</p>
              <button
                v-for="indicator in availableIndicators"
                :key="indicator.key"
                type="button"
                class="guru-tutorials-page__add-item"
                @click="addIndicator(indicator.key)"
              >
                {{ indicator.label }}
              </button>
            </div>
          </el-popover>
        </div>

        <GuruTutorialsMoleculeRadarChart :axes="radarAxes" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.guru-tutorials-page {
  width: 100%;
}

.guru-tutorials-page__title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 20px;
  font-weight: 600;
  margin: 0 0 16px;
}

.guru-tutorials-page__icon {
  color: var(--el-color-primary);
}

.guru-tutorials-page__subtitle {
  font-size: 16px;
  color: var(--el-text-color-secondary);
  margin: -8px 0 24px;
}

.guru-tutorials-page__layout {
  display: flex;
  gap: 24px;
  align-items: flex-start;
}

.guru-tutorials-page__roster {
  flex: 0 0 160px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.guru-tutorials-page__guru {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 12px 8px;
  border: none;
  background: transparent;
  border-radius: 12px;
  cursor: pointer;
  color: var(--el-text-color-regular);
}

.guru-tutorials-page__guru:hover {
  background: var(--el-fill-color-light);
}

.guru-tutorials-page__guru.is-active {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  font-weight: 600;
}

.guru-tutorials-page__avatar {
  background: var(--el-color-primary);
  color: #fff;
  flex-shrink: 0;
}

.guru-tutorials-page__guru-name {
  font-size: 16px;
  text-align: center;
}

.guru-tutorials-page__detail {
  flex: 1;
  min-width: 0;
}

.guru-tutorials-page__tagline {
  margin: 0 0 16px;
  font-size: 16px;
  color: var(--el-text-color-secondary);
}

.guru-tutorials-page__indicators {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 24px;
}

.guru-tutorials-page__add-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 240px;
  overflow-y: auto;
}

.guru-tutorials-page__add-item {
  text-align: left;
  padding: 8px 10px;
  border: none;
  background: transparent;
  border-radius: 6px;
  cursor: pointer;
  font-size: 16px;
  color: var(--el-text-color-regular);
}

.guru-tutorials-page__add-item:hover {
  background: var(--el-fill-color-light);
  color: var(--el-color-primary);
}

.guru-tutorials-page__add-empty {
  margin: 0;
  padding: 8px 10px;
  font-size: 16px;
  color: var(--el-text-color-placeholder);
}

@media (max-width: 640px) {
  .guru-tutorials-page__layout {
    flex-direction: column;
  }

  .guru-tutorials-page__roster {
    flex-direction: row;
    flex-wrap: wrap;
    width: 100%;
  }

  .guru-tutorials-page__guru {
    flex: 1 1 30%;
  }
}
</style>
