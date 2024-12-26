<script setup lang="ts">
const props = defineProps<{
  imageId: number
}>()

const {
  cardId,
} = useRoute().params

const { data: image } = useCardImage(cardId, props.imageId)

const {
  execute,
  status,
} = useCardImageRemove(cardId, props.imageId)
</script>

<template>
  <div class="relative inline-block group">
    <img :src="`/uploads/thumbs/${image.filename}.webp`">
    <div class="absolute inset-8 grid grid-flow-col justify-center items-end gap-x-8 opacity-0 group-hover:opacity-100 duration-75">
      <UButton
        label="元の画像を表示"
        icon="i-material-symbols-light-zoom-in"
        color="gray"
        variant="solid"
        :to="`/uploads/images/${image.filename}`"
        target="_blank"
        :ui="{ color: { gray: { solid: 'dark:hover:bg-gray-700' } } }"
        class="shadow"
      />
      <UButton
        label="画像を削除"
        icon="i-material-symbols-light-close"
        color="gray"
        variant="solid"
        :loading="status === 'pending'"
        :ui="{ color: { gray: { solid: 'dark:hover:bg-gray-700' } } }"
        class="shadow"
        @click="execute"
      />
    </div>
  </div>
</template>
