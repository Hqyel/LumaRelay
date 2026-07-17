import {
  ApiRoutes,
  type EpisodesResponse,
  type MediaHomeResponse,
  type MediaItemResponse,
  type MediaItemsQuery,
  type MediaLibrary,
  type MediaSearchResponse,
  type MediaUserState,
  type PagedMediaResponse,
  type SeasonsResponse,
} from "@newemby/contracts";
import {
  EmbyMediaError,
  getMediaHome,
  getMediaItem,
  getMediaItems,
  getMediaLibraries,
  getSeriesEpisodes,
  getSeriesSeasons,
  loadAuthenticatedImage,
  searchMedia,
  setFavoriteState,
  type AuthenticatedImage,
  type AuthenticatedImageRequest,
  type AuthenticatedMediaRequest,
} from "@newemby/emby-client";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import type { GatewayConfig } from "./config.js";
import type { AuthSessionStore } from "./database/auth-session-store.js";
import type { ServerStore } from "./database/server-store.js";
import { errorEnvelope } from "./errors.js";
import { validateStateChange } from "./csrf.js";

interface MediaContext {
  baseUrl: string;
  input: AuthenticatedMediaRequest;
}

export interface MediaRouteDependencies {
  authSessionStore?: AuthSessionStore;
  config: GatewayConfig;
  getHome?: (
    baseUrl: string,
    input: AuthenticatedMediaRequest,
  ) => Promise<Omit<MediaHomeResponse, "requestId">>;
  getItem?: (
    baseUrl: string,
    input: AuthenticatedMediaRequest,
    itemId: string,
  ) => Promise<Omit<MediaItemResponse, "requestId">>;
  getLibraries?: (
    baseUrl: string,
    input: AuthenticatedMediaRequest,
  ) => Promise<MediaLibrary[]>;
  getEpisodes?: (
    baseUrl: string,
    input: AuthenticatedMediaRequest,
    seriesId: string,
    seasonId: string,
  ) => Promise<Omit<EpisodesResponse, "requestId">>;
  getItems?: (
    baseUrl: string,
    input: AuthenticatedMediaRequest,
    query: MediaItemsQuery,
  ) => Promise<Omit<PagedMediaResponse, "requestId">>;
  getSeasons?: (
    baseUrl: string,
    input: AuthenticatedMediaRequest,
    seriesId: string,
  ) => Promise<Omit<SeasonsResponse, "requestId">>;
  search?: (
    baseUrl: string,
    input: AuthenticatedMediaRequest,
    query: { limit: number; q: string },
  ) => Promise<Omit<MediaSearchResponse, "requestId">>;
  loadImage?: (
    baseUrl: string,
    input: AuthenticatedMediaRequest,
    request: AuthenticatedImageRequest,
  ) => Promise<AuthenticatedImage>;
  setFavorite?: (
    baseUrl: string,
    input: AuthenticatedMediaRequest,
    itemId: string,
    favorite: boolean,
  ) => Promise<MediaUserState>;
  serverStore: ServerStore;
}

async function mediaContext(
  request: FastifyRequest,
  reply: FastifyReply,
  dependencies: MediaRouteDependencies,
): Promise<MediaContext | null> {
  const server = await dependencies.serverStore.getCurrent();
  if (server === null) {
    await reply
      .status(409)
      .send(
        errorEnvelope(
          "SERVER_NOT_SELECTED",
          "Select an Emby server before loading media",
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
    baseUrl: server.baseUrl,
    input: {
      accessToken: session.accessToken,
      deviceId: await dependencies.authSessionStore.getDeviceId(),
      serverId: server.serverId,
      userId: session.user.userId,
    },
  };
}

async function mediaFailure(
  error: unknown,
  request: FastifyRequest,
  reply: FastifyReply,
  dependencies: MediaRouteDependencies,
): Promise<void> {
  const mediaError =
    error instanceof EmbyMediaError
      ? error
      : new EmbyMediaError("unreachable", "The Emby media request failed", {
          cause: error,
        });

  if (mediaError.kind === "unauthorized") {
    const cookieToken = request.cookies.newemby_session;
    if (
      cookieToken !== undefined &&
      dependencies.authSessionStore !== undefined
    )
      await dependencies.authSessionStore.revoke(cookieToken);
    void reply.clearCookie("newemby_session", { path: "/" });
    await reply
      .status(401)
      .send(
        errorEnvelope(
          "UNAUTHENTICATED",
          "The Emby session has expired",
          request.id,
        ),
      );
    return;
  }

  const response =
    mediaError.kind === "forbidden"
      ? ({ code: "ACCESS_DENIED", status: 403 } as const)
      : mediaError.kind === "not-found"
        ? ({ code: "MEDIA_NOT_FOUND", status: 404 } as const)
        : mediaError.kind === "timeout"
          ? ({ code: "SERVER_TIMEOUT", status: 408 } as const)
          : mediaError.kind === "write-failed"
            ? ({ code: "EMBY_WRITE_FAILED", status: 502 } as const)
            : ({ code: "SERVER_UNREACHABLE", status: 502 } as const);
  await reply
    .status(response.status)
    .send(errorEnvelope(response.code, mediaError.message, request.id));
}

export function registerMediaRoutes(
  app: FastifyInstance,
  dependencies: MediaRouteDependencies,
): void {
  app.get(ApiRoutes.mediaLibraries.url, {
    schema: ApiRoutes.mediaLibraries.schema,
    async handler(request, reply) {
      const context = await mediaContext(request, reply, dependencies);
      if (context === null) return;

      try {
        return {
          libraries: await (dependencies.getLibraries ?? getMediaLibraries)(
            context.baseUrl,
            context.input,
          ),
          requestId: request.id,
        };
      } catch (error) {
        await mediaFailure(error, request, reply, dependencies);
      }
    },
  });

  app.get(ApiRoutes.mediaHome.url, {
    schema: ApiRoutes.mediaHome.schema,
    async handler(request, reply) {
      const context = await mediaContext(request, reply, dependencies);
      if (context === null) return;

      try {
        return {
          ...(await (dependencies.getHome ?? getMediaHome)(
            context.baseUrl,
            context.input,
          )),
          requestId: request.id,
        };
      } catch (error) {
        await mediaFailure(error, request, reply, dependencies);
      }
    },
  });

  app.get(ApiRoutes.mediaItems.url, {
    schema: ApiRoutes.mediaItems.schema,
    async handler(request, reply) {
      const context = await mediaContext(request, reply, dependencies);
      if (context === null) return;
      const query = request.query as MediaItemsQuery;

      try {
        if (query.libraryId !== undefined) {
          const libraries = await (
            dependencies.getLibraries ?? getMediaLibraries
          )(context.baseUrl, context.input);
          if (
            !libraries.some((library) => library.libraryId === query.libraryId)
          )
            return reply
              .status(403)
              .send(
                errorEnvelope(
                  "ACCESS_DENIED",
                  "This media library is not available",
                  request.id,
                ),
              );
        }

        return {
          ...(await (dependencies.getItems ?? getMediaItems)(
            context.baseUrl,
            context.input,
            query,
          )),
          requestId: request.id,
        };
      } catch (error) {
        await mediaFailure(error, request, reply, dependencies);
      }
    },
  });

  app.get(ApiRoutes.mediaSearch.url, {
    schema: ApiRoutes.mediaSearch.schema,
    async handler(request, reply) {
      const context = await mediaContext(request, reply, dependencies);
      if (context === null) return;

      try {
        return {
          ...(await (dependencies.search ?? searchMedia)(
            context.baseUrl,
            context.input,
            request.query as { limit: number; q: string },
          )),
          requestId: request.id,
        };
      } catch (error) {
        await mediaFailure(error, request, reply, dependencies);
      }
    },
  });

  app.get(ApiRoutes.mediaItem.url, {
    schema: ApiRoutes.mediaItem.schema,
    async handler(request, reply) {
      const context = await mediaContext(request, reply, dependencies);
      if (context === null) return;

      try {
        return {
          ...(await (dependencies.getItem ?? getMediaItem)(
            context.baseUrl,
            context.input,
            (request.params as { itemId: string }).itemId,
          )),
          requestId: request.id,
        };
      } catch (error) {
        await mediaFailure(error, request, reply, dependencies);
      }
    },
  });

  app.put(ApiRoutes.mediaFavorite.url, {
    schema: ApiRoutes.mediaFavorite.schema,
    async handler(request, reply) {
      if (!validateStateChange(request, reply, dependencies.config)) return;
      const context = await mediaContext(request, reply, dependencies);
      if (context === null) return;

      try {
        return {
          requestId: request.id,
          state: await (dependencies.setFavorite ?? setFavoriteState)(
            context.baseUrl,
            context.input,
            (request.params as { itemId: string }).itemId,
            (request.body as { favorite: boolean }).favorite,
          ),
        };
      } catch (error) {
        await mediaFailure(error, request, reply, dependencies);
      }
    },
  });

  app.get(ApiRoutes.seriesSeasons.url, {
    schema: ApiRoutes.seriesSeasons.schema,
    async handler(request, reply) {
      const context = await mediaContext(request, reply, dependencies);
      if (context === null) return;

      try {
        return {
          ...(await (dependencies.getSeasons ?? getSeriesSeasons)(
            context.baseUrl,
            context.input,
            (request.params as { seriesId: string }).seriesId,
          )),
          requestId: request.id,
        };
      } catch (error) {
        await mediaFailure(error, request, reply, dependencies);
      }
    },
  });

  app.get(ApiRoutes.seriesEpisodes.url, {
    schema: ApiRoutes.seriesEpisodes.schema,
    async handler(request, reply) {
      const context = await mediaContext(request, reply, dependencies);
      if (context === null) return;

      try {
        return {
          ...(await (dependencies.getEpisodes ?? getSeriesEpisodes)(
            context.baseUrl,
            context.input,
            (request.params as { seriesId: string }).seriesId,
            (request.query as { seasonId: string }).seasonId,
          )),
          requestId: request.id,
        };
      } catch (error) {
        await mediaFailure(error, request, reply, dependencies);
      }
    },
  });

  app.get(ApiRoutes.mediaImage.url, {
    schema: ApiRoutes.mediaImage.schema,
    async handler(request, reply) {
      const context = await mediaContext(request, reply, dependencies);
      if (context === null) return;
      const params = request.params as {
        imageType: AuthenticatedImageRequest["imageType"];
        itemId: string;
      };
      const query = request.query as {
        dpr: 1 | 2;
        index?: number;
        preset: AuthenticatedImageRequest["preset"];
        tag: string;
      };

      try {
        const image = await (dependencies.loadImage ?? loadAuthenticatedImage)(
          context.baseUrl,
          context.input,
          {
            ...params,
            ...query,
            imageTag: query.tag,
          },
        );
        void reply.type(image.contentType);
        void reply.header(
          "cache-control",
          "private, max-age=31536000, immutable",
        );
        if (image.etag !== undefined) void reply.header("etag", image.etag);
        return reply.send(Buffer.from(image.body));
      } catch (error) {
        await mediaFailure(error, request, reply, dependencies);
      }
    },
  });
}
