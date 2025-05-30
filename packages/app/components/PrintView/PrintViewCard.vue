<script setup lang="ts">
import { useQRCode } from '@vueuse/integrations/useQRCode'
import type { z } from 'zod'

const props = defineProps<{
  card: z.infer<typeof cardSchema>
}>()

const { data: printSetting } = usePrintSetting()

const { data: layout } = usePrintLayout(() => printSetting.value.data.layoutId)

const qrcode = useQRCode(() => JSON.stringify({
  projectId: props.card.projectId,
  cardId: props.card.id,
}), { margin: 0 })
</script>

<template>
  <div
    v-if="layout"
    :style="{ ...layout.style }"
    class="grid border border-black"
  >
    <PrintViewCardArea
      v-for="area in layout.areas"
      :key="area.id"
      :card="card"
      :area-id="area.id"
    >
      <template #qrcode>
        <img
          v-if="!area.isReserved"
          :src="qrcode"
          class="size-20 float-right ml-2 mb-2"
        >
      </template>
    </PrintViewCardArea>
  </div>
</template>
