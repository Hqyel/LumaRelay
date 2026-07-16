import { z } from "zod";

export const RequestIdSchema = z.string().min(1).max(128);

export const ErrorCodeSchema = z.enum([
  "INVALID_REQUEST",
  "NOT_FOUND",
  "SERVER_UNREACHABLE",
  "SERVER_TLS_ERROR",
  "SERVER_TIMEOUT",
  "SERVER_VERSION_UNSUPPORTED",
  "SERVER_NOT_ALLOWED",
  "INTERNAL_ERROR",
]);

export const ApiErrorSchema = z.object({
  code: ErrorCodeSchema,
  message: z.string().min(1),
  requestId: RequestIdSchema,
  details: z.record(z.string(), z.unknown()).optional(),
});

export const ErrorEnvelopeSchema = z.object({
  error: ApiErrorSchema,
});

export type ApiError = z.infer<typeof ApiErrorSchema>;
export type ErrorCode = z.infer<typeof ErrorCodeSchema>;
export type ErrorEnvelope = z.infer<typeof ErrorEnvelopeSchema>;
