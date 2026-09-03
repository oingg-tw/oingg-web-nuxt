<script setup lang="ts">
// Plain hexagon glyph — no icon library ships one (checked @element-plus/icons-vue's full
// set). Same viewBox convention as Element Plus's own icons (0 0 1024 1024) so it drops into
// <el-icon> and sizes exactly like a real Element Plus icon would, but hollow (stroke only,
// fill="none") per explicit request rather than Element Plus's own usual solid-fill style —
// a deliberate, one-off deviation, not a mistake.
// Pointy-top orientation (vertex at 12 o'clock) — this is also literally the shape a 6-axis
// radar chart's outer ring traces when the axes are evenly spaced starting from straight up,
// which is the guru-tutorials.vue use case this was drawn for.
</script>

<template>
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
    <polygon
      fill="none"
      stroke="currentColor"
      stroke-width="64"
      stroke-linejoin="round"
      points="512,92 876,302 876,722 512,932 148,722 148,302"
    />
  </svg>
</template>
