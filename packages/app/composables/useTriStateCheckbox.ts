export default function<T>(items: Ref<T[]|null>) {
  const checkedItems: Ref<T[]> = ref([])

  const isCheckedAny = computed(() => {
    return checkedItems.value.length > 0
  })

  const isCheckedAll = computed({
    get: () => isCheckedAny.value,
    set: (value) => {
      checkedItems.value = (value && items.value?.length)
        ? [...items.value]
        : []
    }
  })

  const isIndeterminate = computed(() => {
    return isCheckedAny.value && checkedItems.value.length !== items.value?.length
  })

  watch(items, () => {
    checkedItems.value = []
  })

  return {
    checkedItems,
    isCheckedAny,
    isCheckedAll,
    isIndeterminate,
  }
}
