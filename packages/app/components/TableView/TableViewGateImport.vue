<script setup lang="ts">
const {
  data: importingData,
  status,
  refresh,
} = await useFetchProjectImportsInProgress()

const isImporting = computed({
  get: () => !!importingData.value,
  set: () => {},
})
</script>

<template>
  <div>
    <UModal
      v-model="isImporting"
      prevent-close
    >
      <UCard>
        <template #header>インポート中です</template>
        <div class="prose dark:prose-invert">
          <p>現在、 <ClientOnly>{{ importingData?.createdAt.toLocaleString() }}</ClientOnly> にアップロードされた {{ importingData?.originalFilename }} を処理中です。</p>
        </div>
        <template #footer>
          <div class="text-center">
            <UButton
              label="再読み込み"
              icon="i-material-symbols-light-refresh"
              variant="outline"
              :loading="status === 'pending'"
              class="mx-auto"
              @click="refresh"
            />
          </div>
        </template>
      </UCard>
    </UModal>
    <slot v-if="!isImporting" />
  </div>
</template>
