import {
  ApiRoutes,
  BRIDGE_PAIRING_CODE_LIFETIME_SECONDS,
  type RedeemBridgePairingCodeRequest,
} from "@newemby/contracts";
import type { FastifyInstance } from "fastify";

import type { GatewayConfig } from "./config.js";
import { validateStateChange } from "./csrf.js";
import type { AuthSessionStore } from "./database/auth-session-store.js";
import type { PairingCodeStore } from "./database/pairing-code-store.js";
import type { ServerStore } from "./database/server-store.js";
import { errorEnvelope } from "./errors.js";

export interface PairingRouteDependencies {
  authSessionStore?: AuthSessionStore;
  config: GatewayConfig;
  pairingCodeStore?: PairingCodeStore;
  serverStore: ServerStore;
}

export function registerPairingRoutes(
  app: FastifyInstance,
  dependencies: PairingRouteDependencies,
): void {
  app.post(ApiRoutes.createBridgePairingCode.url, {
    schema: ApiRoutes.createBridgePairingCode.schema,
    async handler(request, reply) {
      if (!validateStateChange(request, reply, dependencies.config)) return;

      const server = await dependencies.serverStore.getCurrent();
      if (server === null) {
        return reply
          .status(409)
          .send(
            errorEnvelope(
              "SERVER_NOT_SELECTED",
              "Select an Emby server before pairing a Bridge",
              request.id,
            ),
          );
      }

      const cookieToken = request.cookies.newemby_session;
      if (
        cookieToken === undefined ||
        dependencies.authSessionStore === undefined
      ) {
        return reply
          .status(401)
          .send(
            errorEnvelope("UNAUTHENTICATED", "Sign in to continue", request.id),
          );
      }

      const session = await dependencies.authSessionStore.find(cookieToken);
      if (session === null || session.user.serverId !== server.serverId) {
        if (session !== null)
          await dependencies.authSessionStore.revoke(cookieToken);
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

      if (dependencies.pairingCodeStore === undefined)
        throw new Error("Bridge pairing code store is not configured");

      const issued = await dependencies.pairingCodeStore.issue(
        session.sessionId,
      );
      return reply.status(201).send({
        ...issued,
        expiresInSeconds: BRIDGE_PAIRING_CODE_LIFETIME_SECONDS,
        requestId: request.id,
      });
    },
  });

  app.post(ApiRoutes.redeemBridgePairingCode.url, {
    config: {
      rateLimit: {
        max: 10,
        timeWindow: 60 * 1000,
      },
    },
    schema: ApiRoutes.redeemBridgePairingCode.schema,
    async handler(request, reply) {
      if (dependencies.pairingCodeStore === undefined)
        throw new Error("Bridge pairing code store is not configured");

      const redeemed = await dependencies.pairingCodeStore.redeem(
        request.body as RedeemBridgePairingCodeRequest,
      );
      if (redeemed === null) {
        return reply
          .status(401)
          .send(
            errorEnvelope(
              "PAIRING_CODE_INVALID",
              "The pairing code is invalid, expired, or already used",
              request.id,
            ),
          );
      }

      return {
        allowedOrigins: dependencies.config.allowedBridgeOrigins,
        ...redeemed,
        requestId: request.id,
      };
    },
  });
}
