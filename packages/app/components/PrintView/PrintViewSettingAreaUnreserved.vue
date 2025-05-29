<script setup lang="ts">
const props = defineProps<{
  area: PrintViewLayout['areas'][number]
}>()

const { data: project } = useProjectData()

const { data: printSetting } = usePrintSettingUpdate()

const fields = computed(() => {
  const fieldIds = new Set<PrintSettingFieldKey>([
    'image',
    'id',
    ...project.value.fields.map(({ id }) => id),
  ])
  .difference(new Set(
    printSetting.value.data.fields
      .filter(({ areaId }) => areaId !== props.area.id)
      .map(({ id }) => id)
  ))

  return new Map([...fieldIds].map((fieldId) => {
    const field = project.value.fields.find(({ id }) => id === fieldId)
    let name = field?.name ?? ''
    let isVisible = printSetting.value.data.fields.find(({ id }) => id === fieldId)?.isVisible
    if (fieldId === 'id') {
      name = 'ID'
      isVisible ??= true
    } else if (fieldId === 'image') {
      name = '画像'
      isVisible ??= false
    } else {
      isVisible ??= field?.isVisible ?? true
    }
    return [fieldId, { name, isVisible }]
  }))
})

const toggle = (fieldId: PrintSettingFieldKey) => {
  const index = printSetting.value.data.fields.findIndex(({ id }) => id === fieldId)
  if (index < 0) return

  printSetting.value = {
    ...printSetting.value,
    data: {
      ...printSetting.value.data,
      fields: printSetting.value.data.fields.toSpliced(index, 1, {
        ...printSetting.value.data.fields[index],
        isVisible: !fields.value.get(fieldId)?.isVisible,
      }),
    },
  }
}
</script>

<template>
  <UFormGroup label="任意項目">
    <div class="flex flex-col gap-1">
      <div
        v-for="[id, { name, isVisible }] in fields"
        :key="id"
        class="flex items-center"
      >
        <div class="grow">
          {{ name }}
        </div>
        <UButton
          :icon="isVisible ? 'i-material-symbols-light-visibility': 'i-material-symbols-light-visibility-off'"
          color="gray"
          @click="toggle(id)"
        />
      </div>
    </div>
  </UFormGroup>
</template>
