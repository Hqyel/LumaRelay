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
  type UserProfile,
} from "@newemby/contracts";
import {
  EmbyAuthError,
  EmbyProbeError,
  authenticateUser as authenticateEmbyUser,
  getAuthenticatedUser as getEmbyAuthenticatedUser,
  listPublicUsers,
  loadPublicUserAvatar,
  logoutEmbySession,
  probeEmbyServer,
  type PublicUserAvatar,
  type AuthenticateUserResult,
  type CurrentUserRequest,
  type LogoutSessionRequest,
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
import {
  clearCsrfCookie,
  issueCsrfToken,
  validateStateChange,
} from "./csrf.js";
import type { AuthSessionStore } from "./database/auth-session-store.js";
import type { BridgeDeviceStore } from "./database/bridge-device-store.js";
import type { PairingCodeStore } from "./database/pairing-code-store.js";
import type { PlayTicketStore } from "./database/play-ticket-store.js";
import type { ServerStore } from "./database/server-store.js";
import { errorEnvelope, registerNotFoundHandler } from "./errors.js";
import { registerDeviceRoutes } from "./device-routes.js";
import {
  registerMediaRoutes,
  type MediaRouteDependencies,
} from "./media-routes.js";
import { registerPairingRoutes } from "./pairing-routes.js";
import { registerPlayTicketRoutes } from "./play-ticket-routes.js";
import {
  registerPlaybackRoutes,
  type PlaybackRouteDependencies,
} from "./playback-routes.js";

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

export interface BuildAppOptions {
  authSessionStore?: AuthSessionStore;
  bridgeDeviceStore?: BridgeDeviceStore;
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
  getAuthenticatedUser?: (
    baseUrl: string,
    input: CurrentUserRequest,
  ) => Promise<UserProfile>;
  logger?: boolean;
  logoutSession?: (
    baseUrl: string,
    input: LogoutSessionRequest,
  ) => Promise<void>;
  probeServer?: (baseUrl: string) => Promise<ServerSummary>;
  serverStore?: ServerStore;
  version?: string;
  media?: Omit<
    MediaRouteDependencies,
    "authSessionStore" | "config" | "serverStore"
  >;
  pairingCodeStore?: PairingCodeStore;
  playTicketStore?: PlayTicketStore;
  playback?: Omit<
    PlaybackRouteDependencies,
    "authSessionStore" | "bridgeDeviceStore" | "playTicketStore" | "serverStore"
  >;
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

  app.get(ApiRoutes.csrf.url, {
    schema: ApiRoutes.csrf.schema,
    handler(request, reply) {
      return {
        csrfToken: issueCsrfToken(request, reply, options.config),
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

  app.get(ApiRoutes.currentUser.url, {
    schema: ApiRoutes.currentUser.schema,
    async handler(request, reply) {
      const server = await serverStore.getCurrent();
      if (server === null)
        return reply
          .status(409)
          .send(
            errorEnvelope(
              "SERVER_NOT_SELECTED",
              "Select an Emby server before loading a session",
              request.id,
            ),
          );

      const cookieToken = request.cookies.newemby_session;
      if (cookieToken === undefined || options.authSessionStore === undefined)
        return reply
          .status(401)
          .send(
            errorEnvelope("UNAUTHENTICATED", "Sign in to continue", request.id),
          );

      const session = await options.authSessionStore.find(cookieToken);
      if (session === null || session.user.serverId !== server.serverId) {
        if (session !== null)
          await options.authSessionStore.revoke(cookieToken);
        void reply.clearCookie("newemby_session", { path: "/" });
        return reply
          .status(401)
          .send(
            errorEnvelope(
              "UNAUTHENTICATED",
              "The NewEmby session has expired",
              request.id,
            ),
          );
      }

      try {
        const deviceId = await options.authSessionStore.getDeviceId();
        const user = await (
          options.getAuthenticatedUser ?? getEmbyAuthenticatedUser
        )(server.baseUrl, {
          accessToken: session.accessToken,
          deviceId,
          serverId: server.serverId,
          userId: session.user.userId,
        });
        await options.authSessionStore.updateUser(session.sessionId, user);

        return { requestId: request.id, server, user };
      } catch (error) {
        const authError =
          error instanceof EmbyAuthError
            ? error
            : new EmbyAuthError(
                "unreachable",
                "Emby user refresh failed unexpectedly",
                { cause: error },
              );

        if (authError.kind === "unauthorized") {
          await options.authSessionStore.revoke(cookieToken);
          void reply.clearCookie("newemby_session", { path: "/" });
          return reply
            .status(401)
            .send(
              errorEnvelope(
                "UNAUTHENTICATED",
                "The Emby session has expired",
                request.id,
              ),
            );
        }

        const response =
          authError.kind === "timeout"
            ? ({ code: "SERVER_TIMEOUT", statusCode: 408 } as const)
            : ({ code: "AUTH_UPSTREAM_ERROR", statusCode: 502 } as const);
        return reply
          .status(response.statusCode)
          .send(errorEnvelope(response.code, authError.message, request.id));
      }
    },
  });

  app.post(ApiRoutes.logout.url, {
    schema: ApiRoutes.logout.schema,
    async handler(request, reply) {
      if (!validateStateChange(request, reply, options.config)) return;

      const cookieToken = request.cookies.newemby_session;
      void reply.clearCookie("newemby_session", { path: "/" });
      clearCsrfCookie(reply, options.config);

      if (cookieToken === undefined || options.authSessionStore === undefined)
        return { requestId: request.id, success: true as const };

      const session = await options.authSessionStore.find(cookieToken);
      await options.authSessionStore.revoke(cookieToken);

      const server = await serverStore.getCurrent();
      if (session !== null && server?.serverId === session.user.serverId) {
        try {
          const deviceId = await options.authSessionStore.getDeviceId();
          await (options.logoutSession ?? logoutEmbySession)(server.baseUrl, {
            accessToken: session.accessToken,
            deviceId,
          });
        } catch {
          // Local revocation is authoritative; upstream logout is best effort.
        }
      }

      return { requestId: request.id, success: true as const };
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
      if (!validateStateChange(request, reply, options.config)) return;

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

      const deviceId = await options.authSessionStore.getDeviceId();
      let authentication: AuthenticateUserResult;
      try {
        authentication = await (
          options.authenticateUser ?? authenticateEmbyUser
        )(server.baseUrl, { ...request.body, deviceId });
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

      let cookieToken: string;
      try {
        cookieToken = await options.authSessionStore.create({
          accessToken: authentication.accessToken,
          user: authentication.user,
        });
      } catch (error) {
        try {
          await (options.logoutSession ?? logoutEmbySession)(server.baseUrl, {
            accessToken: authentication.accessToken,
            deviceId,
          });
        } catch {
          // The local persistence error remains authoritative.
        }
        throw error;
      }

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
      if (!validateStateChange(request, reply, options.config)) return;

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

      let server: ServerSummary;
      try {
        server = await (options.probeServer ?? probeEmbyServer)(
          request.body.baseUrl,
        );
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

      const currentServer = await serverStore.getCurrent();
      if (
        currentServer !== null &&
        currentServer.serverId !== server.serverId
      ) {
        void reply.clearCookie("newemby_session", { path: "/" });
        if (options.bridgeDeviceStore !== undefined) {
          await options.bridgeDeviceStore.revokeServerDevices(
            currentServer.serverId,
          );
        }

        if (options.authSessionStore !== undefined) {
          const sessions = await options.authSessionStore.revokeServerSessions(
            currentServer.serverId,
          );
          try {
            const deviceId = await options.authSessionStore.getDeviceId();
            for (const session of sessions) {
              try {
                await (options.logoutSession ?? logoutEmbySession)(
                  currentServer.baseUrl,
                  { accessToken: session.accessToken, deviceId },
                );
              } catch {
                // Local server revocation is authoritative.
              }
            }
          } catch {
            // Sessions remain revoked if device ID access fails.
          }
        }
      }

      await serverStore.select(server);
      return { requestId: request.id, server };
    },
  });

  registerMediaRoutes(app, {
    ...options.media,
    authSessionStore: options.authSessionStore,
    config: options.config,
    serverStore,
  });
  registerPairingRoutes(app, {
    authSessionStore: options.authSessionStore,
    config: options.config,
    pairingCodeStore: options.pairingCodeStore,
    serverStore,
  });
  registerDeviceRoutes(app, {
    authSessionStore: options.authSessionStore,
    bridgeDeviceStore: options.bridgeDeviceStore,
    config: options.config,
    serverStore,
  });
  registerPlayTicketRoutes(app, {
    authSessionStore: options.authSessionStore,
    bridgeDeviceStore: options.bridgeDeviceStore,
    config: options.config,
    playTicketStore: options.playTicketStore,
    serverStore,
  });
  registerPlaybackRoutes(app, {
    ...options.playback,
    authSessionStore: options.authSessionStore,
    bridgeDeviceStore: options.bridgeDeviceStore,
    playTicketStore: options.playTicketStore,
    serverStore,
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
            "Too many requests; try again later",
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
