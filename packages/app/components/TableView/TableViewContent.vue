<script setup lang="ts">
import type { AsyncDataRequestStatus } from '#app/composables/asyncData'

const props = defineProps<{
  cardId: number
  fieldId: number
}>()

const emit = defineEmits<{
  'update:status': [AsyncDataRequestStatus]
}>()

const hasFocus = ref(false)

const {
  status,
  data: body,
} = useCardContentUpdate(props.cardId, props.fieldId)

watch(status, (status) => {
  emit('update:status', status)
})
</script>

<template>
  <UPopover
    v-model:open="hasFocus"
    :popper="{ placement: 'bottom-start', offsetDistance: -32 }"
  >
    <UInput
      v-model="body"
      variant="none"
      class="w-40 xl:w-60"
      @focus="hasFocus = true"
    />

    <template #panel>
      <UTextarea
        v-if="hasFocus"
        v-model="body"
        autofocus
        autoresize
        class="w-40 xl:w-60 m-1"
        @blur="hasFocus = false"
      />
    </template>
  </UPopover>
</template>
