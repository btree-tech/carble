<script setup lang="ts">
import type { AsyncDataRequestStatus } from '#app/composables/asyncData'

const props = defineProps<{
  fieldId: number
}>()

const emit = defineEmits<{
  'update:status': [AsyncDataRequestStatus]
}>()

const {
  cardId,
} = useRoute().params

const {
  status,
  data: body,
} = useCardContentUpdate(cardId, props.fieldId)

watch(status, (status) => {
  emit('update:status', status)
})
</script>

<template>
  <UTextarea
    v-model="body"
    autoresize
  />
</template>
