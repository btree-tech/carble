<script setup lang="ts">
import type { TableColumn } from '#ui/types'
import type z from 'zod'

const {
  data: users,
  status,
} = await useFetchProjectUsers()

const columns = markRaw([
  {
    key: 'username',
    label: 'ユーザーID',
  },
  {
    key: 'role',
    label: '権限',
  },
  {
    key: 'status',
    label: 'ステータス',
  },
  {
    key: 'actions',
  }
] satisfies TableColumn[])

const roleMap = markRaw(new Map<z.infer<typeof projectUserSchema>['role'], string>([
  ['owner', '管理者'],
  [null, ''],
]))

const statusMap = markRaw(new Map<z.infer<typeof projectUserSchema>['status'], string>([
  ['invited', '招待中'],
  [null, ''],
]))
</script>

<template>
  <div>
    <UTable
      :columns="columns"
      :rows="users"
      :loading="status === 'pending'"
    >
      <template #role-data="{ row }">
        {{ roleMap.get(row.role) }}
      </template>
      <template #status-data="{ row }">
        <UBadge
          v-if="row.status"
          :label="statusMap.get(row.status)"
          size="sm"
          color="gray"
          variant="subtle"
        />
      </template>
      <template #actions-data="{ row }">
        <ProjectSettingsUserDelete
          v-if="!row.role"
          :user="row"
        />
      </template>
    </UTable>
    <ProjectSettingsUserAdd class="m-4" />
  </div>
</template>
