import { Readable } from "node:stream";

import {
  ApiRoutes,
  PLAY_TICKET_LIFETIME_SECONDS,
  PlaybackResourceParamsSchema,
  type CreatePlayTicketRequest,
  type PlaybackMediaSource,
  type RedeemPlayTicketRequest,
} from "@newemby/contracts";
import {
  EmbyMediaError,
  getPlaybackOptions,
  loadPlaybackResource,
  type AuthenticatedMediaRequest,
} from "@newemby/emby-client";
import type { FastifyInstance, FastifyReply } from "fastify";

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
  getPlaybackOptions?: (
    baseUrl: string,
    input: AuthenticatedMediaRequest,
    itemId: string,
  ) => Promise<PlaybackMediaSource[]>;
  loadPlaybackResource?: typeof loadPlaybackResource;
  playTicketStore?: PlayTicketStore;
  serverStore: ServerStore;
}

function selectionIsAllowed(
  source: PlaybackMediaSource,
  body: CreatePlayTicketRequest,
): boolean {
  const audioAllowed =
    body.audioStreamIndex === null ||
    source.audioTracks.some((track) => track.index === body.audioStreamIndex);
  const subtitleAllowed =
    body.subtitleStreamIndex === null ||
    source.subtitleTracks.some(
      (track) => track.index === body.subtitleStreamIndex && track.isText,
    );
  return audioAllowed && subtitleAllowed;
}

async function playbackFailure(
  error: unknown,
  requestId: string,
  reply: FastifyReply,
): Promise<void> {
  const kind = error instanceof EmbyMediaError ? error.kind : "unreachable";
  const mapped =
    kind === "unauthorized"
      ? ({ code: "UNAUTHENTICATED", status: 401 } as const)
      : kind === "forbidden"
        ? ({ code: "ACCESS_DENIED", status: 403 } as const)
        : kind === "not-found"
          ? ({ code: "MEDIA_NOT_FOUND", status: 404 } as const)
          : kind === "timeout"
            ? ({ code: "SERVER_TIMEOUT", status: 408 } as const)
            : ({ code: "SERVER_UNREACHABLE", status: 502 } as const);
  await reply
    .status(mapped.status)
    .send(errorEnvelope(mapped.code, "Playback preparation failed", requestId));
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
      const authSession = await dependencies.authSessionStore?.findById?.(
        owner.sessionId,
      );
      const server = await dependencies.serverStore.getById?.(owner.serverId);
      if (authSession === null || authSession === undefined || server == null) {
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

      try {
        const mediaInput = {
          accessToken: authSession.accessToken,
          deviceId: await dependencies.authSessionStore!.getDeviceId(),
          serverId: owner.serverId,
          userId: owner.userId,
        };
        const sources = await (
          dependencies.getPlaybackOptions ?? getPlaybackOptions
        )(server.baseUrl, mediaInput, body.itemId);
        const selected = sources.find(
          (source) => source.mediaSourceId === body.mediaSourceId,
        );
        if (selected === undefined || !selectionIsAllowed(selected, body)) {
          return reply
            .status(400)
            .send(
              errorEnvelope(
                "PLAYBACK_SELECTION_INVALID",
                "The selected media source or track is not available",
                request.id,
              ),
            );
        }
      } catch (error) {
        await playbackFailure(error, request.id, reply);
        return;
      }

      const issued = await dependencies.playTicketStore.issue({
        authSessionId: owner.sessionId,
        bridgeDeviceId: body.deviceId,
        selection: {
          audioStreamIndex: body.audioStreamIndex,
          displayTitle: body.displayTitle,
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

  app.get(
    "/api/v1/bridge/devices/:deviceId/playback/:playSessionId/:resource",
    {
      schema: {
        headers: ApiRoutes.bridgeHeartbeat.schema.headers,
        params: PlaybackResourceParamsSchema,
      },
      async handler(request, reply) {
        if (
          dependencies.bridgeDeviceStore === undefined ||
          dependencies.playTicketStore?.bindEmbyPlaySessionId === undefined ||
          dependencies.playTicketStore?.findPlaybackSession === undefined ||
          dependencies.authSessionStore?.findById === undefined ||
          dependencies.serverStore.getById === undefined
        ) {
          throw new Error("Bridge playback streaming is not configured");
        }
        const device = await authenticateBridgeRequest(
          request,
          reply,
          dependencies.bridgeDeviceStore,
        );
        if (device === null) return;
        const params = PlaybackResourceParamsSchema.parse(request.params);
        const playback = await dependencies.playTicketStore.findPlaybackSession(
          params.playSessionId,
          device.deviceId,
        );
        if (playback === null || playback.stoppedAt !== null) {
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
        if (
          params.resource === "subtitle" &&
          playback.selection.subtitleStreamIndex === null
        ) {
          return reply
            .status(404)
            .send(
              errorEnvelope(
                "MEDIA_NOT_FOUND",
                "No external subtitle was selected",
                request.id,
              ),
            );
        }
        const [authSession, server] = await Promise.all([
          dependencies.authSessionStore.findById(playback.authSessionId),
          dependencies.serverStore.getById(playback.serverId),
        ]);
        if (authSession === null || server === null) {
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

        try {
          const rangeHeader = request.headers.range;
          const resource = await (
            dependencies.loadPlaybackResource ?? loadPlaybackResource
          )(
            server.baseUrl,
            {
              accessToken: authSession.accessToken,
              deviceId: await dependencies.authSessionStore.getDeviceId(),
              serverId: playback.serverId,
              userId: playback.userId,
            },
            playback.selection,
            {
              embyPlaySessionId: playback.embyPlaySessionId,
              localPlaySessionId: playback.playSessionId,
            },
            params.resource,
            Array.isArray(rangeHeader) ? rangeHeader[0] : rangeHeader,
          );
          if (
            params.resource === "media" &&
            (resource.embyPlaySessionId === null ||
              !(await dependencies.playTicketStore.bindEmbyPlaySessionId(
                playback.playSessionId,
                device.deviceId,
                resource.embyPlaySessionId,
              )))
          ) {
            await resource.response.body?.cancel();
            return reply
              .status(409)
              .send(
                errorEnvelope(
                  "PLAYBACK_EVENT_OUT_OF_ORDER",
                  "The Emby playback session could not be bound",
                  request.id,
                ),
              );
          }
          const upstream = resource.response;
          reply.status(upstream.status);
          for (const header of [
            "accept-ranges",
            "cache-control",
            "content-length",
            "content-range",
            "content-type",
          ]) {
            const value = upstream.headers.get(header);
            if (value !== null) void reply.header(header, value);
          }
          if (upstream.body === null) return reply.send();
          return reply.send(Readable.fromWeb(upstream.body));
        } catch (error) {
          await playbackFailure(error, request.id, reply);
        }
      },
    },
  );

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
