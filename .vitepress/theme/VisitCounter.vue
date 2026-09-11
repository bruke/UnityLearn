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
  <div v-if="visit !== null" class="visit-counter">
    <span class="visit-counter-badge">
      本站访问 <strong>{{ visit.toLocaleString('zh-CN') }}</strong> 次
    </span>
  </div>
</template>

<style scoped>
.visit-counter {
  margin: 16px 0 56px;
  text-align: center;
}

.visit-counter-badge {
  display: inline-block;
  padding: 8px 20px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 999px;
  background-color: var(--vp-c-bg-soft);
  font-size: 15px;
  line-height: 1.4;
  color: var(--vp-c-text-2);
}

.visit-counter-badge strong {
  font-weight: 700;
  color: var(--vp-c-brand-1);
}
</style>
