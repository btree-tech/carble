<script setup lang="ts">
const { data: project } = useProjectData()

const { data: setting } = await useFetchGridViewSetting()

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
</script>

<template>
  <div class="flex gap-x-4">
    <UFormGroup label="表示項目1">
      <USelect
        v-model="setting.data.fields[0]"
        :options="options"
      />
    </UFormGroup>
    <UFormGroup label="表示項目2">
      <USelect
        v-model="setting.data.fields[1]"
        :options="options"
      />
    </UFormGroup>
  </div>
</template>
