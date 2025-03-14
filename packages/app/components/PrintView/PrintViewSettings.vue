<script setup lang="ts">
const settings = defineModel<{ layoutId: number, fixedFieldId: number[], displayImageCount: number }>({ required: true })

const {
  data: project,
} = useProjectData()

const layoutOptions = computed(() => {
  return [...PrintViewLayouts.keys()].map((layoutId) => ({
    label: `パターン${layoutId}`,
    value: layoutId,
  }))
})

const fieldOptions = computed(() => {
  return [
    {
      label: '画像',
      value: 0,
    },
    ...project.value.fields.map((field) => ({
      label: field.name,
      value: field.id,
    }))
  ]
})

const reservedAreas = computed(() => {
  return PrintViewLayouts.get(Number(settings.value.layoutId))?.reservedAreas || []
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <UFormGroup label="レイアウト">
      <USelect
        v-model="settings.layoutId"
        :options="layoutOptions"
      />
    </UFormGroup>
    <UFormGroup
      v-for="(_, i) in reservedAreas"
      :key="i"
      :label="`固定領域${i + 1}に表示する項目`"
    >
      <USelect
        v-model="settings.fixedFieldId[i]"
        :options="fieldOptions"
      />
    </UFormGroup>
    <UFormGroup label="表示画像枚数">
      <UInput
        v-model="settings.displayImageCount"
        type="number"
        min="0"
      />
    </UFormGroup>
  </div>
</template>
