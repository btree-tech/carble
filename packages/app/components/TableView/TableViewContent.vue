<script setup lang="ts">
import type { AsyncDataRequestStatus } from '#app/composables/asyncData'

const props = defineProps<{
  cardId: number
  fieldId: number
}>()

const emit = defineEmits<{
  'update:status': [AsyncDataRequestStatus]
}>()

const { data: card } = useCardsDataItem(toRef(props, 'cardId'))

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
        projectId: card.value.projectId,
        cardId: props.cardId,
        fieldId: props.fieldId,
        body: value,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    }
  },
})

const hasFocus = ref(false)

const { status } = useFetch(`/api/projects/${card.value.projectId}/cards/${props.cardId}/fields/${props.fieldId}`, {
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
  <!-- <UPopover
    v-model:open="hasFocus"
    :popper="{ placement: 'bottom-start', offsetDistance: -32 }"
  > -->
  <div class="relative">
    <UInput
      v-model="body"
      variant="none"
      class="w-40 xl:w-60"
      @focus="hasFocus = true"
    />
    <UTextarea
      v-if="hasFocus"
      v-model="body"
      autofocus
      autoresize
      class="absolute top-0 -left-1 z-50 w-40 xl:w-60 m-1"
      @blur="hasFocus = false"
    />
  </div>

    <!-- <template #panel>
      <UTextarea
        v-if="hasFocus"
        v-model="body"
        autofocus
        autoresize
        class="w-40 xl:w-60 m-1"
        @blur="hasFocus = false"
      />
    </template>
  </UPopover> -->
</template>
