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

const fieldVisibilities = ref<Record<number, boolean>>({})
watch(project, (project) => {
  fieldVisibilities.value = {}
  if (!project?.fields.length) return

  project.fields.forEach((field) => {
    fieldVisibilities.value[field.id] = field.isVisible
  })
}, { immediate: true })
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
        flex items-center gap-x-4
        landscape:col-span-2
        portrait:px-4
      "
    >
      <div class="grow truncate">
        {{ project.name }}
      </div>
    </div>
    <div
      class="
        flex items-center gap-x-4
        landscape:col-span-2
        portrait:px-4
      "
    >
      <UButton
        icon="i-material-symbols-light-table-view"
        :to="`/projects/${project.id}`"
        variant="outline"
      >
        <span class="hidden md:inline">テーブルビュー</span>
      </UButton>
    </div>
    <div
      ref="preview"
      class="overflow-x-hidden overflow-y-auto text-black bg-white"
    >
      <PrintViewRenderer
        :field-visibilities="fieldVisibilities"
        class="text-black bg-white origin-top-left"
        :style="{
          scale,
          height: `${scale * 100}%`,
        }"
      />
    </div>
    <div class="portrait:px-4 space-y-4">
      <UButton
        label="印刷"
        size="xl"
        block
        @click="print"
      />
      <div class="space-y-2">
        <div>項目の表示</div>
        <div
          v-for="field in project.fields"
          :key="field.id"
        >
          <UCheckbox
            v-model="fieldVisibilities[field.id]"
            :label="field.name || ''"
          />
        </div>
      </div>
    </div>

    <div
      ref="measuring"
      class="w-[210mm] absolute -top-full -left-full"
    />

    <Teleport to="body">
      <PrintViewRenderer
        :field-visibilities="fieldVisibilities"
        class="text-black hidden print:block"
      />
    </Teleport>
  </div>
</template>

<style>
@page {
  size: A4 portrait;
}
</style>
