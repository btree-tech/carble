<script setup lang="ts">
import { moveArrayElement, useSortable, type UseSortableOptions } from '@vueuse/integrations/useSortable'
import type GridViewCard from '~/components/GridView/GridViewCard.vue'

const { data: project } = useProjectData()

const { data } = useCardsData()

const {
  data: selectionState,
} = useGridViewSelectionState()

const cards = computed({
  get: () => data.value.items,
  set: (value) => {
    data.value.items = value
  },
})

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
  await refreshNuxtData(getFetchCardsKey())
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
          md:flex-row md:justify-between md:items-end
        "
      >
        <ButtonGroupCards
          v-model="selectionState"
          class="my-4"
        />
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
        />
      </div>
    </div>
  </div>
</template>
