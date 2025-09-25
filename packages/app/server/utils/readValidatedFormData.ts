import type { H3Event, ValidateFunction } from 'h3'

// https://github.com/h3js/h3/blob/v1.15.4/src/utils/internal/validate.ts
export async function readValidatedFormData<T>(
  event: H3Event,
  fn: ValidateFunction<T>,
): Promise<T> {
  try {
    const formData = await readFormData(event)
    if (!formData) {
      throw createValidationError()
    }
    const data = Object.fromEntries(formData.entries())
    const res = await fn(data)
    if (res === false) {
      throw createValidationError()
    }
    if (res === true) {
      return data as T
    }
    return res ?? (data as T)
  } catch (error) {
    throw createValidationError(error)
  }
}

function createValidationError(validateError?: any) {
  throw createError({
    status: 400,
    statusMessage: "Validation Error",
    message: validateError?.message || "Validation Error",
    data: validateError,
  })
}
