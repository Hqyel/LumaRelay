import { ApiRoutes, type BridgeHeartbeatResponse } from "@newemby/contracts";
import type { FastifyInstance } from "fastify";

import type { BridgeDeviceStore } from "./database/bridge-device-store.js";
import { errorEnvelope } from "./errors.js";

const DEVICE_AUTHORIZATION_PATTERN = /^NewEmbyDevice ([A-Za-z0-9_-]{43})$/;
const NONCE_PATTERN = /^[A-Za-z0-9_-]{22,128}$/;

export interface DeviceRouteDependencies {
  bridgeDeviceStore?: BridgeDeviceStore;
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

      const authorization = request.headers.authorization;
      const credential = authorization?.match(
        DEVICE_AUTHORIZATION_PATTERN,
      )?.[1];
      if (credential === undefined) {
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

      const nonceHeader = request.headers["x-newemby-nonce"];
      const nonce = Array.isArray(nonceHeader) ? nonceHeader[0] : nonceHeader;
      if (nonce === undefined || !NONCE_PATTERN.test(nonce)) {
        return reply
          .status(400)
          .send(
            errorEnvelope(
              "NONCE_INVALID",
              "The request nonce is missing or invalid",
              request.id,
            ),
          );
      }

      const result = await dependencies.bridgeDeviceStore.authenticate({
        deviceCredential: credential,
        deviceId: (request.params as { deviceId: string }).deviceId,
        nonce,
      });
      if (result.kind === "invalid-credential") {
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
      if (result.kind === "replay") {
        return reply
          .status(409)
          .send(
            errorEnvelope(
              "REPLAY_DETECTED",
              "The request nonce has already been used",
              request.id,
            ),
          );
      }

      return {
        requestId: request.id,
        serverTime: new Date().toISOString(),
        status: "ok",
      };
    },
  });
}
