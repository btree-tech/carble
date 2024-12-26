import { cards, contents, images } from '@carble/db/schema'
import { createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'

export const imageSchema = createSelectSchema(images, {
  createdAt: z.coerce.date(),
})

export const contentSchema = createSelectSchema(contents, {
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export const cardSchema = createSelectSchema(cards, {
  createdAt: z.coerce.date(),
}).extend({
  images: z.array(imageSchema),
  contents: z.array(contentSchema),
})

export const cardsSchema = z.array(cardSchema)

export const useCardsQuery = () => computed(() => String(useRoute().query.q || ''))

export const useCardsSortId = () => computed(() => Number(useRoute().query.sort || 0))

export const useCardsSortDirection = () => computed(() => useRoute().query.direction || 'asc')

export const useCardsQueryParams = () => computed(() => {
  const { q, sort, direction } = useRoute().query
  return { q, sort, direction }
})

export const useCardsQueryString = () => computed(() => {
  return new URLSearchParams({
    q: useCardsQuery().value,
    sort: `${useCardsSortId().value}`,
    direction: `${useCardsSortDirection().value}`,
  }).toString()
})

export const getFetchCardsKey = (projectId: unknown) => {
  return `projects/${projectId}/cards?${useCardsQueryString().value}`
}

export function useFetchCards() {
  const {
    projectId,
  } = useRoute().params

  return useFetch(`/api/projects/${projectId}/cards`, {
    query: {
      q: useCardsQuery(),
      sort: useCardsSortId(),
      direction: useCardsSortDirection(),
    },
    transform: (data) => cardsSchema.parse(data),
    default: () => cardsSchema.parse([]),
    key: getFetchCardsKey(projectId),
  })
}

export function useCardsData() {
  const { projectId } = useRoute().params
  return useTypedNuxtData<typeof cardsSchema>(getFetchCardsKey(projectId))
}

export function useCard(id: MaybeRefOrGetter) {
  const { data: cards } = useCardsData()

  const index = computed(() => cards.value.findIndex((card) => card.id === Number(toValue(id))))
  const data = computed({
    get: () => {
      if (index.value < 0) throw 'invalid cardId'
      return cards.value[index.value]
    },
    set: (value: any) => {
      if (index.value >= 0) {
        if (value) {
          cards.value.splice(index.value, 1, value)
        } else {
          cards.value.splice(index.value, 1)
        }
      }
    },
  })

  return {
    index,
    data,
  }
}

export function useCardContent(cardId: MaybeRefOrGetter, fieldId: MaybeRefOrGetter) {
  const { data: card } = useCard(cardId)

  const index = computed(() => card.value.contents.findIndex((content) => content.fieldId === Number(toValue(fieldId))))
  const data = computed({
    get: () => {
      return index.value < 0
        ? contentSchema.parse({
          projectId: card.value.projectId,
          cardId: card.value.id,
          fieldId: Number(toValue(fieldId)),
          body: '',
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        : card.value.contents[index.value]
    },
    set: (value) => {
      value = contentSchema.parse(value)
      if (index.value < 0) {
        card.value.contents.push(value)
      } else {
        card.value.contents.splice(index.value, 1, value)
      }
    },
  })

  return {
    index,
    data,
  }
}

export function useCardContentUpdate(cardId: MaybeRefOrGetter, fieldId: MaybeRefOrGetter) {
  const { data: content } = useCardContent(cardId, fieldId)

  const data = ref(content.value.body || '')
  const asyncData = useAsyncData(async () => {
    const url = `/api/projects/${content.value.projectId}/cards/${content.value.cardId}/fields/${content.value.fieldId}`
    content.value = await $fetch<any>(url, {
      method: 'put',
      body: {
        body: data.value,
      },
    })
  }, {
    immediate: false,
    watch: [debouncedRef(data, 200)],
  })

  return {
    ...asyncData,
    data,
  }
}

export function useCardImage(cardId: MaybeRefOrGetter, imageId: MaybeRefOrGetter) {
  const { data: card } = useCard(cardId)

  const index = computed(() => card.value.images.findIndex((image) => image.id === Number(toValue(imageId))))
  const data = computed({
    get: () => {
      if (index.value < 0) throw 'invalid cardId'
      return card.value.images[index.value]
    },
    set: (value: any) => {
      if (index.value >= 0) {
        if (value) {
          card.value.images.splice(index.value, 1, value)
        } else {
          card.value.images.splice(index.value, 1)
        }
      }
    },
  })

  return {
    index,
    data,
  }
}

export function useCardImageAdd(cardId: MaybeRefOrGetter) {
  const { data: card } = useCard(cardId)

  const imageFile = ref<File|null>()
  const asyncData = useAsyncData(async () => {
    if (!imageFile.value) return

    const formData = new FormData()
    formData.append('image', imageFile.value)

    const data = await $fetch(`/api/projects/${card.value.projectId}/cards/${card.value.id}/images`, {
      method: 'post',
      body: formData,
    })
    card.value.images.push(imageSchema.parse(data))

    return useCardImage(cardId, data.id).data.value
  })
  const execute = async (file?: File|null) => {
    imageFile.value = file
    await asyncData.execute()
  }

  return {
    ...asyncData,
    execute,
  }
}

export function useCardImageRemove(cardId: MaybeRefOrGetter, imageId: MaybeRefOrGetter) {
  const { data: card } = useCard(cardId)

  return useAsyncData(async () => {
    await $fetch(`/api/projects/${card.value.projectId}/cards/${card.value.id}/images/${toValue(imageId)}`, {
      method: 'delete',
    })
    card.value.images = card.value.images.filter((image) => image.id !== Number(toValue(imageId)))
  }, {
    immediate: false,
  })
}
