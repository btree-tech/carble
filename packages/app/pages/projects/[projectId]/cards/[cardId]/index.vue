<script setup lang="ts">
import type { z } from 'zod'

const {
  projectId,
  cardId,
} = useRoute().params

const {
  data: project,
} = await useFetchProject()

const {
  data: cards,
} = useCardsData()

const {
  index,
  data: card,
} = useCard(cardId)

const query = useCardsQueryString()

const {
  statuses,
  status,
} = useMultiAsyncDataStatus<number>()

const fields = computed(() => (project.value?.fields || []).filter((field) => field.isVisible))

const previousCard = computed(() => cards.value[index.value - 1])

const nextCard = computed(() => cards.value[index.value + 1])

const onDuplicated = async ({ id }: z.infer<typeof cardSchema>) => {
  await navigateTo(`/projects/${projectId}/cards/${id}?${query.value}`)
}

const onAdded = async({ id }: z.infer<typeof cardSchema>) => {
  await navigateTo(`/projects/${projectId}/cards/${id}?${query.value}`)
}
</script>

<template>
  <div
    v-if="project && card"
    class="row-span-3 grid grid-rows-subgrid gap-y-8"
  >
    <div>
      <div class="flex items-center gap-x-4 mb-4">
        <div class="grow truncate">
          {{ project.name }}
        </div>
        <ScanButton class="justify-self-end" />
      </div>
      <div class="flex items-center gap-4">
          <UButton
            label="テーブルビュー"
            icon="i-material-symbols-light-table-view"
            :to="`/projects/${projectId}?${query}`"
            variant="outline"
          />
          <UButton
            label="カード印刷ビュー"
            icon="i-material-symbols-light-print"
            :to="`/projects/${projectId}/cards/${cardId}/print?${query}`"
            variant="outline"
          />
        <div class="grow" />
        <StatusIcon :status="status" />
        <DuplicateCard
          :card-id="card.id"
          @submitted="onDuplicated"
        />
      </div>
    </div>
    <div
      class="
        grid grid-cols-2 items-start gap-8
        portrait:grid-cols-1
        border-2 p-2 rounded
      "
    >
      <div class="grid grid-cols-[auto,1fr] gap-4">
        <UFormGroup
          label="ID"
          class="col-span-2 grid grid-cols-subgrid space-y-0"
        >
          <div class="text-sm ml-2">
            {{ card.id }}
          </div>
        </UFormGroup>
        <UFormGroup
          label="並び順"
          class="col-span-2 grid grid-cols-subgrid space-y-0"
        >
          <div class="text-sm ml-2">
            {{ card.order }}
          </div>
        </UFormGroup>
        <template
          v-for="field in fields"
          :key="field.id"
        >
          <UFormGroup
            :label="field.name || ''"
            class="col-span-2 grid grid-cols-subgrid"
          >
            <CardViewContent
              :field-id="field.id"
              class="-mt-2"
              @update:status="statuses.set(field.id, $event)"
            />
          </UFormGroup>
        </template>
        <div class="col-span-2">
          <UPopover :popper="{ placement: 'bottom-start' }">
            <UButton
              icon="i-material-symbols-light-add"
              color="gray"
            />

            <template #panel="{ close }">
              <FormAddField
                autofocus
                @submitted="close"
              />
            </template>
          </UPopover>
        </div>
      </div>
      <div class="flex flex-col gap-4">
        <div
          v-for="image in card.images"
          :key="image.id"
        >
          <CardViewImage :image-id="image.id" />
        </div>
        <div class="text-center">
          <CardViewAddImage />
        </div>
      </div>
    </div>
    <div class="h-32" />

    <UButton
      v-if="previousCard"
      label="前"
      icon="i-material-symbols-light-arrow-back-ios-new"
      :to="`/projects/${projectId}/cards/${previousCard.id}?${query}`"
      variant="soft"
      size="lg"
      class="fixed bottom-12 left-4 md:bottom-24 md:left-8"
    />
    <UButton
      v-if="nextCard"
      label="次"
      icon="i-material-symbols-light-arrow-forward-ios"
      :to="`/projects/${projectId}/cards/${nextCard.id}?${query}`"
      variant="soft"
      size="lg"
      :trailing="true"
      class="fixed bottom-12 right-4 md:bottom-24 md:right-8"
    />
    <AddCard
      v-else
      variant="soft"
      size="lg"
      :trailing="true"
      class="fixed bottom-12 right-4 md:bottom-24 md:right-8"
      @added="onAdded"
    />
  </div>
</template>
