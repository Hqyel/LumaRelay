import { ApiRoutes, type PlaybackEventRequest } from "@newemby/contracts";
import {
  EmbyMediaError,
  reportPlaybackProgress,
  reportPlaybackStarted,
  reportPlaybackStopped,
  type PlaybackProgressEvent,
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
  reportProgress?: (
    baseUrl: string,
    input: PlaybackSessionInput,
    eventName: PlaybackProgressEvent,
  ) => Promise<void>;
  reportStopped?: (
    baseUrl: string,
    input: PlaybackSessionInput,
  ) => Promise<void>;
  serverStore: ServerStore;
}

function toEmbyProgressEvent(
  eventName:
    | "audioTrackChange"
    | "pause"
    | "playbackRateChange"
    | "seek"
    | "subtitleTrackChange"
    | "timeUpdate"
    | "unpause",
): PlaybackProgressEvent {
  switch (eventName) {
    case "audioTrackChange":
      return "AudioTrackChange";
    case "pause":
      return "Pause";
    case "playbackRateChange":
      return "PlaybackRateChange";
    case "subtitleTrackChange":
      return "SubtitleTrackChange";
    case "unpause":
      return "Unpause";
    case "seek":
    case "timeUpdate":
      return "TimeUpdate";
  }
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
        dependencies.playTicketStore.markProgress === undefined ||
        dependencies.playTicketStore.markStarted === undefined ||
        dependencies.playTicketStore.markStopped === undefined ||
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

      const body = request.body as PlaybackEventRequest;
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
      if (body.eventType !== "playing" && playback.startedAt === null) {
        return reply
          .status(409)
          .send(
            errorEnvelope(
              "PLAYBACK_EVENT_OUT_OF_ORDER",
              "Playback events cannot be reported before playback starts",
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
      const upstreamInput: PlaybackSessionInput = {
        accessToken: authSession.accessToken,
        audioStreamIndex:
          body.eventType === "progress" && body.audioStreamIndex !== undefined
            ? body.audioStreamIndex
            : playback.selection.audioStreamIndex,
        deviceId,
        isPaused: body.eventType === "stopped" ? false : body.isPaused,
        itemId: playback.selection.itemId,
        mediaSourceId: playback.selection.mediaSourceId,
        playbackRate: body.playbackRate,
        playSessionId: playback.playSessionId,
        positionTicks: body.positionTicks,
        subtitleStreamIndex:
          body.eventType === "progress" &&
          body.subtitleStreamIndex !== undefined
            ? body.subtitleStreamIndex
            : playback.selection.subtitleStreamIndex,
      };
      try {
        if (body.eventType === "playing") {
          await (dependencies.reportStarted ?? reportPlaybackStarted)(
            server.baseUrl,
            upstreamInput,
          );
        } else if (body.eventType === "progress") {
          await (dependencies.reportProgress ?? reportPlaybackProgress)(
            server.baseUrl,
            upstreamInput,
            toEmbyProgressEvent(body.eventName),
          );
        } else {
          await (dependencies.reportStopped ?? reportPlaybackStopped)(
            server.baseUrl,
            upstreamInput,
          );
        }
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

      const eventAt = new Date().toISOString();
      if (body.eventType === "playing") {
        await dependencies.playTicketStore.markStarted(
          playback.playSessionId,
          eventAt,
        );
      } else if (body.eventType === "progress") {
        await dependencies.playTicketStore.markProgress(
          playback.playSessionId,
          body.positionTicks,
          eventAt,
          body.audioStreamIndex,
          body.subtitleStreamIndex,
        );
      } else {
        await dependencies.playTicketStore.markStopped(
          playback.playSessionId,
          body.positionTicks,
          eventAt,
        );
      }
      return { requestId: request.id, success: true as const };
    },
  });
}
