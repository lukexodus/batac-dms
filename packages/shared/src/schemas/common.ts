import { z } from "zod";

export const UuidSchema = z.string().uuid();
export type Uuid = z.infer<typeof UuidSchema>;

export const TimestampSchema = z.string().datetime({ offset: true });
export type Timestamp = z.infer<typeof TimestampSchema>;

export const DateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date — expected YYYY-MM-DD");
export type DateString = z.infer<typeof DateSchema>;

export const PaginationInputSchema = z.object({
  cursor: UuidSchema.optional(),
  limit: z.number().int().min(1).max(100).default(25),
});
export type PaginationInput = z.infer<typeof PaginationInputSchema>;

export const SortOrderSchema = z.enum(["asc", "desc"]).default("asc");
export type SortOrder = z.infer<typeof SortOrderSchema>;

export const DateRangeSchema = z
  .object({
    from: DateSchema.optional(),
    to: DateSchema.optional(),
  })
  .refine(
    (v) => !(v.from && v.to) || v.from <= v.to,
    { message: "'from' must not be later than 'to'" }
  );
export type DateRange = z.infer<typeof DateRangeSchema>;

export const AllowedMimeTypeSchema = z.enum([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/png",
  "image/jpeg",
]);
export type AllowedMimeType = z.infer<typeof AllowedMimeTypeSchema>;

