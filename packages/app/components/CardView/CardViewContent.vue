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

const body = computed({
  get: () => card.value.contents.find((content) => content.fieldId === props.fieldId)?.body || '',
  set: (value: string) => {
    const index = card.value.contents.findIndex((content) => content.fieldId === props.fieldId)
    if (index >= 0) {
      card.value.contents.splice(index, 1, {
        ...card.value.contents[index],
        body: value,
      })
    } else {
      card.value.contents.push({
        cardId: card.value.id,
        fieldId: props.fieldId,
        body: value,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    }
  },
})

const {
  status,
} = useFetch(`/api/projects/${projectId}/cards/${cardId}/fields/${props.fieldId}`, {
  method: 'put',
  body: {
    body: debouncedRef(body, 200),
  },
  immediate: false,
})

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
