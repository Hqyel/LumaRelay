import { z } from "zod";

import { RequestIdSchema } from "./common.js";

export const CsrfResponseSchema = z.object({
  csrfToken: z.string().min(32),
  requestId: RequestIdSchema,
});

export type CsrfResponse = z.infer<typeof CsrfResponseSchema>;
