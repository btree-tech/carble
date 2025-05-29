<script setup lang="ts">
const props = defineProps<{
  area: PrintViewLayout['areas'][number]
}>()

const { data: project } = useProjectData()

const { data: setting } = usePrintSettingUpdate()

const { data: layout } = usePrintLayout(() => setting.value.data.layoutId)

const options = computed(() => [
  {
    label: '画像',
    value: 'image',
  },
  {
    label: 'ID',
    value: 'id',
  },
  ...project.value.fields.map((field) => ({
    label: field.name,
    value: field.id,
  })),
])

const fieldId = computed({
  get: () => {
    return setting.value.data.fields.find(({ areaId }) => areaId === props.area.id)?.id
  },
  set: (value) => {
    if (value === undefined) return
    value = Number.isNaN(Number(value)) ? value : Number(value)
    const unreservedAreaId = layout.value?.areas.find(({ isReserved }) => !isReserved)?.id
    setting.value = {
      ...setting.value,
      data: {
        ...setting.value.data,
        fields: setting.value.data.fields.map((setting) => {
          if (setting.id === value) {
            setting.areaId = props.area.id
          } else if (setting.areaId === props.area.id) {
            setting.areaId = unreservedAreaId ?? 0
          }
          return setting
        }),
      },
    }
  },
})
</script>

<template>
  <UFormGroup :label="`固定領域${area.id}`">
    <USelect
      v-model="fieldId"
      :options="options"
    />
  </UFormGroup>
</template>
