import { randomUUID } from "node:crypto";

import swagger from "@fastify/swagger";
import {
  ApiRoutes,
  OpenApiInfo,
  type HealthResponse,
  type ServerSummary,
} from "@newemby/contracts";
import { EmbyProbeError, probeEmbyServer } from "@newemby/emby-client";
import Fastify, { type FastifyInstance } from "fastify";
import {
  hasZodFastifySchemaValidationErrors,
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";

import type { GatewayConfig } from "./config.js";
import { errorEnvelope, registerNotFoundHandler } from "./errors.js";

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

export interface BuildAppOptions {
  config: GatewayConfig;
  logger?: boolean;
  probeServer?: (baseUrl: string) => Promise<ServerSummary>;
  version?: string;
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
                "res.headers.set-cookie",
              ],
              censor: "[REDACTED]",
            },
          },
    trustProxy: options.config.trustProxy,
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

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

  registerNotFoundHandler(app);

  app.setErrorHandler((error, request, reply) => {
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
