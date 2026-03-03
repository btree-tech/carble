<script setup lang="ts">
import type { AlertAction } from '#ui/types'
import type z from 'zod'

const props = defineProps<{
  project: z.infer<typeof projectsSchema.element>
}>()

const session = authClient.useSession()

const actions = computed(() => [
  {
    label: '承認',
    click: join,
    loading: joinStatus.value === 'pending',
    disabled: denyStatus.value === 'pending',
  },
  {
    label: '拒否',
    color: 'red',
    click: deny,
    loading: denyStatus.value === 'pending',
    disabled: joinStatus.value === 'pending',
  },
] satisfies AlertAction[])

const {
  execute: join,
  status: joinStatus,
} = useAsyncStatus(async () => {
  await $fetch(`/api/projects/${props.project.id}/users/${session.value.data?.user.id}`, {
    method: 'put',
    body: {
      status: null,
    },
  })
  await refreshNuxtData([
    getFetchProjectsInvitedKey(),
    useFetchProjectsKey(),
  ])
}, {
  immediate: false,
})

const {
  execute: deny,
  status: denyStatus,
} = useAsyncStatus(async () => {
  await $fetch(`/api/projects/${props.project.id}/users/${session.value.data?.user.id}`, {
    method: 'delete',
  })
  await refreshNuxtData(getFetchProjectsInvitedKey())
}, {
  immediate: false,
})
</script>

<template>
  <UAlert
    :title="`「${project.name}」に招待されています`"
    :actions="actions"
    color="primary"
    variant="subtle"
  />
</template>
