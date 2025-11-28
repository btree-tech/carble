import { z } from 'zod'

export function useGridViewSelectionState() {
  const { projectId } = useRoute().params
  const { data: cards } = useCardsData()

  const shiftKeyState = useKeyModifier('Shift')

  const state = useState(`project/${projectId}/grid/selection`, () => [] as number[])

  const lastSelected = useState<number|null>(`project/${projectId}/grid/selection/latest`, () => null)

  const data = computed({
    get: () => state.value,
    set: (value) => {
      const newData = new Set(value)
      const isAdded = value.length > state.value.length
      const latestSelected = [...newData.symmetricDifference(new Set(state.value))][0]
      if (shiftKeyState.value && lastSelected.value) {
        const ids = [latestSelected, lastSelected.value]
        const start = cards.value.findIndex(({ id }) => ids.includes(id))
        const end = cards.value.findLastIndex(({ id }) => ids.includes(id))
        cards.value.slice(start, end + 1).forEach(({ id }) => {
          if (isAdded) {
            newData.add(id)
          } else {
            newData.delete(id)
          }
        })
      }
      lastSelected.value = newData.size ? latestSelected : null
      state.value = [...newData]
    },
  })

  watch(cards, (cards) => {
    if (!cards) return
    state.value = state.value.filter((cardId) => cards.some(({ id }) => id === cardId))
  })

  return {
    data,
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
