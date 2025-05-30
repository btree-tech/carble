<script setup lang="ts">
const { data: layouts } = useFetchPrintLayouts()

const { data: setting } = usePrintSettingUpdate()

const { data: layout } = usePrintLayout(() => setting.value.data.layoutId)

const layoutOptions = computed(() => {
  return (layouts.value || []).map((layout) => ({
    label: `パターン${layout.id}`,
    value: layout.id,
  }))
})

watch(
  layout,
  (layout) => {
    if (!layout) return

    const unreservedAreaId = layout.areas.find(({ isReserved }) => !isReserved)?.id
    let hasReserved = false
    setting.value.data.fields.forEach((field) => {
      const area = layout.areas.find(({ id }) => id === field.areaId)
      if (!area) {
        field.areaId = unreservedAreaId ?? 0
      } else if (area.isReserved) {
        if (!hasReserved) {
          hasReserved = true
        } else {
          field.areaId = unreservedAreaId ?? 0
        }
      }
    })
  },
)
</script>

<template>
  <div v-if="setting" class="flex flex-col gap-4">
    <UFormGroup label="レイアウト">
      <USelect
        v-model.number="setting.data.layoutId"
        :options="layoutOptions"
      />
    </UFormGroup>
    <template
      v-for="area in layout?.areas"
      :key="area.id"
    >
      <PrintViewSettingAreaReserved
        v-if="area.isReserved"
        :area="area"
      />
      <PrintViewSettingAreaUnreserved
        v-else
        :area="area"
      />
    </template>
    <UFormGroup label="表示画像枚数">
      <UInput
        v-model="setting.data.displayImageCount"
        type="number"
        min="0"
      />
    </UFormGroup>
    <UFormGroup label="一行あたりの表示画像枚数">
      <UInput
        v-model="setting.data.displayRowImageCount"
        type="number"
        min="0"
      />
    </UFormGroup>
  </div>
</template>
