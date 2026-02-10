<script setup lang="ts">
import type { z } from 'zod'

const props = defineProps<{
  cards: z.infer<typeof cardSchema>[]
}>()

const { data: project } = useProjectData()

await useFetchPrintSetting()

const wrapper = ref<HTMLDivElement>()
const { width: previewWidth } = useElementSize(wrapper)

const measuring = ref<HTMLDivElement>()
const { width: actualWidth } = useElementSize(measuring)

const scale = computed(() => previewWidth.value / actualWidth.value)

const chunkedCards = computed(() => props.cards.reduce((prev, _, i) => {
  return i % 2 ? prev : [...prev, props.cards.slice(i, i + 2)]
}, [] as z.infer<typeof cardSchema>[]))

const print = () => {
  window.print()
}
</script>

<template>
  <div
    v-if="project"
    class="
      gap-y-4
      landscape:pb-0
      print:hidden
    "
  >
    <HeaderMenu>
      <div class="flex items-center gap-x-4">
        <div class="grow truncate">
          {{ project.name }}
        </div>
      </div>
      <div
        class="
          flex items-center gap-x-4
          landscape:col-span-2
        "
      >
        <slot name="header-nav" />
      </div>
    </HeaderMenu>

    <div
      class="
        row-span-2 grid gap-8
        landscape:grid-cols-[min(75%,210mm),1fr] landscape:grid-rows-1
        portrait:grid-rows-[auto,1fr]
        print:hidden
      "
    >
      <div
        ref="wrapper"
        class="overflow-x-hidden overflow-y-auto landscape:!h-auto"
        :style="{ height: `calc(148.5mm * ${scale})` }"
      >
        <div
          class="origin-top-left"
          :style="{
            scale,
            height: `calc(148.5mm * ${cards.length} * ${scale})`
          }"
        >
          <PrintViewCard
            v-for="card in cards"
            :key="card.id"
            :card="card"
            class="w-[210mm] h-[148.5mm] aspect-[1.414] text-black bg-white"
          />
        </div>
      </div>
      <div class="grid grid-rows-[auto,1fr] gap-4 portrait:overflow-auto">
        <div class="landscape:px-4">
          <UButton
            label="印刷"
            size="xl"
            block
            @click="print"
          />
        </div>
        <PrintViewSettings class="overflow-auto landscape:p-4 landscape:pb-8" />
      </div>

      <div
        ref="measuring"
        class="w-[210mm] absolute -top-full -left-full"
      />

      <Teleport to="body">
        <div class="hidden print:block text-black bg-white">
          <div
            v-for="(chunk, i) in chunkedCards"
            :key="i"
            class="print-view-card-adjuster grid grid-rows-[1fr,5mm,1fr] w-full h-svh max-h-svh overflow-hidden box-border break-inside-avoid"
          >
            <PrintViewCard
              v-for="(card, j) in chunk"
              :key="card.id"
              :card="card"
              :class="['overflow-hidden', { 'row-start-3': !!j }]"
            />
          </div>
        </div>
      </Teleport>
    </div>
  </div>
</template>

<style>
@page {
  size: A4 portrait;
}

/* CESCHI-159 Chrome右の線が細くなる対策 */
.print-view-card-adjuster {
  padding-right: 1px;
}
/* CESCHI-159 Safariで崩れないようにする（Safariのみ適用ハック） */
_::-webkit-full-page-media, _:future, :root .print-view-card-adjuster {
  height: 92vh;
}

</style>
