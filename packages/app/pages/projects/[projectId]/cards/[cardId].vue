<script setup lang="ts">
import { type z } from 'zod'

const {
  projectId,
} = useRoute().params

const {
  data: project,
} = await useFetchProject()

const {
  data: card,
} = await useFetchCard()

const {
  statuses,
  status,
} = useMultiAsyncDataStatus<number>()

const fields = computed(() => (project.value?.fields || []).filter((field) => field.isVisible))

const onDuplicated = async ({ id }: z.infer<typeof cardSchema>) => {
  await navigateTo(`/projects/${projectId}/cards/${id}`)
}
</script>

<template>
  <div
    v-if="project && card"
    class="grid row-auto gap-y-4 px-4"
  >
    <div class="flex items-center justify-end gap-4">
      <StatusIcon :status="status" />
      <UButton
        label="テーブルビュー"
        icon="i-material-symbols-light-table-view"
        :to="`/projects/${projectId}`"
        variant="soft"
      />
      <DuplicateCard
        :card-id="card.id"
        @submitted="onDuplicated"
      />
    </div>
    <ScanButton class="justify-self-end" />
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
            :label="field.name"
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
  </div>
</template>
