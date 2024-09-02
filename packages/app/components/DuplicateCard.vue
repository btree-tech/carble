<script setup lang="ts">
import { type z } from 'zod'

const props = defineProps<{
  cardId: number
}>()

const emit = defineEmits<{
  submitted: [z.infer<typeof cardSchema>]
}>()

const { projectId } = useRoute().params

const toast = useToast()

const {
  execute,
  status,
} = useAsyncData(async () => {
  const data = await $fetch(`/api/projects/${projectId}/cards/${props.cardId}/duplicate`, {
    method: 'post',
  })
  const newCard = cardSchema.parse(data)
  const { data: cards } = useCardsData()
  cards.value.push(newCard)
  emit('submitted', newCard)
  toast.add({
    id: 'card-duplicate',
    title: '複製しました',
  })
}, {
  immediate: false,
})
</script>

<template>
  <UButton
    label="複製"
    icon="i-material-symbols-light-content-copy"
    color="gray"
    :loading="status === 'pending'"
    @click="execute"
  />
</template>
