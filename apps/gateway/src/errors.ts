import type { ErrorCode, ErrorEnvelope } from "@newemby/contracts";
import type { FastifyInstance } from "fastify";

export function errorEnvelope(
  code: ErrorCode,
  message: string,
  requestId: string,
  details?: Record<string, unknown>,
): ErrorEnvelope {
  return {
    error: {
      code,
      message,
      requestId,
      ...(details === undefined ? {} : { details }),
    },
  };
}

export function registerNotFoundHandler(app: FastifyInstance): void {
  app.setNotFoundHandler((request, reply) => {
    void reply
      .status(404)
      .send(
        errorEnvelope(
          "NOT_FOUND",
          "The requested resource was not found",
          request.id,
        ),
      );
  });
}
