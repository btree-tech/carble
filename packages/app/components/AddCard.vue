<script setup lang="ts">
import type { z } from 'zod'

const emit = defineEmits<{
  added: [z.infer<typeof cardSchema>]
}>()

const {
  projectId,
} = useRoute().params

const toast = useToast()

const {
  data: cards,
} = useCardsData()

const {
  execute,
  status,
} = useAsyncData(async () => {
  const data = await $fetch(`/api/projects/${projectId}/cards`, {
    method: 'post',
  })
  const card = cardSchema.parse({
    ...data,
    images: [],
    contents: [],
  })
  cards.value.push(card)

  useProjectData().data.value.totalCardSize++

  emit('added', card)

  toast.add({
    id: 'card-add',
    title: '追加しました',
  })
}, {
  immediate: false,
})
</script>

<template>
  <UButton
    label="追加"
    icon="i-material-symbols-light-add"
    :loading="status === 'pending'"
    @click="execute"
  >
    <slot />
  </UButton>
</template>
