import {
  ApiRoutes,
  type BridgeDeviceSummary,
  type BridgeHeartbeatResponse,
} from "@newemby/contracts";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import type { GatewayConfig } from "./config.js";
import { validateStateChange } from "./csrf.js";
import type { AuthSessionStore } from "./database/auth-session-store.js";
import type { BridgeDeviceStore } from "./database/bridge-device-store.js";
import type { ServerStore } from "./database/server-store.js";
import { errorEnvelope } from "./errors.js";

const DEVICE_AUTHORIZATION_PATTERN = /^NewEmbyDevice ([A-Za-z0-9_-]{43})$/;
const NONCE_PATTERN = /^[A-Za-z0-9_-]{22,128}$/;

export interface DeviceRouteDependencies {
  authSessionStore?: AuthSessionStore;
  bridgeDeviceStore?: BridgeDeviceStore;
  config: GatewayConfig;
  serverStore: ServerStore;
}

interface WebDeviceOwner {
  serverId: string;
  userId: string;
}

async function currentWebDeviceOwner(
  request: FastifyRequest,
  reply: FastifyReply,
  dependencies: DeviceRouteDependencies,
): Promise<WebDeviceOwner | null> {
  const server = await dependencies.serverStore.getCurrent();
  if (server === null) {
    await reply
      .status(409)
      .send(
        errorEnvelope(
          "SERVER_NOT_SELECTED",
          "Select an Emby server before managing Bridge devices",
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
    userId: session.user.userId,
  };
}

async function authenticateBridgeRequest(
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

export function registerDeviceRoutes(
  app: FastifyInstance,
  dependencies: DeviceRouteDependencies,
): void {
  app.post(ApiRoutes.bridgeHeartbeat.url, {
    config: {
      rateLimit: {
        max: 120,
        timeWindow: 60 * 1000,
      },
    },
    schema: ApiRoutes.bridgeHeartbeat.schema,
    async handler(request, reply): Promise<BridgeHeartbeatResponse | unknown> {
      if (dependencies.bridgeDeviceStore === undefined)
        throw new Error("Bridge device store is not configured");

      const device = await authenticateBridgeRequest(
        request,
        reply,
        dependencies.bridgeDeviceStore,
      );
      if (device === null) return;

      return {
        requestId: request.id,
        serverTime: new Date().toISOString(),
        status: "ok",
      };
    },
  });

  app.get(ApiRoutes.bridgeDevices.url, {
    schema: ApiRoutes.bridgeDevices.schema,
    async handler(request, reply) {
      if (dependencies.bridgeDeviceStore === undefined)
        throw new Error("Bridge device store is not configured");
      const owner = await currentWebDeviceOwner(request, reply, dependencies);
      if (owner === null) return;

      return {
        devices: await dependencies.bridgeDeviceStore.listForUser(
          owner.serverId,
          owner.userId,
        ),
        requestId: request.id,
      };
    },
  });

  app.delete(ApiRoutes.revokeBridgeDevice.url, {
    schema: ApiRoutes.revokeBridgeDevice.schema,
    async handler(request, reply) {
      if (!validateStateChange(request, reply, dependencies.config)) return;
      if (dependencies.bridgeDeviceStore === undefined)
        throw new Error("Bridge device store is not configured");
      const owner = await currentWebDeviceOwner(request, reply, dependencies);
      if (owner === null) return;

      const deviceId = (request.params as { deviceId: string }).deviceId;
      const revoked = await dependencies.bridgeDeviceStore.revokeForUser(
        owner.serverId,
        owner.userId,
        deviceId,
      );
      if (!revoked) {
        return reply
          .status(404)
          .send(
            errorEnvelope(
              "BRIDGE_DEVICE_NOT_FOUND",
              "The Bridge device was not found",
              request.id,
            ),
          );
      }

      return { deviceId, requestId: request.id, success: true as const };
    },
  });

  app.delete(ApiRoutes.revokeOwnBridgeCredential.url, {
    config: {
      rateLimit: {
        max: 20,
        timeWindow: 60 * 1000,
      },
    },
    schema: ApiRoutes.revokeOwnBridgeCredential.schema,
    async handler(request, reply) {
      if (dependencies.bridgeDeviceStore === undefined)
        throw new Error("Bridge device store is not configured");
      const device = await authenticateBridgeRequest(
        request,
        reply,
        dependencies.bridgeDeviceStore,
      );
      if (device === null) return;

      const revoked = await dependencies.bridgeDeviceStore.revokeAuthenticated(
        device.deviceId,
      );
      if (!revoked) {
        return reply
          .status(401)
          .send(
            errorEnvelope(
              "BRIDGE_CREDENTIAL_INVALID",
              "The Bridge device credential is missing or invalid",
              request.id,
            ),
          );
      }

      return {
        deviceId: device.deviceId,
        requestId: request.id,
        success: true as const,
      };
    },
  });
}
