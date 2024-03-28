<script setup lang="ts">
const { projectId } = useRoute().params

const {
  execute,
  status,
} = useAsyncData(async () => {
  const data = await $fetch(`/api/projects/${projectId}/cards`, {
    method: 'post',
  })
  const { data: cards } = useCardsData()
  cards.value.push(cardsSchema.element.parse({
    ...data,
    images: [],
    contents: [],
  }))
}, {
  immediate: false,
})
</script>

<template>
  <UButton
    label="1行追加"
    icon="i-material-symbols-light-add"
    :loading="status === 'pending'"
    @click="execute"
  />
</template>
