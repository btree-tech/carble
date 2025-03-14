<script setup lang="ts">
import { useQRCode } from '@vueuse/integrations/useQRCode'
import type { z } from 'zod'

const props = defineProps<{
  card: z.infer<typeof cardSchema>
  settings: { layoutId: number, fixedFieldId: number[], displayImageCount: number }
}>()

const layout = computed(() => PrintViewLayouts.get(Number(props.settings.layoutId))!)

const qrcode = useQRCode(() => JSON.stringify({
  projectId: props.card.projectId,
  cardId: props.card.id,
}), { margin: 0 })

const reservedAreas = computed(() => {
  return (layout.value.reservedAreas || []).map((area, i) => ({
    ...area,
    fieldId: props.settings.fixedFieldId[i],
  }))
})

const unreservedArea = computed(() => {
  const area = layout.value.unreservedArea
  if (!area) return null
  return {
    ...area,
    fieldIds: props.card.contents
      .filter((c) => !props.settings.fixedFieldId.includes(c.fieldId))
      .map((c) => c.fieldId),
  }
})
</script>

<template>
  <div
    :style="{ ...layout.style }"
    class="grid border border-black"
  >
    <div
      v-for="area in reservedAreas"
      :key="area.fieldId"
      :style="{ ...area.style }"
      class="border border-black overflow-hidden p-1"
    >
      <PrintViewCardContent
        v-if="Number(area.fieldId) > 0"
        :card="card"
        :field-id="area.fieldId"
      />
      <PrintViewCardImages
        v-else-if="settings.displayImageCount"
        :card="card"
        :display-count="settings.displayImageCount"
      />
    </div>
    <div
      v-if="unreservedArea"
      :style="{ ...unreservedArea.style }"
      class="border border-black overflow-hidden p-1"
    >
      <img
        :src="qrcode"
        class="size-20 float-right ml-2 mb-2"
      >
      <PrintViewCardContent
        v-for="fieldId in unreservedArea.fieldIds"
        :key="fieldId"
        :card="card"
        :field-id="fieldId"
        class="mb-1 last:mb-0"
      />
    </div>
  </div>
</template>
