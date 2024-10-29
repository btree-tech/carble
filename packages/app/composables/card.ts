import { cards, contents, images } from '@carble/db/schema'
import { createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'

export const cardsSchema = z.array(
  createSelectSchema(cards, {
    createdAt: z.coerce.date(),
  }).extend({
    images: z.array(createSelectSchema(images, {
      createdAt: z.coerce.date(),
    })),
    contents: z.array(createSelectSchema(contents, {
      createdAt: z.coerce.date(),
      updatedAt: z.coerce.date(),
    })),
  })
)

export const useCardsQuery = () => useState<string>('cardsQuery', () => '')

export const useCardsSortId = () => useState('cardsSortId', () => 0)

export const useCardsSortDirection = () => useState<'asc'|'desc'>('useCardsSortDirection', () => 'asc')

export const FetchCardsKey = 'cards'

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
    key: FetchCardsKey,
  })
}

export function useCardsData() {
  return useTypedNuxtData<typeof cardsSchema>(FetchCardsKey)
}

export function useCardsDataItem(id: MaybeRefOrGetter<number>) {
  const { data: cards } = useCardsData()
  const index = computed(() => cards.value.findIndex((card) => card.id === toValue(id)))
  const data = computed({
    get: () => {
      if (index.value < 0) throw 'invalid cardId'
      return cards.value[index.value]
    },
    set: (value) => {
      if (index.value >= 0) {
        cards.value[index.value] = value
      }
    },
  })

  return {
    index,
    data,
  }
}

export const cardSchema = cardsSchema.element

export const FetchCardKey = 'card'

export function useFetchCard() {
  const {
    projectId,
    cardId,
  } = useRoute().params

  return useFetch(`/api/projects/${projectId}/cards/${cardId}`, {
    transform: (data) => cardSchema.parse(data),
    key: FetchCardKey,
  })
}

export function useCardData() {
  return useTypedNuxtData<typeof cardSchema>(FetchCardKey)
}
