import { z } from 'zod';

export const IntakeFormSchema = z.object({
  documentTypeId: z.string().min(1, { message: 'Please select a document type' }),
  title: z
    .string()
    .min(1, { message: 'Title is required' })
    .max(255, { message: 'Title is too long' }),
  metadata: z.record(z.unknown()).default({}),
});

export type IntakeFormValues = z.infer<typeof IntakeFormSchema>;
