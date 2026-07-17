import { ErrorEnvelopeSchema } from "./common.js";
import {
  LoginRequestSchema,
  LoginResponseSchema,
  LogoutResponseSchema,
  PublicUserAvatarParamsSchema,
  PublicUsersResponseSchema,
  SessionResponseSchema,
} from "./auth.js";
import { HealthResponseSchema } from "./health.js";
import { CsrfResponseSchema } from "./security.js";
import {
  BridgePairingCodeResponseSchema,
  BridgeDeviceAuthHeadersSchema,
  BridgeDeviceParamsSchema,
  BridgeHeartbeatResponseSchema,
  BridgeDevicesResponseSchema,
  RevokeBridgeDeviceResponseSchema,
  RedeemBridgePairingCodeRequestSchema,
  RedeemBridgePairingCodeResponseSchema,
} from "./bridge.js";
import {
  EpisodesResponseSchema,
  FavoriteRequestSchema,
  MediaHomeResponseSchema,
  MediaImageParamsSchema,
  MediaImageQuerySchema,
  MediaItemParamsSchema,
  MediaItemResponseSchema,
  MediaItemsQuerySchema,
  MediaLibrariesResponseSchema,
  MediaSearchQuerySchema,
  MediaSearchResponseSchema,
  MediaUserStateResponseSchema,
  PlayedRequestSchema,
  SeriesEpisodesQuerySchema,
  SeriesParamsSchema,
  SeasonsResponseSchema,
  PagedMediaResponseSchema,
} from "./media-api.js";
import {
  CurrentServerResponseSchema,
  ProbeServerRequestSchema,
  ProbeServerResponseSchema,
} from "./server.js";

export const API_PREFIX = "/api/v1";

export const ApiRoutes = {
  csrf: {
    method: "GET",
    url: `${API_PREFIX}/security/csrf`,
    schema: {
      response: {
        200: CsrfResponseSchema,
      },
    },
  },
  health: {
    method: "GET",
    url: `${API_PREFIX}/health`,
    schema: {
      response: {
        200: HealthResponseSchema,
      },
    },
  },
  createBridgePairingCode: {
    method: "POST",
    url: `${API_PREFIX}/bridge/pairing-codes`,
    schema: {
      response: {
        201: BridgePairingCodeResponseSchema,
        401: ErrorEnvelopeSchema,
        403: ErrorEnvelopeSchema,
        409: ErrorEnvelopeSchema,
      },
    },
  },
  redeemBridgePairingCode: {
    method: "POST",
    url: `${API_PREFIX}/bridge/pairings/redeem`,
    schema: {
      body: RedeemBridgePairingCodeRequestSchema,
      response: {
        200: RedeemBridgePairingCodeResponseSchema,
        400: ErrorEnvelopeSchema,
        401: ErrorEnvelopeSchema,
        429: ErrorEnvelopeSchema,
      },
    },
  },
  bridgeHeartbeat: {
    method: "POST",
    url: `${API_PREFIX}/bridge/devices/:deviceId/heartbeat`,
    schema: {
      headers: BridgeDeviceAuthHeadersSchema,
      params: BridgeDeviceParamsSchema,
      response: {
        200: BridgeHeartbeatResponseSchema,
        400: ErrorEnvelopeSchema,
        401: ErrorEnvelopeSchema,
        409: ErrorEnvelopeSchema,
        429: ErrorEnvelopeSchema,
      },
    },
  },
  bridgeDevices: {
    method: "GET",
    url: `${API_PREFIX}/bridge/devices`,
    schema: {
      response: {
        200: BridgeDevicesResponseSchema,
        401: ErrorEnvelopeSchema,
        409: ErrorEnvelopeSchema,
      },
    },
  },
  revokeBridgeDevice: {
    method: "DELETE",
    url: `${API_PREFIX}/bridge/devices/:deviceId`,
    schema: {
      params: BridgeDeviceParamsSchema,
      response: {
        200: RevokeBridgeDeviceResponseSchema,
        401: ErrorEnvelopeSchema,
        403: ErrorEnvelopeSchema,
        404: ErrorEnvelopeSchema,
        409: ErrorEnvelopeSchema,
      },
    },
  },
  revokeOwnBridgeCredential: {
    method: "DELETE",
    url: `${API_PREFIX}/bridge/devices/:deviceId/credential`,
    schema: {
      headers: BridgeDeviceAuthHeadersSchema,
      params: BridgeDeviceParamsSchema,
      response: {
        200: RevokeBridgeDeviceResponseSchema,
        400: ErrorEnvelopeSchema,
        401: ErrorEnvelopeSchema,
        409: ErrorEnvelopeSchema,
        429: ErrorEnvelopeSchema,
      },
    },
  },
  mediaLibraries: {
    method: "GET",
    url: `${API_PREFIX}/media/libraries`,
    schema: {
      response: {
        200: MediaLibrariesResponseSchema,
        401: ErrorEnvelopeSchema,
        403: ErrorEnvelopeSchema,
        408: ErrorEnvelopeSchema,
        409: ErrorEnvelopeSchema,
        502: ErrorEnvelopeSchema,
      },
    },
  },
  mediaHome: {
    method: "GET",
    url: `${API_PREFIX}/media/home`,
    schema: {
      response: {
        200: MediaHomeResponseSchema,
        401: ErrorEnvelopeSchema,
        403: ErrorEnvelopeSchema,
        408: ErrorEnvelopeSchema,
        409: ErrorEnvelopeSchema,
        502: ErrorEnvelopeSchema,
      },
    },
  },
  mediaItems: {
    method: "GET",
    url: `${API_PREFIX}/media/items`,
    schema: {
      querystring: MediaItemsQuerySchema,
      response: {
        200: PagedMediaResponseSchema,
        400: ErrorEnvelopeSchema,
        401: ErrorEnvelopeSchema,
        403: ErrorEnvelopeSchema,
        408: ErrorEnvelopeSchema,
        409: ErrorEnvelopeSchema,
        502: ErrorEnvelopeSchema,
      },
    },
  },
  mediaSearch: {
    method: "GET",
    url: `${API_PREFIX}/media/search`,
    schema: {
      querystring: MediaSearchQuerySchema,
      response: {
        200: MediaSearchResponseSchema,
        400: ErrorEnvelopeSchema,
        401: ErrorEnvelopeSchema,
        403: ErrorEnvelopeSchema,
        408: ErrorEnvelopeSchema,
        409: ErrorEnvelopeSchema,
        502: ErrorEnvelopeSchema,
      },
    },
  },
  mediaItem: {
    method: "GET",
    url: `${API_PREFIX}/media/items/:itemId`,
    schema: {
      params: MediaItemParamsSchema,
      response: {
        200: MediaItemResponseSchema,
        401: ErrorEnvelopeSchema,
        403: ErrorEnvelopeSchema,
        404: ErrorEnvelopeSchema,
        408: ErrorEnvelopeSchema,
        409: ErrorEnvelopeSchema,
        502: ErrorEnvelopeSchema,
      },
    },
  },
  mediaImage: {
    method: "GET",
    url: `${API_PREFIX}/media/items/:itemId/images/:imageType`,
    schema: {
      params: MediaImageParamsSchema,
      querystring: MediaImageQuerySchema,
    },
  },
  mediaFavorite: {
    method: "PUT",
    url: `${API_PREFIX}/media/items/:itemId/favorite`,
    schema: {
      body: FavoriteRequestSchema,
      params: MediaItemParamsSchema,
      response: {
        200: MediaUserStateResponseSchema,
        400: ErrorEnvelopeSchema,
        401: ErrorEnvelopeSchema,
        403: ErrorEnvelopeSchema,
        404: ErrorEnvelopeSchema,
        408: ErrorEnvelopeSchema,
        502: ErrorEnvelopeSchema,
      },
    },
  },
  mediaPlayed: {
    method: "PUT",
    url: `${API_PREFIX}/media/items/:itemId/played`,
    schema: {
      body: PlayedRequestSchema,
      params: MediaItemParamsSchema,
      response: {
        200: MediaUserStateResponseSchema,
        400: ErrorEnvelopeSchema,
        401: ErrorEnvelopeSchema,
        403: ErrorEnvelopeSchema,
        404: ErrorEnvelopeSchema,
        408: ErrorEnvelopeSchema,
        502: ErrorEnvelopeSchema,
      },
    },
  },
  seriesSeasons: {
    method: "GET",
    url: `${API_PREFIX}/media/series/:seriesId/seasons`,
    schema: {
      params: SeriesParamsSchema,
      response: {
        200: SeasonsResponseSchema,
        401: ErrorEnvelopeSchema,
        403: ErrorEnvelopeSchema,
        404: ErrorEnvelopeSchema,
        502: ErrorEnvelopeSchema,
      },
    },
  },
  seriesEpisodes: {
    method: "GET",
    url: `${API_PREFIX}/media/series/:seriesId/episodes`,
    schema: {
      params: SeriesParamsSchema,
      querystring: SeriesEpisodesQuerySchema,
      response: {
        200: EpisodesResponseSchema,
        401: ErrorEnvelopeSchema,
        403: ErrorEnvelopeSchema,
        404: ErrorEnvelopeSchema,
        502: ErrorEnvelopeSchema,
      },
    },
  },
  login: {
    method: "POST",
    url: `${API_PREFIX}/auth/login`,
    schema: {
      body: LoginRequestSchema,
      response: {
        200: LoginResponseSchema,
        400: ErrorEnvelopeSchema,
        401: ErrorEnvelopeSchema,
        403: ErrorEnvelopeSchema,
        408: ErrorEnvelopeSchema,
        409: ErrorEnvelopeSchema,
        429: ErrorEnvelopeSchema,
        502: ErrorEnvelopeSchema,
      },
    },
  },
  currentUser: {
    method: "GET",
    url: `${API_PREFIX}/auth/me`,
    schema: {
      response: {
        200: SessionResponseSchema,
        401: ErrorEnvelopeSchema,
        409: ErrorEnvelopeSchema,
        408: ErrorEnvelopeSchema,
        502: ErrorEnvelopeSchema,
      },
    },
  },
  logout: {
    method: "POST",
    url: `${API_PREFIX}/auth/logout`,
    schema: {
      response: {
        200: LogoutResponseSchema,
        403: ErrorEnvelopeSchema,
      },
    },
  },
  publicUsers: {
    method: "GET",
    url: `${API_PREFIX}/auth/public-users`,
    schema: {
      response: {
        200: PublicUsersResponseSchema,
        404: ErrorEnvelopeSchema,
        409: ErrorEnvelopeSchema,
        408: ErrorEnvelopeSchema,
        502: ErrorEnvelopeSchema,
      },
    },
  },
  publicUserAvatar: {
    method: "GET",
    url: `${API_PREFIX}/auth/public-users/:userId/avatar`,
    schema: {
      params: PublicUserAvatarParamsSchema,
    },
  },
  currentServer: {
    method: "GET",
    url: `${API_PREFIX}/servers/current`,
    schema: {
      response: {
        200: CurrentServerResponseSchema,
      },
    },
  },
  probeServer: {
    method: "POST",
    url: `${API_PREFIX}/servers/probe`,
    schema: {
      body: ProbeServerRequestSchema,
      response: {
        200: ProbeServerResponseSchema,
        400: ErrorEnvelopeSchema,
        403: ErrorEnvelopeSchema,
        408: ErrorEnvelopeSchema,
        426: ErrorEnvelopeSchema,
        502: ErrorEnvelopeSchema,
      },
    },
  },
  selectServer: {
    method: "POST",
    url: `${API_PREFIX}/servers/select`,
    schema: {
      body: ProbeServerRequestSchema,
      response: {
        200: ProbeServerResponseSchema,
        400: ErrorEnvelopeSchema,
        403: ErrorEnvelopeSchema,
        408: ErrorEnvelopeSchema,
        426: ErrorEnvelopeSchema,
        502: ErrorEnvelopeSchema,
      },
    },
  },
} as const;

export const OpenApiInfo = {
  openapi: "3.1.0",
  info: {
    title: "NewEmby Gateway API",
    version: "0.0.0",
    description: "Shared API contract for NewEmby Web and Player Bridge.",
  },
} as const;
