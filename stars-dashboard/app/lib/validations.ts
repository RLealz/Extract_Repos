import { z } from "zod";

export const starredQuerySchema = z.object({
  username: z.string().min(1, "Username is required").trim(),
  page: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : 1))
    .pipe(z.number().int().min(1)).default(1),
  per_page: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : 30))
    .pipe(z.number().int().min(1).max(100)).default(30),
});

export type StarredQuery = z.infer<typeof starredQuerySchema>;

// Add body schema for export API
export const exportRequestSchema = z.object({
  username: z.string().min(1, "Username is required").trim(),
  format: z.enum(["json", "csv"]).optional().default("json"),
});

export type ExportRequest = z.infer<typeof exportRequestSchema>;