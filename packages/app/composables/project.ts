import { cards, fields, projects } from '@carble/db/schema'
import { createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'

export const projectsSchema = z.array(createSelectSchema(projects, {
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
}))

export const fieldSchema = createSelectSchema(fields, {
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export const projectSchema = z.object({
  ...projectsSchema.element.shape,
  fields: z.array(fieldSchema),
  cards: z.array(createSelectSchema(cards).pick({
    id: true,
  }))
}).transform((v) => ({
  ...v,
  totalCardSize: v.cards.length,
}))

export function useFetchProjects() {
  return useFetch(`/api/projects`, {
    transform: (data) => projectsSchema.parse(data),
    default: () => projectsSchema.parse([]),
    key: 'projects',
  })
}

export function useProjectsData() {
  return useTypedNuxtData<typeof projectSchema>('projects')
}

export const FetchProjectKey = 'project'

export function useFetchProject() {
  const {
    projectId,
  } = useRoute().params

  return useFetch(`/api/projects/${projectId}`, {
    transform: (data) => projectSchema.parse(data),
    key: FetchProjectKey,
  })
}

export function useProjectData() {
  return useTypedNuxtData<typeof projectSchema>(FetchProjectKey)
}
