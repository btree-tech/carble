<script setup lang="ts">
import type { AsyncDataRequestStatus } from '#app/composables/asyncData'

const props = defineProps<{
  fieldId: number
}>()

const emit = defineEmits<{
  'update:status': [AsyncDataRequestStatus]
}>()

const {
  projectId,
  cardId,
} = useRoute().params

const { data: card } = useCardData()

const content = ref(card.value.contents.find((c) => c.fieldId === props.fieldId)?.body || '')

const debounced = refDebounced(content, 200)

const {
  status,
} = useFetch(`/api/projects/${projectId}/cards/${cardId}/fields/${props.fieldId}`, {
  method: 'put',
  body: {
    content: debounced,
  },
  immediate: false,
})

watch(status, (status) => {
  emit('update:status', status)
})
</script>

<template>
  <UTextarea
    v-model="content"
    autoresize
  />
</template>
