import { ApiRoutes, type PlaybackPlayingRequest } from "@newemby/contracts";
import {
  EmbyMediaError,
  reportPlaybackStarted,
  type PlaybackSessionInput,
} from "@newemby/emby-client";
import type { FastifyInstance } from "fastify";

import { authenticateBridgeRequest } from "./bridge-route-auth.js";
import type { AuthSessionStore } from "./database/auth-session-store.js";
import type { BridgeDeviceStore } from "./database/bridge-device-store.js";
import type { PlayTicketStore } from "./database/play-ticket-store.js";
import type { ServerStore } from "./database/server-store.js";
import { errorEnvelope } from "./errors.js";

export interface PlaybackRouteDependencies {
  authSessionStore?: AuthSessionStore;
  bridgeDeviceStore?: BridgeDeviceStore;
  playTicketStore?: PlayTicketStore;
  reportStarted?: (
    baseUrl: string,
    input: PlaybackSessionInput,
  ) => Promise<void>;
  serverStore: ServerStore;
}

export function registerPlaybackRoutes(
  app: FastifyInstance,
  dependencies: PlaybackRouteDependencies,
): void {
  app.post(ApiRoutes.reportPlaybackPlaying.url, {
    config: { rateLimit: { max: 120, timeWindow: 60 * 1000 } },
    schema: ApiRoutes.reportPlaybackPlaying.schema,
    async handler(request, reply) {
      if (
        dependencies.authSessionStore === undefined ||
        dependencies.bridgeDeviceStore === undefined ||
        dependencies.playTicketStore === undefined ||
        dependencies.playTicketStore.findPlaybackSession === undefined ||
        dependencies.playTicketStore.markStarted === undefined ||
        dependencies.authSessionStore.findById === undefined ||
        dependencies.serverStore.getById === undefined
      ) {
        throw new Error("Playback stores are not configured");
      }

      const device = await authenticateBridgeRequest(
        request,
        reply,
        dependencies.bridgeDeviceStore,
      );
      if (device === null) return;

      const body = request.body as PlaybackPlayingRequest;
      const playback = await dependencies.playTicketStore.findPlaybackSession(
        body.playSessionId,
        device.deviceId,
      );
      if (playback === null) {
        return reply
          .status(404)
          .send(
            errorEnvelope(
              "PLAYBACK_SESSION_NOT_FOUND",
              "The playback session was not found",
              request.id,
            ),
          );
      }

      const [authSession, server] = await Promise.all([
        dependencies.authSessionStore.findById(playback.authSessionId),
        dependencies.serverStore.getById(playback.serverId),
      ]);
      if (
        authSession === null ||
        server === null ||
        authSession.user.serverId !== playback.serverId ||
        authSession.user.userId !== playback.userId
      ) {
        return reply
          .status(401)
          .send(
            errorEnvelope(
              "UNAUTHENTICATED",
              "The NewEmby playback session has expired",
              request.id,
            ),
          );
      }

      const deviceId = await dependencies.authSessionStore.getDeviceId();
      try {
        await (dependencies.reportStarted ?? reportPlaybackStarted)(
          server.baseUrl,
          {
            accessToken: authSession.accessToken,
            audioStreamIndex: playback.selection.audioStreamIndex,
            deviceId,
            isPaused: body.isPaused,
            itemId: playback.selection.itemId,
            mediaSourceId: playback.selection.mediaSourceId,
            playbackRate: body.playbackRate,
            playSessionId: playback.playSessionId,
            positionTicks: body.positionTicks,
            subtitleStreamIndex: playback.selection.subtitleStreamIndex,
          },
        );
      } catch (error) {
        if (error instanceof EmbyMediaError && error.kind === "unauthorized") {
          await dependencies.authSessionStore.revokeById?.(
            playback.authSessionId,
          );
          return reply
            .status(401)
            .send(
              errorEnvelope(
                "UNAUTHENTICATED",
                "The Emby session has expired",
                request.id,
              ),
            );
        }

        return reply
          .status(502)
          .send(
            errorEnvelope(
              "EMBY_PLAYBACK_FAILED",
              "The Emby playback check-in failed",
              request.id,
            ),
          );
      }

      await dependencies.playTicketStore.markStarted(
        playback.playSessionId,
        new Date().toISOString(),
      );
      return { requestId: request.id, success: true as const };
    },
  });
}
