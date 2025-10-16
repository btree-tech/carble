<script setup lang="ts">
import { useSortable, type UseSortableOptions } from '@vueuse/integrations/useSortable'

const { data: project } = useProjectData()

const { data: cards } = useCardsData()

const cardOrders = computed(() => cards.value.map(({ id }, i) => ({
  id,
  order: i + 1,
})))

const {
  execute,
  status,
} = useAsyncStatus(async () => {
  await $fetch(`/api/projects/${project.value.id}/cards`, {
    method: 'put',
    body: cardOrders.value,
  })
}, {
  immediate: false,
})

useSortable(useTemplateRef('sortable'), cards, {
  onSort: async () => {
    await execute()
  },
} satisfies UseSortableOptions)

const shiftKeyState = useKeyModifier('Shift')

const selectionState = ref(new Map<number, boolean>())

const lastSelectedCardId = ref<number|null>(null)

const selectedCount = computed(() => [...selectionState.value.values()].filter((v) => v).length)

const isSelectedAny = computed(() => [...selectionState.value.values()].some((v) => v))

const toggle = (cardId: number) => {
  const selected = !selectionState.value.get(cardId)
  selectionState.value.set(cardId, selected)
  if (shiftKeyState.value && lastSelectedCardId.value && lastSelectedCardId.value !== cardId) {
    const ids = [cardId, lastSelectedCardId.value]
    const start = cards.value.findIndex(({ id }) => ids.includes(id))
    const end = cards.value.findLastIndex(({ id }) => ids.includes(id))
    cards.value.slice(start, end + 1).forEach(({ id }) => {
      selectionState.value.set(id, selected)
    })
  }
  lastSelectedCardId.value = isSelectedAny.value ? cardId : null
}

const onClickCard = async (event: MouseEvent, cardId: number) => {
  if (!shiftKeyState.value) return
  event.preventDefault()
  toggle(cardId)
}

watch(cards, (cards) => {
  if (!cards) return
  const prev = new Map(selectionState.value.entries())
  selectionState.value.clear()
  cards.forEach(({ id }) => {
    selectionState.value.set(id, !!prev.get(id))
  })
})
</script>

<template>
  <div class="gap-y-4">
    <HeaderMenu>
      <div class="flex items-center gap-x-4">
        <div class="grow truncate">
          {{ project.name }}
        </div>
      </div>
      <div
        class="
          flex items-center gap-x-4
          landscape:col-span-2
        "
      >
        <slot name="header-nav" />
      </div>
    </HeaderMenu>
    <div>
      <UButtonGroup class="my-4">
        <UButton
          :label="`${selectedCount}件選択中`"
          color="white"
        />
      </UButtonGroup>
      <div
        ref="sortable"
        class="flex flex-wrap gap-8"
      >
        <NuxtLink
          v-for="card in cards"
          :key="card.id"
          :to="`/projects/${card.projectId}/cards/${card.id}`"
          :class="[
            'group relative grid grid-rows-[1fr,auto] gap-0 border w-40 h-40',
            { 'bg-primary-500/25 dark:bg-primary-600/25': selectionState.get(card.id) },
          ]"
          @click="onClickCard($event, card.id)"
        >
          <div class="absolute top-1 right-1 opacity-0 group-hover:opacity-100">
            <UCheckbox
              :model-value="selectionState.get(card.id)"
              :ui="{ container: 'h-7', base: 'w-6 h-6' }"
              @click.stop
              @change="toggle(card.id)"
            />
          </div>
          <div class="overflow-hidden p-2 border-b">{{ card.contents.at(0)?.body }}</div>
          <div class="p-2">ID: {{ card.id }}</div>
        </NuxtLink>
      </div>
    </div>
  </div>
</template>
