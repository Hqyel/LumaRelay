import { ApiRoutes, type BridgeHeartbeatResponse } from "@newemby/contracts";
import type { FastifyInstance } from "fastify";

import {
  authenticateBridgeRequest,
  currentWebBridgeOwner,
} from "./bridge-route-auth.js";
import type { GatewayConfig } from "./config.js";
import { validateStateChange } from "./csrf.js";
import type { AuthSessionStore } from "./database/auth-session-store.js";
import type { BridgeDeviceStore } from "./database/bridge-device-store.js";
import type { ServerStore } from "./database/server-store.js";
import { errorEnvelope } from "./errors.js";

export interface DeviceRouteDependencies {
  authSessionStore?: AuthSessionStore;
  bridgeDeviceStore?: BridgeDeviceStore;
  config: GatewayConfig;
  serverStore: ServerStore;
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
      const owner = await currentWebBridgeOwner(request, reply, dependencies);
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
      const owner = await currentWebBridgeOwner(request, reply, dependencies);
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
