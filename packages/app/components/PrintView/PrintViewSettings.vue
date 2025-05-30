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
