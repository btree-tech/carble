export default defineNuxtPlugin({
  setup: async () => {
    const { BarcodeDetector } = await import('barcode-detector')
    return {
      provide: {
        BarcodeDetector,
      }
    }
  },
})