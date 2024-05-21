<script setup lang="ts">
import { type z } from 'zod'

defineProps<{
  fieldVisibilities: Record<number, boolean>
}>()

const { data: cards } = useCardsData()

const chunked = computed(() => cards.value.reduce((prev, _, i) => {
  return i % 2 ? prev : [...prev, cards.value.slice(i, i + 2)]
}, [] as z.infer<typeof cardsSchema>[]))
</script>

<template>
  <div>
    <div
      v-for="(c, i) in chunked"
      :key="i"
      class="print:break-inside-avoid"
    >
      <PrintViewCard
        v-for="card in c"
        :key="card.id"
        :card-id="card.id"
        :field-visibilities="fieldVisibilities"
        class="
          w-[210mm] h-[148.5mm] a-spect-[1.414] p-8 border border-gray-500
          print:a-spect-[revert] print:w-full print:h-[50svh]
        "
      />
    </div>
  </div>
</template>
