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

const { files, open, reset, onChange } = useFileDialog({
  accept: 'image/*',
  multiple: false,
  capture: 'environment',
})

const detect = async (file: Blob) => {
  // 普通にimportするとSSR時にエラーになる
  const { BarcodeDetector } = await import('barcode-detector')

  const barcodeDetector = new BarcodeDetector({ formats: ['qr_code'] })
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

  const transformed = await OpenCV.transform(file)
  formData.append('image', transformed)

  const data = await detect(transformed)
  if (data) {
    await $fetch(`/api/projects/${data.projectId}/cards/${data.cardId}/images`, {
      method: 'post',
      body: formData,
    })
    await navigateTo(`/projects/${data.projectId}/cards/${data.cardId}`)
  } else {
    const data = await $fetch(`/api/projects/${projectId}/cards`, {
      method: 'post',
      body: formData,
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
