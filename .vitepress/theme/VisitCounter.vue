<script setup lang="ts">
import { onMounted, ref } from 'vue'

const visit = ref<number | null>(null)
const COUNTER_URL = 'https://tally.yuki.sh/hits/bruke/UnityLearn.json'

async function load() {
  if (typeof window === 'undefined') return
  const increment = window.location.hostname === 'bruke.github.io'
  try {
    const res = await fetch(increment ? COUNTER_URL : `${COUNTER_URL}?mode=read`)
    if (!res.ok) return
    const data = (await res.json()) as { visit?: number }
    if (typeof data.visit === 'number') visit.value = data.visit
  } catch {
    // 第三方不可用时不展示，避免首页出现错误信息
  }
}

onMounted(load)
</script>

<template>
  <p v-if="visit !== null" class="visit-counter">本站访问 {{ visit.toLocaleString('zh-CN') }} 次</p>
</template>

<style scoped>
.visit-counter {
  margin: 4px 0 48px;
  text-align: center;
  font-size: 13px;
  color: var(--vp-c-text-2);
}
</style>
