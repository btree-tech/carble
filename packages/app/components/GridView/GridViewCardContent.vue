<script setup lang="ts">
import type z from 'zod'

const props = defineProps<{
  card: z.infer<typeof cardSchema>
  fieldId: GrintViewSettingFieldId
}>()

const content = computed(() => {
  if (props.fieldId === 'id') return `ID: ${props.card.id}`
  if (props.fieldId === 'image') return props.card.images.at(0)?.filename
  return props.card.contents.find(({ fieldId }) => Number(props.fieldId) === fieldId)?.body
})
</script>

<template>
  <div>
    <div v-if="!content">&nbsp;</div>
    <div
      v-else-if="fieldId !== 'image'"
      class="max-h-full overflow-hidden mx-2.5 my-1.5"
    >
      {{ content }}
    </div>
    <img
      v-else
      :src="`/uploads/thumbs/${content}.webp`"
      class="object-cover"
    >
  </div>
</template>
