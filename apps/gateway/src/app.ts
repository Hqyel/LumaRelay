import { randomUUID } from "node:crypto";

import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import {
  ApiRoutes,
  OpenApiInfo,
  type HealthResponse,
  type LoginRequest,
  type PublicUser,
  type ServerSummary,
} from "@newemby/contracts";
import {
  EmbyAuthError,
  EmbyProbeError,
  authenticateUser as authenticateEmbyUser,
  listPublicUsers,
  loadPublicUserAvatar,
  probeEmbyServer,
  type PublicUserAvatar,
  type AuthenticateUserResult,
} from "@newemby/emby-client";
import Fastify, { type FastifyInstance } from "fastify";
import {
  hasZodFastifySchemaValidationErrors,
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";

import type { GatewayConfig } from "./config.js";
import type { AuthSessionStore } from "./database/auth-session-store.js";
import type { ServerStore } from "./database/server-store.js";
import { errorEnvelope, registerNotFoundHandler } from "./errors.js";

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

export interface BuildAppOptions {
  authSessionStore?: AuthSessionStore;
  authenticateUser?: (
    baseUrl: string,
    credentials: LoginRequest & { deviceId: string },
  ) => Promise<AuthenticateUserResult>;
  config: GatewayConfig;
  getPublicUserAvatar?: (
    baseUrl: string,
    userId: string,
  ) => Promise<PublicUserAvatar>;
  getPublicUsers?: (baseUrl: string) => Promise<PublicUser[]>;
  logger?: boolean;
  probeServer?: (baseUrl: string) => Promise<ServerSummary>;
  serverStore?: ServerStore;
  version?: string;
}

function loginErrorResponse(error: EmbyAuthError): {
  code: "AUTH_INVALID_CREDENTIALS" | "AUTH_UPSTREAM_ERROR" | "SERVER_TIMEOUT";
  statusCode: 401 | 408 | 502;
} {
  switch (error.kind) {
    case "unauthorized":
      return { code: "AUTH_INVALID_CREDENTIALS", statusCode: 401 };
    case "timeout":
      return { code: "SERVER_TIMEOUT", statusCode: 408 };
    case "invalid-response":
    case "not-found":
    case "unreachable":
      return { code: "AUTH_UPSTREAM_ERROR", statusCode: 502 };
  }
}

function authErrorResponse(error: EmbyAuthError): {
  code: "AUTH_UPSTREAM_ERROR" | "NOT_FOUND" | "SERVER_TIMEOUT";
  statusCode: 404 | 408 | 502;
} {
  switch (error.kind) {
    case "not-found":
      return { code: "NOT_FOUND", statusCode: 404 };
    case "timeout":
      return { code: "SERVER_TIMEOUT", statusCode: 408 };
    case "invalid-response":
    case "unauthorized":
    case "unreachable":
      return { code: "AUTH_UPSTREAM_ERROR", statusCode: 502 };
  }
}

function probeErrorResponse(error: EmbyProbeError): {
  code:
    | "SERVER_TLS_ERROR"
    | "SERVER_TIMEOUT"
    | "SERVER_UNREACHABLE"
    | "SERVER_VERSION_UNSUPPORTED";
  statusCode: 408 | 426 | 502;
} {
  switch (error.kind) {
    case "tls":
      return { code: "SERVER_TLS_ERROR", statusCode: 502 };
    case "timeout":
      return { code: "SERVER_TIMEOUT", statusCode: 408 };
    case "unsupported-version":
      return { code: "SERVER_VERSION_UNSUPPORTED", statusCode: 426 };
    case "unreachable":
      return { code: "SERVER_UNREACHABLE", statusCode: 502 };
  }
}

function requestIdFromHeader(header: string | string[] | undefined): string {
  const candidate = Array.isArray(header) ? header[0] : header;

  if (candidate !== undefined && REQUEST_ID_PATTERN.test(candidate))
    return candidate;

  return randomUUID();
}

export async function buildApp(
  options: BuildAppOptions,
): Promise<FastifyInstance> {
  const version = options.version ?? "0.0.0";
  let memoryServer: ServerSummary | null = null;
  const serverStore = options.serverStore ?? {
    async getCurrent() {
      return memoryServer;
    },
    async select(server: ServerSummary) {
      memoryServer = server;
    },
  };
  const app = Fastify({
    genReqId: (request) => requestIdFromHeader(request.headers["x-request-id"]),
    logger:
      options.logger === false
        ? false
        : {
            level: options.config.logLevel,
            redact: {
              paths: [
                "req.headers.authorization",
                "req.headers.cookie",
                "req.body.password",
                "res.headers.set-cookie",
              ],
              censor: "[REDACTED]",
            },
          },
    trustProxy: options.config.trustProxy,
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(cookie);
  await app.register(rateLimit, {
    global: false,
    hook: "preHandler",
  });

  await app.register(swagger, {
    openapi: {
      ...OpenApiInfo,
      info: {
        ...OpenApiInfo.info,
        version,
      },
    },
    transform: jsonSchemaTransform,
  });

  app.addHook("onSend", async (request, reply) => {
    void reply.header("x-request-id", request.id);
  });

  app.get(ApiRoutes.health.url, {
    schema: ApiRoutes.health.schema,
    handler(request): HealthResponse {
      return {
        status: "ok",
        service: "gateway",
        version,
        requestId: request.id,
      };
    },
  });

  app.get(ApiRoutes.currentServer.url, {
    schema: ApiRoutes.currentServer.schema,
    async handler(request) {
      return {
        configuredBaseUrl: options.config.embyBaseUrl,
        requestId: request.id,
        server: await serverStore.getCurrent(),
      };
    },
  });

  app.get(ApiRoutes.publicUsers.url, {
    schema: ApiRoutes.publicUsers.schema,
    async handler(request, reply) {
      const server = await serverStore.getCurrent();

      if (server === null)
        return reply
          .status(409)
          .send(
            errorEnvelope(
              "SERVER_NOT_SELECTED",
              "Select an Emby server before loading users",
              request.id,
            ),
          );

      try {
        const users = await (options.getPublicUsers ?? listPublicUsers)(
          server.baseUrl,
        );
        return { requestId: request.id, users };
      } catch (error) {
        const authError =
          error instanceof EmbyAuthError
            ? error
            : new EmbyAuthError(
                "unreachable",
                "Emby public user request failed unexpectedly",
                { cause: error },
              );
        const response = authErrorResponse(authError);
        return reply
          .status(response.statusCode)
          .send(errorEnvelope(response.code, authError.message, request.id));
      }
    },
  });

  app.get(ApiRoutes.publicUserAvatar.url, {
    schema: ApiRoutes.publicUserAvatar.schema,
    async handler(request, reply) {
      const server = await serverStore.getCurrent();

      if (server === null)
        return reply
          .status(409)
          .send(
            errorEnvelope(
              "SERVER_NOT_SELECTED",
              "Select an Emby server before loading an avatar",
              request.id,
            ),
          );

      try {
        const avatar = await (
          options.getPublicUserAvatar ?? loadPublicUserAvatar
        )(server.baseUrl, request.params.userId);

        void reply.type(avatar.contentType);
        if (avatar.cacheControl !== undefined)
          void reply.header("cache-control", avatar.cacheControl);
        if (avatar.etag !== undefined) void reply.header("etag", avatar.etag);
        return reply.send(Buffer.from(avatar.body));
      } catch (error) {
        const authError =
          error instanceof EmbyAuthError
            ? error
            : new EmbyAuthError(
                "unreachable",
                "Emby avatar request failed unexpectedly",
                { cause: error },
              );
        const response = authErrorResponse(authError);
        return reply
          .status(response.statusCode)
          .send(errorEnvelope(response.code, authError.message, request.id));
      }
    },
  });

  app.post(ApiRoutes.login.url, {
    config: {
      rateLimit: {
        keyGenerator(request) {
          const body = request.body as Partial<LoginRequest>;
          const username = body.username?.trim().toLowerCase() ?? "unknown";
          return `${request.ip}:${username}`;
        },
        max: 5,
        timeWindow: 10 * 60 * 1000,
      },
    },
    schema: ApiRoutes.login.schema,
    async handler(request, reply) {
      if (request.headers.origin !== options.config.publicOrigin)
        return reply
          .status(403)
          .send(
            errorEnvelope(
              "ORIGIN_NOT_ALLOWED",
              "The request origin is not allowed",
              request.id,
            ),
          );

      const server = await serverStore.getCurrent();
      if (server === null)
        return reply
          .status(409)
          .send(
            errorEnvelope(
              "SERVER_NOT_SELECTED",
              "Select an Emby server before signing in",
              request.id,
            ),
          );
      if (options.authSessionStore === undefined)
        throw new Error("Auth session store is not configured");

      try {
        const deviceId = await options.authSessionStore.getDeviceId();
        const authentication = await (
          options.authenticateUser ?? authenticateEmbyUser
        )(server.baseUrl, { ...request.body, deviceId });
        const cookieToken = await options.authSessionStore.create({
          accessToken: authentication.accessToken,
          user: authentication.user,
        });

        void reply.setCookie("newemby_session", cookieToken, {
          httpOnly: true,
          maxAge: 7 * 24 * 60 * 60,
          path: "/",
          sameSite: "lax",
          secure: options.config.cookieSecure,
        });
        return {
          requestId: request.id,
          server,
          user: authentication.user,
        };
      } catch (error) {
        const authError =
          error instanceof EmbyAuthError
            ? error
            : new EmbyAuthError(
                "unreachable",
                "Emby authentication failed unexpectedly",
                { cause: error },
              );
        const response = loginErrorResponse(authError);
        return reply
          .status(response.statusCode)
          .send(errorEnvelope(response.code, authError.message, request.id));
      }
    },
  });

  app.post(ApiRoutes.probeServer.url, {
    schema: ApiRoutes.probeServer.schema,
    async handler(request, reply) {
      const origin = new URL(request.body.baseUrl).origin;

      if (!options.config.allowedServerOrigins.includes(origin)) {
        return reply
          .status(403)
          .send(
            errorEnvelope(
              "SERVER_NOT_ALLOWED",
              "The requested Emby origin is not allowed",
              request.id,
            ),
          );
      }

      try {
        const server = await (options.probeServer ?? probeEmbyServer)(
          request.body.baseUrl,
        );
        return {
          server,
          requestId: request.id,
        };
      } catch (error) {
        const probeError =
          error instanceof EmbyProbeError
            ? error
            : new EmbyProbeError(
                "unreachable",
                "Emby probe failed unexpectedly",
                { cause: error },
              );
        const response = probeErrorResponse(probeError);
        return reply
          .status(response.statusCode)
          .send(errorEnvelope(response.code, probeError.message, request.id));
      }
    },
  });

  app.post(ApiRoutes.selectServer.url, {
    schema: ApiRoutes.selectServer.schema,
    async handler(request, reply) {
      const origin = new URL(request.body.baseUrl).origin;

      if (!options.config.allowedServerOrigins.includes(origin)) {
        return reply
          .status(403)
          .send(
            errorEnvelope(
              "SERVER_NOT_ALLOWED",
              "The requested Emby origin is not allowed",
              request.id,
            ),
          );
      }

      try {
        const server = await (options.probeServer ?? probeEmbyServer)(
          request.body.baseUrl,
        );
        await serverStore.select(server);
        return { requestId: request.id, server };
      } catch (error) {
        const probeError =
          error instanceof EmbyProbeError
            ? error
            : new EmbyProbeError(
                "unreachable",
                "Emby probe failed unexpectedly",
                { cause: error },
              );
        const response = probeErrorResponse(probeError);
        return reply
          .status(response.statusCode)
          .send(errorEnvelope(response.code, probeError.message, request.id));
      }
    },
  });

  registerNotFoundHandler(app);

  app.setErrorHandler((error, request, reply) => {
    const statusCode =
      typeof error === "object" &&
      error !== null &&
      "statusCode" in error &&
      typeof error.statusCode === "number"
        ? error.statusCode
        : undefined;

    if (statusCode === 429) {
      void reply
        .status(429)
        .send(
          errorEnvelope(
            "RATE_LIMITED",
            "Too many login attempts; try again later",
            request.id,
          ),
        );
      return;
    }

    if (hasZodFastifySchemaValidationErrors(error)) {
      void reply
        .status(400)
        .send(
          errorEnvelope(
            "INVALID_REQUEST",
            "The request did not match the API contract",
            request.id,
          ),
        );
      return;
    }

    request.log.error({ err: error }, "Unhandled gateway error");
    void reply
      .status(500)
      .send(
        errorEnvelope(
          "INTERNAL_ERROR",
          "An unexpected gateway error occurred",
          request.id,
        ),
      );
  });

  return app;
}
