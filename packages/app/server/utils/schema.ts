import { fileTypeFromBlob } from 'file-type'
import { z } from 'zod'

export * from '../../utils/zod'

export async function validate<Schema extends z.ZodTypeAny>(schema: Schema, data: unknown): Promise<z.infer<Schema>> {
  const result = await schema.safeParseAsync(data)

  if (!result.success) {
    console.error(`Validation failed. Error: ${result.error.toString()}, Data: `, data)
    throw createError({ statusCode: 422 })
  }

  return result.data
}

export const formDataSchema = z.instanceof(FormData)
  .transform((data) => Object.fromEntries(data.entries()))

export const imageFileSchema = z.file()
  .transform(async (data) => ({
    data,
    ...await fileTypeFromBlob(data),
  }))
  .pipe(z.object({
    data: z.file(),
    mime: z.string().superRefine((data, ctx) => {
      if (!data.startsWith('image/')) {
        ctx.addIssue({
          code: 'invalid_value',
          values: ['image/*'],
          input: data,
        })
      }
    }),
    ext: z.string(),
  }))
