import { z } from 'zod'

export function useGridViewSelectionState() {
  const { projectId } = useRoute().params
  const { data: cards } = useCardsData()

  const data = useState(`project/${projectId}/grid/selection`, () => new Map<number, boolean>())

  const selectedIds = computed(() => [...data.value.entries()]
    .filter(([, v]) => v)
    .map(([id]) => id)
  )

  watch(cards, (cards) => {
    if (!cards) return
    const prev = new Map(data.value.entries())
    data.value.clear()
    cards.forEach(({ id }) => {
      data.value.set(id, !!prev.get(id))
    })
  })

  return {
    data,
    selectedIds,
  }
}

export const gridViewSettingSchema = z.object({
  projectId: z.number(),
  data: z.object({
    fields: z.array(z.union([z.number(), z.literal('id'), z.literal('image')])).length(2),
  }),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type GrintViewSettingFieldId = z.infer<typeof gridViewSettingSchema>['data']['fields'][number]

export function getFetchGridViewSettingKey() {
  const { projectId } = useRoute().params
  return `project/${projectId}/grid_setting`
}

export function useFetchGridViewSetting() {
  const { projectId } = useRoute().params
  const data = useState(getFetchGridViewSettingKey(), () => ({
    projectId: Number(projectId),
    data: {
      fields: ['image', 'id'],
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  }) satisfies z.infer<typeof gridViewSettingSchema>)

  return {
    data,
  }
}

export function useGridViewSetting() {
  return {
    data: useState<z.infer<typeof gridViewSettingSchema>>(getFetchGridViewSettingKey())
  }
}
