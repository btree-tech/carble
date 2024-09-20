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

const toast = useToast()

const { files, open, reset, onChange } = useFileDialog({
  accept: 'image/*',
  multiple: false,
  capture: 'environment',
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
  execute,
  status,
} = useAsyncData(async () => {
  const file = files.value?.item(0)
  if (!file) return

  const formData = new FormData()
  formData.append('image', file)

  const data = await detect(file)
  if (data) {
    await $fetch(`/api/projects/${data.projectId}/cards/${data.cardId}/images`, {
      method: 'post',
      body: formData,
    })
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
    toast.add({
      id: `card-scan-${data.id}`,
      title: 'スキャン完了',
      description: '新しいカードを追加しました',
    })
    await navigateTo(`/projects/${projectId}/cards/${data.id}`)
  }

  reset()
}, {
  immediate: false,
})

onChange(async () => {
  await execute()
})
</script>

<template>
  <UButton
    label="スキャン"
    icon="i-material-symbols-light-add-a-photo"
    :loading="status === 'pending'"
    @click="open"
  />
</template>
