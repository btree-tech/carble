<script setup lang="ts">
import { moveArrayElement, useSortable, type UseSortableOptions } from '@vueuse/integrations/useSortable'

const { data: project } = useProjectData()

const { data: cards } = useCardsData()

const {
  data: selectionState,
  selectedCards,
} = useGridViewSelectionState()

const {
  execute,
  status,
} = useAsyncStatus(async () => {
  await $fetch(`/api/projects/${project.value.id}/cards`, {
    method: 'put',
    body: cards.value.map(({ id }, i) => ({
      id,
      order: i + 1,
    })),
  })
}, {
  immediate: false,
})

useSortable(useTemplateRef('sortable'), cards, {
  onUpdate: async (e) => {
    moveArrayElement(cards, e.oldIndex!, e.newIndex!, e)
    await nextTick()
    await execute()
  },
} satisfies UseSortableOptions)

const shiftKeyState = useKeyModifier('Shift')

const lastSelectedCardId = ref<number|null>(null)

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
  lastSelectedCardId.value = selectedCards.value.length ? cardId : null
}

const deselectAll = () => {
  selectionState.value.forEach((_, key) => selectionState.value.set(key, false))
}
</script>

<template>
  <div
    v-if="project"
    class="gap-y-4"
  >
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
        <UButton
          icon="i-material-symbols-light-table-view"
          :to="`/projects/${project.id}`"
          variant="outline"
        >
          <span class="hidden md:inline">テーブルビュー</span>
        </UButton>
        <div class="grow" />
        <StatusIcon :status="status" />
      </div>
    </HeaderMenu>
    <div>
      <div
        class="
          flex flex-col-reverse
          md:flex-row md:justify-between md:my-0
        "
      >
        <UButtonGroup
          size="lg"
          :class="['my-4', { invisible: !selectedCards.length }]"
        >
          <UButton
            :label="`${selectedCards.length}件選択中`"
            color="white"
            @click="deselectAll"
          />
          <UButton
            label="複製"
            icon="i-material-symbols-light-content-copy"
            color="white"
          />
          <ButtonCardsDelete :cards="selectedCards" />
        </UButtonGroup>
        <GridViewSettingFields class="justify-end" />
      </div>
      <div
        ref="sortable"
        class="flex flex-wrap gap-8"
      >
        <GridViewCard
          v-for="card in cards"
          :key="card.id"
          :card="card"
          @change="toggle(card.id)"
        />
      </div>
    </div>
  </div>
</template>
