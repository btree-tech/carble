<script setup lang="ts">
import type { z } from 'zod'

const props = defineProps<{
  card: z.infer<typeof cardSchema>
  displayCount: number
}>()

const images = computed(() => props.card.images.slice(0, props.displayCount))
</script>

<template>
  <div
    class="grid gap-2 h-full"
    :style="{ gridTemplateColumns: `repeat(${displayCount}, 1fr)` }"
  >
    <img
      v-for="image in images"
      :key="image.id"
      :src="`/uploads/images/${image.filename}`"
      class="w-full h-full object-contain overflow-hidden"
    >
  </div>
</template>
