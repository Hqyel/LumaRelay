import type { ErrorCode, ErrorEnvelope } from "@lumarelay/contracts";
import type { FastifyInstance } from "fastify";
import { extname } from "node:path";

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

export function registerNotFoundHandler(
  app: FastifyInstance,
  serveWebApplication = false,
): void {
  app.setNotFoundHandler((request, reply) => {
    const pathname = new URL(request.url, "http://localhost").pathname;
    const acceptsHtml = request.headers.accept
      ?.split(",")
      .some((value) => value.trim().startsWith("text/html"));
    const isNavigation =
      request.method === "GET" &&
      acceptsHtml === true &&
      !pathname.startsWith("/api/") &&
      extname(pathname) === "";

    if (serveWebApplication && isNavigation) {
      void reply.type("text/html; charset=utf-8").sendFile("index.html");
      return;
    }

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
