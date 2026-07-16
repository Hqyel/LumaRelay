import { ErrorEnvelopeSchema } from "./common.js";
import { HealthResponseSchema } from "./health.js";
import {
  ProbeServerRequestSchema,
  ProbeServerResponseSchema,
} from "./server.js";

export const API_PREFIX = "/api/v1";

export const ApiRoutes = {
  health: {
    method: "GET",
    url: `${API_PREFIX}/health`,
    schema: {
      response: {
        200: HealthResponseSchema,
      },
    },
  },
  probeServer: {
    method: "POST",
    url: `${API_PREFIX}/servers/probe`,
    schema: {
      body: ProbeServerRequestSchema,
      response: {
        200: ProbeServerResponseSchema,
        400: ErrorEnvelopeSchema,
        403: ErrorEnvelopeSchema,
        408: ErrorEnvelopeSchema,
        426: ErrorEnvelopeSchema,
        502: ErrorEnvelopeSchema,
      },
    },
  },
} as const;

export const OpenApiInfo = {
  openapi: "3.1.0",
  info: {
    title: "NewEmby Gateway API",
    version: "0.0.0",
    description: "Shared API contract for NewEmby Web and Player Bridge.",
  },
} as const;
