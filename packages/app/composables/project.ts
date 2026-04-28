import { cards, fields, imports, projects, users, usersToProjects } from '@carble/db/schema'
import { createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'

export const projectsSchema = z.array(
  createSelectSchema(projects, {
    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date(),
  }).extend({
    users: z.array(z.object({
      user: createSelectSchema(users).pick({
        name: true,
      }),
    })),
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
  })),
  users: z.array(createSelectSchema(usersToProjects).pick({
    role: true,
  })),
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

export function useFetchProjectsKey() {
  return 'projects'
}

export function useFetchProjects() {
  return useFetch(`/api/projects`, {
    transform: (data) => projectsSchema.parse(data),
    default: () => projectsSchema.parse([]),
    key: useFetchProjectsKey(),
  })
}

export function useProjectsData() {
  return useTypedNuxtData<typeof projectSchema>(useFetchProjectsKey())
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

export function getFetchProjectsInvitedKey() {
  return 'projects/?status=invited'
}

export function useFetchProjectsInvited() {
  return useFetch(`/api/projects`, {
    query: {
      status: 'invited',
    },
    transform: (data) => projectsSchema.parse(data),
    default: () => projectsSchema.parse([]),
    key: getFetchProjectsInvitedKey(),
  })
}

export function useProjectsInvitedData() {
  return useTypedNuxtData<typeof projectsSchema>(getFetchProjectsInvitedKey())
}
