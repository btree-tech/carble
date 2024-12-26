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
  cards.value.push(cardSchema.parse({
    ...data,
    images: [],
    contents: [],
  }))

  useProjectData().data.value.totalCardSize++
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
