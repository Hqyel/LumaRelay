import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import type { FastifyReply, FastifyRequest } from "fastify";

import type { GatewayConfig } from "./config.js";
import { errorEnvelope } from "./errors.js";

export const CSRF_COOKIE_NAME = "newemby_csrf";
export const CSRF_HEADER_NAME = "x-newemby-csrf";

function signToken(token: string, secret: string): string {
  return createHmac("sha256", secret).update(token).digest("base64url");
}

function encodeCookie(token: string, secret: string): string {
  return `${token}.${signToken(token, secret)}`;
}

function decodeCookie(value: string, secret: string): string | null {
  const separator = value.lastIndexOf(".");
  if (separator <= 0) return null;

  const token = value.slice(0, separator);
  const signature = value.slice(separator + 1);
  const expected = signToken(token, secret);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (
    actualBuffer.byteLength !== expectedBuffer.byteLength ||
    !timingSafeEqual(actualBuffer, expectedBuffer)
  )
    return null;

  return token;
}

function cookieOptions(config: GatewayConfig) {
  return {
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60,
    path: "/",
    sameSite: "lax" as const,
    secure: config.cookieSecure,
  };
}

export function issueCsrfToken(
  request: FastifyRequest,
  reply: FastifyReply,
  config: GatewayConfig,
): string {
  const existing = request.cookies[CSRF_COOKIE_NAME];
  const token =
    existing === undefined
      ? null
      : decodeCookie(existing, config.sessionSecret);
  if (token !== null) return token;

  const created = randomBytes(32).toString("base64url");
  void reply.setCookie(
    CSRF_COOKIE_NAME,
    encodeCookie(created, config.sessionSecret),
    cookieOptions(config),
  );
  return created;
}

export function clearCsrfCookie(
  reply: FastifyReply,
  config: GatewayConfig,
): void {
  void reply.clearCookie(CSRF_COOKIE_NAME, cookieOptions(config));
}

export function validateStateChange(
  request: FastifyRequest,
  reply: FastifyReply,
  config: GatewayConfig,
): boolean {
  if (request.headers.origin !== config.publicOrigin) {
    void reply
      .status(403)
      .send(
        errorEnvelope(
          "ORIGIN_NOT_ALLOWED",
          "The request origin is not allowed",
          request.id,
        ),
      );
    return false;
  }

  const signedCookie = request.cookies[CSRF_COOKIE_NAME];
  const cookieToken =
    signedCookie === undefined
      ? null
      : decodeCookie(signedCookie, config.sessionSecret);
  const header = request.headers[CSRF_HEADER_NAME];
  const headerToken = Array.isArray(header) ? header[0] : header;

  if (
    cookieToken === null ||
    headerToken === undefined ||
    cookieToken.length !== headerToken.length ||
    !timingSafeEqual(Buffer.from(cookieToken), Buffer.from(headerToken))
  ) {
    void reply
      .status(403)
      .send(
        errorEnvelope(
          "CSRF_INVALID",
          "The CSRF token is missing or invalid",
          request.id,
        ),
      );
    return false;
  }

  return true;
}
