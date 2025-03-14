export interface PrintViewLayout {
  style: {
    gridTemplateColumns?: string
    gridTemplateRows?: string
  }
  reservedAreas?: {
    style: {
      gridColumn?: string
      gridRow?: string
    }
  }[]
  unreservedArea?: {
    style: {
      gridColumn?: string
      gridRow?: string
    }
  }
}

export const PrintViewLayouts = new Map<number, PrintViewLayout>([
  [1, {
      style: {
        gridTemplateColumns: '2fr 1fr',
        gridTemplateRows: '2.5fr 1fr',
      },
      reservedAreas: [
        {
          style: {
            gridColumn: '1 / span 1',
            gridRow: '1 / span 1',
          }
        },
        {
          style: {
            gridColumn: '1 / span 2',
            gridRow: '2 / span 1',
          }
        },
      ],
      unreservedArea: {
        style: {
          gridColumn: '2 / span 1',
          gridRow: '1 / span 1',
        }
      },
    }
  ],
  [2, {
      style: {
        gridTemplateColumns: '2fr 1fr',
      },
      reservedAreas: [
        {
          style: {
            gridColumn: '1 / span 1',
          }
        },
      ],
      unreservedArea: {
        style: {
          gridColumn: '2 / span 1',
        }
      },
    }
  ],
  [3, {
      style: {
        gridTemplateColumns: '2fr 1fr',
        gridTemplateRows: '2.5fr 1fr',
      },
      reservedAreas: [
        {
          style: {
            gridColumn: '1 / span 1',
            gridRow: '1 / span 1',
          }
        },
        {
          style: {
            gridColumn: '1 / span 1',
            gridRow: '2 / span 1',
          }
        },
      ],
      unreservedArea: {
        style: {
          gridColumn: '2 / span 1',
          gridRow: '1 / span 2',
        }
      },
    }
  ],
])
