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
    icon="i-material-symbols-light-add"
    :loading="status === 'pending'"
    @click="execute"
  >
    <span class="hidden md:inline">カード追加</span>
  </UButton>
</template>
