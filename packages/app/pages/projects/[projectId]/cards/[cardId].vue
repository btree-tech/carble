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
</script>

<template>
  <div
    v-if="project && card"
    class="grid row-auto gap-y-4 px-4 mb-16 grid-cols-1"
  >
    <div
      class="
        flex items-center gap-x-4"
    >
      <div class="grow truncate">
        {{ project.name }}
      </div>
      <ScanButton class="justify-self-end" />
    </div>
    <div class="flex items-center justify-between gap-4">
      <UButton
        label="テーブルビュー"
        icon="i-material-symbols-light-table-view"
        :to="`/projects/${projectId}?${query}`"
        variant="outline"
      />
      <div class="justify-self-end">
        <StatusIcon :status="status" class="mr-4"/>
        <DuplicateCard
          :card-id="card.id"
          @submitted="onDuplicated"
        />
      </div>
    </div>
    <div
      class="
        grid grid-cols-2 items-start gap-8 my-8
        portrait:grid-cols-1
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

    <UButton
      v-if="previousCard"
      label="前のカード"
      icon="i-material-symbols-light-arrow-back-ios-new"
      :to="`/projects/${projectId}/cards/${previousCard.id}?${query}`"
      variant="outline"
      size="lg"
      class="fixed bottom-8 left-4 md:bottom-16 md:left-8"
    />
    <UButton
      v-if="nextCard"
      label="次のカード"
      icon="i-material-symbols-light-arrow-forward-ios"
      :to="`/projects/${projectId}/cards/${nextCard.id}?${query}`"
      variant="outline"
      size="lg"
      :trailing="true"
      class="fixed bottom-8 right-4 md:bottom-16 md:right-8"
    />
  </div>
</template>
