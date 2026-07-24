import { createHash } from "node:crypto";

import { ApiRoutes, type PlaybackEventRequest } from "@lumarelay/contracts";
import {
  EmbyMediaError,
  reportPlaybackProgress,
  reportPlaybackStarted,
  reportPlaybackStopped,
  type PlaybackProgressEvent,
  type PlaybackSessionInput,
} from "@lumarelay/emby-client";
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

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (typeof value !== "object" || value === null) return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, canonicalValue(child)]),
  );
}

function eventFingerprint(value: PlaybackEventRequest): string {
  return createHash("sha256")
    .update(JSON.stringify(canonicalValue(value)))
    .digest("hex");
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
        dependencies.playTicketStore.claimPlaybackEvent === undefined ||
        dependencies.playTicketStore.completePlaybackEvent === undefined ||
        dependencies.playTicketStore.findPlaybackSession === undefined ||
        dependencies.playTicketStore.releasePlaybackEvent === undefined ||
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
      if (playback.embyPlaySessionId === null) {
        return reply
          .status(502)
          .send(
            errorEnvelope(
              "EMBY_PLAYBACK_FAILED",
              "The Emby playback session is not ready",
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

      const fingerprint = eventFingerprint(body);
      const claim = await dependencies.playTicketStore.claimPlaybackEvent({
        bridgeDeviceId: device.deviceId,
        eventType: body.eventType,
        fingerprint,
        playSessionId: playback.playSessionId,
        sequence: body.sequence,
      });
      if (claim === "duplicate") {
        return {
          duplicate: true,
          requestId: request.id,
          success: true as const,
        };
      }
      if (claim !== "claimed") {
        const response = {
          conflict: {
            code: "PLAYBACK_EVENT_CONFLICT" as const,
            message: "The sequence is already bound to a different event",
          },
          "out-of-order": {
            code: "PLAYBACK_EVENT_OUT_OF_ORDER" as const,
            message: "The playback event sequence is out of order",
          },
          pending: {
            code: "PLAYBACK_EVENT_PENDING" as const,
            message: "The playback event is already being processed",
          },
        }[claim];
        return reply
          .status(409)
          .send(errorEnvelope(response.code, response.message, request.id));
      }

      const releaseClaim = async (): Promise<void> => {
        await dependencies.playTicketStore!.releasePlaybackEvent!(
          playback.playSessionId,
          body.sequence,
          fingerprint,
        );
      };

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
        await releaseClaim();
        return reply
          .status(401)
          .send(
            errorEnvelope(
              "UNAUTHENTICATED",
              "The LumaRelay playback session has expired",
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
        playSessionId: playback.embyPlaySessionId,
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
        await releaseClaim();
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
      await dependencies.playTicketStore.completePlaybackEvent({
        audioStreamIndex:
          body.eventType === "progress" ? body.audioStreamIndex : undefined,
        completedAt: eventAt,
        eventType: body.eventType,
        fingerprint,
        playSessionId: playback.playSessionId,
        positionTicks: body.positionTicks,
        sequence: body.sequence,
        subtitleStreamIndex:
          body.eventType === "progress" ? body.subtitleStreamIndex : undefined,
      });
      return { requestId: request.id, success: true as const };
    },
  });
}
