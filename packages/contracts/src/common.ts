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
  "SERVER_NOT_SELECTED",
  "AUTH_INVALID_CREDENTIALS",
  "AUTH_UPSTREAM_ERROR",
  "UNAUTHENTICATED",
  "RATE_LIMITED",
  "ORIGIN_NOT_ALLOWED",
  "CSRF_INVALID",
  "ACCESS_DENIED",
  "MEDIA_NOT_FOUND",
  "EMBY_WRITE_FAILED",
  "PAIRING_CODE_INVALID",
  "BRIDGE_CREDENTIAL_INVALID",
  "BRIDGE_DEVICE_NOT_FOUND",
  "NONCE_INVALID",
  "REPLAY_DETECTED",
  "PLAY_TICKET_INVALID",
  "PLAYBACK_SESSION_NOT_FOUND",
  "PLAYBACK_EVENT_OUT_OF_ORDER",
  "EMBY_PLAYBACK_FAILED",
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
