import { cards, fields, imports, projects } from '@carble/db/schema'
import { createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'

export const projectsSchema = z.array(
  createSelectSchema(projects, {
    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date(),
  }).extend({
    imports: z.array(createSelectSchema(imports, {
      createdAt: z.coerce.date(),
      updatedAt: z.coerce.date(),
      notifiedAt: z.coerce.date(),
    })),
  })
)

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
}).omit({
  imports: true,
})

export const importsSchema = z.object({
  items: z.array(createSelectSchema(imports, {
    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date(),
    notifiedAt: z.coerce.date(),
  })),
  total: z.number(),
  pageCount: z.number(),
}).default({
  items: [],
  total: 0,
  pageCount: 10,
})

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

export const getFetchProjectKey = () => {
  const { projectId } = useRoute().params
  return `projects/${projectId}`
}

export function useFetchProject() {
  const {
    projectId,
  } = useRoute().params

  return useFetch(`/api/projects/${projectId}`, {
    transform: (data) => projectSchema.parse(data),
    key: getFetchProjectKey(),
  })
}

export function useProjectData() {
  return useTypedNuxtData<typeof projectSchema>(getFetchProjectKey())
}

export function getFetchProjectImportsInProgressKey() {
  const { projectId } = useRoute().params
  return `projects/${projectId}/imports?status=OPEN&status=IN_PROGRESS`
}

export function useFetchProjectImportsInProgress() {
  const {
    projectId,
  } = useRoute().params

  return useFetch(`/api/projects/${projectId}/imports`, {
    query: {
      status: ['OPEN', 'IN_PROGRESS'],
      pageCount: 1,
    },
    transform: (data) => importsSchema.parse(data).items.at(0),
    key: getFetchProjectImportsInProgressKey(),
  })
}
