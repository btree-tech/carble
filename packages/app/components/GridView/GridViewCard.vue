<script setup lang="ts">
import type z from 'zod'

const props = defineProps<{
  card: z.infer<typeof cardSchema>
}>()

const contentBody = computed(() => props.card.contents.at(0)?.body ?? '')

const shiftKeyState = useKeyModifier('Shift')

const onClickCard = () => {
  console.log(shiftKeyState.value)
}
</script>

<template>
  <div
    class="grid grid-rows-[1fr,auto] gap-0 border w-40 h-40"
    @click="onClickCard"
  >
    <div class="overflow-hidden p-2 border-b">{{ contentBody }}</div>
    <div class="p-2">ID: {{ card.id }}</div>
  </div>
</template>
