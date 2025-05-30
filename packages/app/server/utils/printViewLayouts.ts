import type { Properties } from 'csstype'

export interface PrintViewLayout {
  id: number
  style: Properties
  areas: {
    id: number
    isReserved?: boolean
    style: Properties
  }[]
  reservedAreas?: {
    style: Properties
  }[]
  unreservedArea?: {
    style: Properties
  }
}

const layouts: PrintViewLayout[] = [
  {
    id: 1,
    style: {
      gridTemplateColumns: '2fr 1fr',
      gridTemplateRows: '2.5fr 1fr',
    },
    areas: [
      {
        id: 1,
        isReserved: true,
        style: {
          gridColumn: '1 / span 1',
          gridRow: '1 / span 1',
        },
      },
      {
        id: 2,
        isReserved: true,
        style: {
          gridColumn: '1 / span 2',
          gridRow: '2 / span 1',
        },
      },
      {
        id: 3,
        style: {
          gridColumn: '2 / span 1',
          gridRow: '1 / span 1',
        },
      },
    ],
  },
  {
    id: 2,
    style: {
      gridTemplateColumns: '2fr 1fr',
    },
    areas: [
      {
        id: 1,
        isReserved: true,
        style: {
          gridColumn: '1 / span 1',
        },
      },
      {
        id: 2,
        style: {
          gridColumn: '2 / span 1',
        },
      },
    ],
  },
  {
    id: 3,
    style: {
      gridTemplateColumns: '2fr 1fr',
      gridTemplateRows: '2.5fr 1fr',
    },
    areas: [
      {
        id: 1,
        isReserved: true,
        style: {
          gridColumn: '1 / span 1',
          gridRow: '1 / span 1',
        },
      },
      {
        id: 2,
        isReserved: true,
        style: {
          gridColumn: '1 / span 1',
          gridRow: '2 / span 1',
        },
      },
      {
        id: 3,
        style: {
          gridColumn: '2 / span 1',
          gridRow: '1 / span 2',
        }
      },
    ],
  },
]

export function getPrintViewLayouts() {
  return [...layouts]
}

export function findPrintViewLayout(id: number = Number(getRouterParam(useEvent(), 'layoutId'))) {
  const layout = layouts.find((layout) => layout.id === id)

  if (!layout) throw createError({ statusCode: 404 })

  return layout
}
