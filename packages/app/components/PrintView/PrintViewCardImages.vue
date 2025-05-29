<script setup lang="ts">
import type { z } from 'zod'

const props = defineProps<{
  card: z.infer<typeof cardSchema>
}>()

const { data: printSetting } = usePrintSetting()

const images = computed(() => {
  return printSetting.value.data.displayImageCount === 0
    ? props.card.images
    : props.card.images.slice(0, printSetting.value.data.displayImageCount)
})
</script>

<template>
  <div
    class="grid items-center gap-2"
    :style="{ gridTemplateColumns: `repeat(${printSetting.data.displayRowImageCount || images.length}, 1fr)` }"
  >
    <img
      v-for="image in images"
      :key="image.id"
      :src="`/uploads/images/${image.filename}`"
      class="w-full max-h-full object-contain overflow-hidden"
    >
  </div>
</template>
