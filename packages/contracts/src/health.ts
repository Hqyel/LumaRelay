import { z } from "zod";

import { RequestIdSchema } from "./common.js";

export const HealthResponseSchema = z.object({
  status: z.literal("ok"),
  service: z.literal("gateway"),
  version: z.string().min(1),
  requestId: RequestIdSchema,
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;
