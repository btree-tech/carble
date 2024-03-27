import { type z } from 'zod'

export async function validate<Schema extends z.ZodTypeAny>(schema: Schema, data: unknown): Promise<z.infer<Schema>> {
  const result = await schema.safeParseAsync(data)

  if (!result.success) {
    console.error(`Validation failed. Error: ${result.error.toString()}, Data: `, data)
    throw createError({ statusCode: 422 })
  }

  return result.data
}
