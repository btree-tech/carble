<script setup lang="ts">
const props = defineProps<{
  imageId: number
}>()

const {
  projectId,
  cardId,
} = useRoute().params

const { data: card } = useCardData()

const image = computed(() => card.value.images.find((image) => image.id === props.imageId)!)

const {
  execute,
  status,
} = useAsyncData(async () => {
  await $fetch(`/api/projects/${projectId}/cards/${cardId}/images/${props.imageId}`, {
    method: 'delete',
  })
  const index = card.value.images.findIndex((image) => image.id === props.imageId)
  if (index >= 0) {
    card.value.images.splice(index, 1)
  }
}, {
  immediate: false,
})
</script>

<template>
  <div class="relative inline-block group">
    <img :src="`/uploads/images/${image.filename}`">
    <UButton
      icon="i-material-symbols-light-close"
      :loading="status === 'pending'"
      class="absolute -top-4 -right-4 shadow opacity-0 group-hover:opacity-100 duration-75"
      @click="execute"
    />
  </div>
</template>
