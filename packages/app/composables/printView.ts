import { z } from 'zod'

export const printSettingSchema = z.object({
  projectId: z.number(),
  data: z.object({
    layoutId: z.number(),
    displayImageCount: z.number(),
    displayRowImageCount: z.number(),
    fields: z.array(z.object({
      id: z.union([z.number(), z.literal('id'), z.literal('image')]),
      areaId: z.number(),
      isVisible: z.boolean(),
    })),
  }),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type PrintSettingFieldKey = z.infer<typeof printSettingSchema>['data']['fields'][number]['id']

export function getFetchPrintLayoutsKey() {
  return `print_layouts`
}

export function useFetchPrintLayouts() {
  return useFetch(`/api/print_layouts`, {
    key: getFetchPrintLayoutsKey(),
  })
}

export function usePrintLayout(layoutId: MaybeRefOrGetter<number>) {
  const { data: layouts } = useNuxtData<PrintViewLayout[]>(getFetchPrintLayoutsKey())

  const data = computed(() => {
    return layouts.value?.find(({ id }) => id === toValue(layoutId))
  })

  return {
    data,
  }
}

export const getFetchPrintSettingKey = () => {
  const { projectId } = useRoute().params
  return `projects/${projectId}/print_setting`
}

export function useFetchPrintSetting() {
  // const { projectId } = useRoute().params

  // return useFetch(`/api/projects/${projectId}/print_setting`, {
  //   transform: (data) => printSettingSchema.parse(data),
  //   key: getFetchPrintSettingKey(),
  // })

  const data = useState(getFetchPrintSettingKey(), () => {
    const { data: project } = useProjectData()
    const firstVisibleFieldIndex = project.value.fields.findIndex(({ isVisible }) => isVisible)
    const fields: z.infer<typeof printSettingSchema>['data']['fields']  = [{
      id: 'image',
      areaId: 1,
      isVisible: true,
    }]
    if (firstVisibleFieldIndex >= 0) {
      fields.push(
        {
          id: project.value.fields[firstVisibleFieldIndex].id,
          areaId: 2,
          isVisible: true,
        },
        {
          id: 'id',
          areaId: 3,
          isVisible: true,
        },
        ...project.value.fields.toSpliced(firstVisibleFieldIndex, 1).map((field) => ({
          id: field.id,
          areaId: 3,
          isVisible: field.isVisible,
        })),
      )
    } else {
      fields.push(
        {
          id: 'id',
          areaId: 2,
          isVisible: true,
        },
        ...project.value.fields.map((field) => ({
          id: field.id,
          areaId: 3,
          isVisible: field.isVisible,
        })),
      )
    }

    return {
      projectId: project.value.id,
      data: {
        layoutId: 1,
        displayImageCount: 0,
        displayRowImageCount: 0,
        fields,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    } satisfies z.infer<typeof printSettingSchema>
  })

  return {
    data,
  }
}

export function usePrintSetting() {
  return {
    data: useState<z.infer<typeof printSettingSchema>>(getFetchPrintSettingKey()),
  }
  // return useTypedNuxtData<typeof printSettingSchema>(getFetchPrintSettingKey())
}

export function usePrintSettingUpdate() {
  const data = useState<z.infer<typeof printSettingSchema>>(getFetchPrintSettingKey())
  // const { data } = useTypedNuxtData<typeof printSettingSchema>(getFetchPrintSettingKey())

  // const asyncData = useAsyncData(async () => {
  //   await $fetch(`/api/projects/${data.value.projectId}/print_setting`, {
  //     method: 'put',
  //     body: {
  //       body: data.value,
  //     },
  //   })
  // }, {
  //   immediate: false,
  // })

  return {
    // ...asyncData,
    data,
  }
}
