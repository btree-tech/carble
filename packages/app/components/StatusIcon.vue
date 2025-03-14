<script setup lang="ts">
import type { AsyncDataRequestStatus } from '#app/composables/asyncData'

defineProps<{
  status: AsyncDataRequestStatus
}>()
</script>

<template>
  <UIcon
    v-show="status === 'pending'"
    name="i-material-symbols-light-progress-activity"
    class="animate-spin text-xl"
  />
  <UIcon
    v-show="status === 'error'"
    name="i-material-symbols-light-error"
    class="text-red-500 dark:text-red-400 text-xl"
  />
  <UIcon
    v-show="status !== 'pending' && status !== 'error'"
    name="i-material-symbols-light-done"
    :class="[
      'text-green-500 dark:text-green-400 text-xl',
      { 'opacity-0': status !== 'success' },
    ]"
  />
</template>
