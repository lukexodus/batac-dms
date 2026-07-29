import { z } from 'zod';

import { buildMetadataZodSchema } from './metadata-schema-validator';

export const IntakeFormSchema = z.object({
  documentTypeId: z.string().min(1, { message: 'Please select a document type' }),
  title: z
    .string()
    .min(1, { message: 'Title is required' })
    .max(255, { message: 'Title is too long' }),
  metadata: z.record(z.string(), z.any()).default({}),
});

export type IntakeFormValues = z.infer<typeof IntakeFormSchema>;

export function buildIntakeFormSchema(
  metadataJsonSchema: Record<string, unknown> | null | undefined,
) {
  return IntakeFormSchema.extend({
    metadata: buildMetadataZodSchema(metadataJsonSchema),
  });
}

