<script setup lang="ts">
import { useFloating } from '@floating-ui/vue'

const cardIds = defineModel<number[]>({ required: true })

const props = defineProps<{
  reference?: HTMLElement
}>()

const floating = useTemplateRef('floating')

const { floatingStyles } = useFloating(computed(() => props.reference), floating, {
  placement: 'top-start',
  strategy: 'fixed',
})
</script>

<template>
  <div
    ref="floating"
    :class="{ invisible: !cardIds.length }"
    :style="reference ? floatingStyles : {}"
  >
    <UButtonGroup size="lg">
      <UButton
        :label="`${cardIds.length}件選択中`"
        color="white"
        @click="cardIds = []"
      />
      <ButtonGroupCardsDuplicate :cards="cardIds" />
      <ButtonGroupCardsDelete :cards="cardIds" />
    </UButtonGroup>
  </div>
</template>
