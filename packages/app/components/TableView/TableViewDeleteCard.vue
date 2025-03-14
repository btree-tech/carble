<script setup lang="ts">
const props = defineProps<{
  cardId: number
}>()

const { projectId } = useRoute().params

const {
  execute,
  status,
} = useAsyncData(async () => {
  if (!window.confirm('削除してよろしいですか？')) return

  await $fetch(`/api/projects/${projectId}/cards/${props.cardId}`, {
    method: 'delete',
  })
  const { data: cards } = useCardsData()
  const index = cards.value.findIndex((c) => c.id === props.cardId)
  if (index >= 0) {
    cards.value.splice(index, 1)
    useProjectData().data.value.totalCardSize--
  }
}, {
  immediate: false,
})
</script>

<template>
  <UButton
    icon="i-material-symbols-delete-forever"
    color="red"
    variant="outline"
    :loading="status === 'pending'"
    @click="execute"
  >
    <span class="hidden md:inline">削除</span>
  </UButton>
</template>
