import type { BridgeDeviceSummary } from "@newemby/contracts";
import type { FastifyReply, FastifyRequest } from "fastify";

import type { AuthSessionStore } from "./database/auth-session-store.js";
import type { BridgeDeviceStore } from "./database/bridge-device-store.js";
import type { ServerStore } from "./database/server-store.js";
import { errorEnvelope } from "./errors.js";

const DEVICE_AUTHORIZATION_PATTERN = /^NewEmbyDevice ([A-Za-z0-9_-]{43})$/;
const NONCE_PATTERN = /^[A-Za-z0-9_-]{22,128}$/;

export interface BridgeWebAuthDependencies {
  authSessionStore?: AuthSessionStore;
  serverStore: ServerStore;
}

export interface CurrentWebBridgeOwner {
  serverId: string;
  sessionId: string;
  userId: string;
}

export async function currentWebBridgeOwner(
  request: FastifyRequest,
  reply: FastifyReply,
  dependencies: BridgeWebAuthDependencies,
): Promise<CurrentWebBridgeOwner | null> {
  const server = await dependencies.serverStore.getCurrent();
  if (server === null) {
    await reply
      .status(409)
      .send(
        errorEnvelope(
          "SERVER_NOT_SELECTED",
          "Select an Emby server before using a Bridge",
          request.id,
        ),
      );
    return null;
  }

  const cookieToken = request.cookies.newemby_session;
  if (
    cookieToken === undefined ||
    dependencies.authSessionStore === undefined
  ) {
    await reply
      .status(401)
      .send(
        errorEnvelope("UNAUTHENTICATED", "Sign in to continue", request.id),
      );
    return null;
  }

  const session = await dependencies.authSessionStore.find(cookieToken);
  if (session === null || session.user.serverId !== server.serverId) {
    if (session !== null)
      await dependencies.authSessionStore.revoke(cookieToken);
    void reply.clearCookie("newemby_session", { path: "/" });
    await reply
      .status(401)
      .send(
        errorEnvelope(
          "UNAUTHENTICATED",
          "The NewEmby session has expired",
          request.id,
        ),
      );
    return null;
  }

  return {
    serverId: server.serverId,
    sessionId: session.sessionId,
    userId: session.user.userId,
  };
}

export async function authenticateBridgeRequest(
  request: FastifyRequest,
  reply: FastifyReply,
  store: BridgeDeviceStore,
): Promise<BridgeDeviceSummary | null> {
  const authorization = request.headers.authorization;
  const credential = authorization?.match(DEVICE_AUTHORIZATION_PATTERN)?.[1];
  if (credential === undefined) {
    await reply
      .status(401)
      .send(
        errorEnvelope(
          "BRIDGE_CREDENTIAL_INVALID",
          "The Bridge device credential is missing or invalid",
          request.id,
        ),
      );
    return null;
  }

  const nonceHeader = request.headers["x-newemby-nonce"];
  const nonce = Array.isArray(nonceHeader) ? nonceHeader[0] : nonceHeader;
  if (nonce === undefined || !NONCE_PATTERN.test(nonce)) {
    await reply
      .status(400)
      .send(
        errorEnvelope(
          "NONCE_INVALID",
          "The request nonce is missing or invalid",
          request.id,
        ),
      );
    return null;
  }

  const result = await store.authenticate({
    deviceCredential: credential,
    deviceId: (request.params as { deviceId: string }).deviceId,
    nonce,
  });
  if (result.kind === "invalid-credential") {
    await reply
      .status(401)
      .send(
        errorEnvelope(
          "BRIDGE_CREDENTIAL_INVALID",
          "The Bridge device credential is missing or invalid",
          request.id,
        ),
      );
    return null;
  }
  if (result.kind === "replay") {
    await reply
      .status(409)
      .send(
        errorEnvelope(
          "REPLAY_DETECTED",
          "The request nonce has already been used",
          request.id,
        ),
      );
    return null;
  }

  return result.device;
}
