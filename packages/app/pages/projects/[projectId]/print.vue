<script setup lang="ts">
const { data: project } = await useFetchProject()

await useFetchCards()

const preview = ref<HTMLDivElement>()
const { width: previewWidth } = useElementSize(preview)

const measuring = ref<HTMLDivElement>()
const { width: actualWidth } = useElementSize(measuring)

const scale = computed(() => previewWidth.value / actualWidth.value)

const print = () => {
  window.print()
}
</script>

<template>
  <div
    v-if="project"
    class="
      grid gap-x-8 gap-y-4 max-h-dvh
      landscape:grid-cols-[min(75%,210mm),1fr] landscape:grid-rows-[auto,auto,1fr] landscape:px-4
      portrait:grid-cols-1 portrait:grid-rows-[auto,1fr,auto]
      print:hidden
    "
  >
    <div
      class="
        landscape:col-span-2
        portrait:px-4
      "
    >
      <UButton
        label="プロジェクト一覧に戻る"
        icon="i-material-symbols-light-door-open"
        to="/"
        variant="link"
        :padded="false"
      />
    </div>
    <div
      class="
        flex items-center gap-x-4
        landscape:col-span-2
        portrait:px-4
      "
    >
      <div class="grow truncate">
        {{ project.name }}
      </div>
      <UButton
        icon="i-material-symbols-light-table-view"
        :to="`/projects/${project.id}`"
        variant="soft"
      >
        <span class="hidden md:inline">テーブルビュー</span>
      </UButton>
    </div>
    <div
      ref="preview"
      class="overflow-x-hidden overflow-y-auto text-black bg-white"
    >
      <PrintViewRenderer
        class="text-black bg-white origin-top-left"
        :style="{
          scale,
          height: `${scale * 100}%`,
        }"
      />
    </div>
    <div class="portrait:px-4">
      <UButton
        label="印刷"
        size="xl"
        block
        @click="print"
      />
    </div>

    <div
      ref="measuring"
      class="w-[210mm] absolute -top-full -left-full"
    />

    <Teleport to="body">
      <PrintViewRenderer class="text-black hidden print:block" />
    </Teleport>
  </div>
</template>

<style>
@page {
  size: A4 portrait;
}
</style>
