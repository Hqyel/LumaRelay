import { z } from "zod";

import { RequestIdSchema } from "./common.js";

export const ServerCapabilityFlagsSchema = z.object({
  imageProcessing: z.boolean().optional(),
  publicInfo: z.boolean(),
  publicUsers: z.boolean().optional(),
  ping: z.boolean(),
  userAuthentication: z.boolean().optional(),
  userItems: z.boolean().optional(),
  userViews: z.boolean().optional(),
});

export const ServerSummarySchema = z.object({
  serverId: z.string().min(1),
  name: z.string().min(1),
  version: z.string().min(1),
  baseUrl: z.url(),
  latencyMs: z.number().int().nonnegative(),
  supportsHttps: z.boolean(),
  capabilityFlags: ServerCapabilityFlagsSchema,
});

export const ProbeServerRequestSchema = z.object({
  baseUrl: z.url(),
});

export const ProbeServerResponseSchema = z.object({
  server: ServerSummarySchema,
  requestId: RequestIdSchema,
});

export const CurrentServerResponseSchema = z.object({
  server: ServerSummarySchema.nullable(),
  configuredBaseUrl: z.url(),
  requestId: RequestIdSchema,
});

export type ProbeServerRequest = z.infer<typeof ProbeServerRequestSchema>;
export type ProbeServerResponse = z.infer<typeof ProbeServerResponseSchema>;
export type CurrentServerResponse = z.infer<typeof CurrentServerResponseSchema>;
export type ServerCapabilityFlags = z.infer<typeof ServerCapabilityFlagsSchema>;
export type ServerSummary = z.infer<typeof ServerSummarySchema>;
