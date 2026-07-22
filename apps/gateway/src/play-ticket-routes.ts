import {
  ApiRoutes,
  PLAY_TICKET_LIFETIME_SECONDS,
  type CreatePlayTicketRequest,
  type RedeemPlayTicketRequest,
} from "@newemby/contracts";
import type { FastifyInstance } from "fastify";

import {
  authenticateBridgeRequest,
  currentWebBridgeOwner,
} from "./bridge-route-auth.js";
import type { GatewayConfig } from "./config.js";
import { validateStateChange } from "./csrf.js";
import type { AuthSessionStore } from "./database/auth-session-store.js";
import type { BridgeDeviceStore } from "./database/bridge-device-store.js";
import type { PlayTicketStore } from "./database/play-ticket-store.js";
import type { ServerStore } from "./database/server-store.js";
import { errorEnvelope } from "./errors.js";

export interface PlayTicketRouteDependencies {
  authSessionStore?: AuthSessionStore;
  bridgeDeviceStore?: BridgeDeviceStore;
  config: GatewayConfig;
  playTicketStore?: PlayTicketStore;
  serverStore: ServerStore;
}

export function registerPlayTicketRoutes(
  app: FastifyInstance,
  dependencies: PlayTicketRouteDependencies,
): void {
  app.post(ApiRoutes.createPlayTicket.url, {
    config: {
      rateLimit: {
        max: 30,
        timeWindow: 60 * 1000,
      },
    },
    schema: ApiRoutes.createPlayTicket.schema,
    async handler(request, reply) {
      if (!validateStateChange(request, reply, dependencies.config)) return;
      if (dependencies.playTicketStore === undefined)
        throw new Error("PlayTicket store is not configured");

      const owner = await currentWebBridgeOwner(request, reply, dependencies);
      if (owner === null) return;

      const body = request.body as CreatePlayTicketRequest;
      const issued = await dependencies.playTicketStore.issue({
        authSessionId: owner.sessionId,
        bridgeDeviceId: body.deviceId,
        selection: {
          audioStreamIndex: body.audioStreamIndex,
          itemId: body.itemId,
          mediaSourceId: body.mediaSourceId,
          resumeTicks: body.resumeTicks,
          subtitleStreamIndex: body.subtitleStreamIndex,
        },
        serverId: owner.serverId,
        userId: owner.userId,
      });
      if (issued === null) {
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

      return reply.status(201).send({
        ...issued,
        expiresInSeconds: PLAY_TICKET_LIFETIME_SECONDS,
        requestId: request.id,
      });
    },
  });

  app.post(ApiRoutes.redeemPlayTicket.url, {
    config: {
      rateLimit: {
        max: 30,
        timeWindow: 60 * 1000,
      },
    },
    schema: ApiRoutes.redeemPlayTicket.schema,
    async handler(request, reply) {
      if (
        dependencies.bridgeDeviceStore === undefined ||
        dependencies.playTicketStore === undefined
      ) {
        throw new Error("Bridge PlayTicket stores are not configured");
      }

      const device = await authenticateBridgeRequest(
        request,
        reply,
        dependencies.bridgeDeviceStore,
      );
      if (device === null) return;

      const redeemed = await dependencies.playTicketStore.redeem(
        (request.body as RedeemPlayTicketRequest).playTicket,
        device.deviceId,
      );
      if (redeemed === null) {
        return reply
          .status(401)
          .send(
            errorEnvelope(
              "PLAY_TICKET_INVALID",
              "The PlayTicket is invalid, expired, or already used",
              request.id,
            ),
          );
      }

      return { ...redeemed, requestId: request.id };
    },
  });
}
