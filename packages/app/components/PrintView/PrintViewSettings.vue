<script setup lang="ts">
const visibleFieldIds = defineModel<number[]>({ required: true })

const {
  data: project,
} = useProjectData()
</script>

<template>
  <div class="space-y-2">
    <div>項目の表示</div>
    <div
      v-for="field in project.fields"
      :key="field.id"
    >
      <UCheckbox
        v-model="visibleFieldIds"
        :label="field.name || ''"
        :value="field.id"
      />
    </div>
  </div>
</template>
