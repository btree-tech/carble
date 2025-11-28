<script setup lang="ts">
const cardIds = defineModel<number[]>({ required: true })
</script>

<template>
  <UButtonGroup
    size="lg"
    :class="['my-4', { invisible: !cardIds.length }]"
  >
    <UButton
      :label="`${cardIds.length}件選択中`"
      color="white"
      @click="cardIds = []"
    />
    <ButtonGroupCardsDuplicate :cards="cardIds" />
    <ButtonGroupCardsDelete :cards="cardIds" />
  </UButtonGroup>
</template>
