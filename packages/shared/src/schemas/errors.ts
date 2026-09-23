import * as z from 'zod/mini';

/** Shape of every non-2xx JSON response from the API. */
export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    issues: z.optional(z.array(z.object({ path: z.string(), message: z.string() }))),
  }),
});

export type ApiError = z.infer<typeof apiErrorSchema>;
