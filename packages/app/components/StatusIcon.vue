<script setup lang="ts">
import type { AsyncDataRequestStatus } from '#app/composables/asyncData'

const props = defineProps<{
  status: AsyncDataRequestStatus
}>()
</script>

<template>
  <UIcon
    v-if="status === 'pending'"
    name="i-material-symbols-light-progress-activity"
    class="animate-spin"
  />
  <UIcon
    v-else-if="status === 'error'"
    name="i-material-symbols-light-error"
    class="text-red-500 dark:text-green-400"
  />
  <UIcon
    v-else
    name="i-material-symbols-light-done"
    :class="[
      'text-green-500 dark:text-green-400',
      { 'opacity-0': status !== 'success' },
    ]"
  />
</template>
