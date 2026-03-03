import { users as usersTable, usersToProjects } from '@carble/db/schema'
import z from 'zod'

export const projectUserSchema = z.object({
  ...createSelectSchema(usersTable).pick({
    id: true,
    username: true,
    name: true,
  }).shape,
  ...createSelectSchema(usersToProjects).pick({
    status: true,
    role: true,
  }).shape,
})

export const projecUsersSchema = z.array(projectUserSchema)

export function useFetchProjectUsersKey() {
  const data = computed(() => {
    const { projectId } = useRoute().params
    return `/api/projects/${projectId}/users`
  })

  return {
    data,
  }
}

export async function useFetchProjectUsers() {
  const { projectId } = useRoute().params

  return useFetch(`/api/projects/${projectId}/users`, {
    transform: (data) => projecUsersSchema.parse(data),
    default: () => projecUsersSchema.parse([]),
    key: useFetchProjectUsersKey().data,
  })
}
