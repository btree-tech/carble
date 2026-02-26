<script setup lang="ts">
import { z } from 'zod'

const CardQRCodeData = z.object({
  projectId: z.number(),
  cardId: z.number(),
})
.refine(async ({ projectId, cardId }) => {
  try {
    await $fetch(`/api/projects/${projectId}/cards/${cardId}`)
    return true
  } catch {
    return false
  }
}, { message: `card not found` })

const { projectId } = useRoute().params

const { data: cards } = useCardsData()

const toast = useToast()

const { files, open, onChange } = useFileDialog({
  accept: 'image/*',
  multiple: false,
  capture: 'environment',
  reset: true,
})

const detect = async (file: Blob) => {
  const { $BarcodeDetector } = useNuxtApp()

  const barcodeDetector = new $BarcodeDetector({ formats: ['qr_code'] })
  const barcodes = await barcodeDetector.detect(file)

  try {
    return await CardQRCodeData.parseAsync(JSON.parse(barcodes[0]?.rawValue))
  } catch {
    return null
  }
}

const {
  executeImmediate,
  isLoading,
} = useAsyncState(async () => {
  const file = files.value?.item(0)
  if (!file) return null

  const formData = new FormData()
  formData.append('image', file)

  const data = await detect(file)
  if (data) {
    await useCardImageAdd(data.cardId).execute(file)
    await navigateTo(`/projects/${data.projectId}/cards/${data.cardId}`)
    toast.add({
      id: `card-scan-${data.cardId}`,
      title: 'スキャン完了',
      description: `ID: ${data.cardId}のカードに画像を追加しました`,
    })
  } else {
    const data = await $fetch(`/api/projects/${projectId}/cards`, {
      method: 'post',
      body: formData,
    })
    cards.value.items.push(cardSchema.parse(data))
    toast.add({
      id: `card-scan-${data?.id}`,
      title: 'スキャン完了',
      description: '新しいカードを追加しました',
    })
    await navigateTo(`/projects/${projectId}/cards/${data?.id}`)
  }
  return file
}, null, {
  immediate: false,
})

onChange(async () => {
  await executeImmediate()
})
</script>

<template>
  <UButton
    label="スキャン"
    icon="i-material-symbols-light-add-a-photo"
    :loading="isLoading"
    @click="open"
  >
    <span class="hidden md:inline">スキャン</span>
  </UButton>
</template>
