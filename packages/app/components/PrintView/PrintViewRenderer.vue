<script setup lang="ts">
import type { z } from 'zod'

defineProps<{
  cards: z.infer<typeof cardSchema>[]
}>()

const {
  data: project,
} = useProjectData()

const wrapper = ref<HTMLDivElement>()
const { width: previewWidth } = useElementSize(wrapper)

const measuring = ref<HTMLDivElement>()
const { width: actualWidth } = useElementSize(measuring)

const scale = computed(() => previewWidth.value / actualWidth.value)

const visibleFieldIds = ref<number[]>(project.value.fields.map((field) => field.id))

const print = () => {
  window.print()
}
</script>

<template>
  <div
    class="
      grid gap-x-8 gap-y-4 grid-rows-subgrid row-start-3 row-end-5
      landscape:grid-cols-[min(75%,210mm),1fr]
      portrait:grid-rows-[1fr,auto]
      print:hidden
    "
  >
    <div
      ref="wrapper"
      class="overflow-x-hidden overflow-y-auto text-black bg-white"
    >
      <div
        class="origin-top-left"
        :style="{
          scale,
          // height: `${scale * 100}%`,
          height: `calc(148.5mm * ${cards.length} * ${scale})`
        }"
      >
        <PrintViewCard
          v-for="card in cards"
          :key="card.id"
          :card-id="card.id"
          :field-visibilities="visibleFieldIds"
          class="w-[210mm] h-[148.5mm] aspect-[1.414] p-2 border border-gray-500"
        />
      </div>
    </div>
    <div class="portrait:px-4 space-y-4">
      <UButton
        label="印刷"
        size="xl"
        block
        @click="print"
      />
      <PrintViewSettings v-model="visibleFieldIds" />
    </div>

    <div
      ref="measuring"
      class="w-[210mm] absolute -top-full -left-full"
    />

    <Teleport to="body">
      <div class="hidden print:block text-black bg-white">
        <PrintViewCard
          v-for="card in cards"
          :key="card.id"
          :card-id="card.id"
          :field-visibilities="visibleFieldIds"
          class="w-full h-[50svh] p-2 border border-gray-500"
        />
      </div>
    </Teleport>
  </div>
</template>

<style>
@page {
  size: A4 portrait;
}
</style>
