<script setup lang="ts">
import { useQRCode } from '@vueuse/integrations/useQRCode'

const props = defineProps<{
  cardId: number
}>()

const { data: project } = useProjectData()

const { data: cards } = useCardsData()

const card = computed(() => cards.value.find((card) => card.id === props.cardId)!)

const qrcode = useQRCode(() => JSON.stringify({
  projectId: card.value.projectId,
  cardId: card.value.id,
}))
</script>

<template>
  <div class="grid grid-cols-2 items-start overflow-hidden">
    <div class="grid grid-cols-[auto,1fr] gap-x-8 gap-y-4">
      <div class="font-bold">
        ID
      </div>
      <div>{{ card.id }}</div>
      <template
        v-for="field in project.fields"
        :key="field.id"
      >
        <div class="font-bold">
          {{ field.name }}
        </div>
        <div>{{ card.contents.find((c) => c.fieldId === field.id)?.body || '' }}</div>
      </template>
    </div>
    <div class="flex flex-col gap-4">
      <img
        :src="qrcode"
        class="self-end size-20 -m-4"
      >
      <div
        v-for="image in card.images"
        :key="image.id"
      >
        <img :src="`/uploads/images/${image.filename}`">
      </div>
    </div>
  </div>
</template>
