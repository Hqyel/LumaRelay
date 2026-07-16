import { ErrorEnvelopeSchema } from "./common.js";
import {
  LoginRequestSchema,
  LoginResponseSchema,
  PublicUserAvatarParamsSchema,
  PublicUsersResponseSchema,
  SessionResponseSchema,
} from "./auth.js";
import { HealthResponseSchema } from "./health.js";
import {
  CurrentServerResponseSchema,
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
  login: {
    method: "POST",
    url: `${API_PREFIX}/auth/login`,
    schema: {
      body: LoginRequestSchema,
      response: {
        200: LoginResponseSchema,
        400: ErrorEnvelopeSchema,
        401: ErrorEnvelopeSchema,
        403: ErrorEnvelopeSchema,
        408: ErrorEnvelopeSchema,
        409: ErrorEnvelopeSchema,
        429: ErrorEnvelopeSchema,
        502: ErrorEnvelopeSchema,
      },
    },
  },
  currentUser: {
    method: "GET",
    url: `${API_PREFIX}/auth/me`,
    schema: {
      response: {
        200: SessionResponseSchema,
        401: ErrorEnvelopeSchema,
        409: ErrorEnvelopeSchema,
        408: ErrorEnvelopeSchema,
        502: ErrorEnvelopeSchema,
      },
    },
  },
  publicUsers: {
    method: "GET",
    url: `${API_PREFIX}/auth/public-users`,
    schema: {
      response: {
        200: PublicUsersResponseSchema,
        404: ErrorEnvelopeSchema,
        409: ErrorEnvelopeSchema,
        408: ErrorEnvelopeSchema,
        502: ErrorEnvelopeSchema,
      },
    },
  },
  publicUserAvatar: {
    method: "GET",
    url: `${API_PREFIX}/auth/public-users/:userId/avatar`,
    schema: {
      params: PublicUserAvatarParamsSchema,
    },
  },
  currentServer: {
    method: "GET",
    url: `${API_PREFIX}/servers/current`,
    schema: {
      response: {
        200: CurrentServerResponseSchema,
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
  selectServer: {
    method: "POST",
    url: `${API_PREFIX}/servers/select`,
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
