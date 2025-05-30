<script setup lang="ts">
import type { z } from 'zod'

const props = defineProps<{
  areaId: number
  card: z.infer<typeof cardSchema>
}>()

defineSlots<{
  qrcode(): any
}>()

const { data: printSetting } = usePrintSetting()

const { data: layout } = usePrintLayout(() => printSetting.value.data.layoutId)

const area = computed(() => layout.value?.areas.find(({ id }) => id === props.areaId))

const fields = computed(() => printSetting.value.data.fields.filter(({ areaId, isVisible }) => areaId === area.value?.id && isVisible))
</script>

<template>
  <div
    v-if="area"
    class="border border-black max-h-full overflow-hidden p-1"
    :style="{ ...area.style }"
  >
    <slot name="qrcode" />
    <template
      v-for="field in fields"
      :key="field.id"
    >
      <PrintViewCardContent
        v-if="field.id !== 'image'"
        :card="card"
        :field-id="field.id"
        class="mb-1 last:mb-0"
      />
      <PrintViewCardImages
        v-else
        :card="card"
        :class="['mb-1 last:mb-0', { 'h-full': area.isReserved }]"
      />
    </template>
  </div>
</template>
