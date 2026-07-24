import { randomUUID } from "node:crypto";

/* global AbortSignal, console, fetch, process */

import {
  EmbyBaseItemDtoSchema,
  authenticateUser,
  embyApiUrl,
  logoutEmbySession,
  probeEmbyServer,
  setFavoriteState,
  setPlayedState,
} from "../packages/emby-client/dist/index.js";

const baseUrl = process.env.LUMARELAY_EMBY_SMOKE_BASE_URL;
const username = process.env.LUMARELAY_EMBY_SMOKE_USERNAME;
const password = process.env.LUMARELAY_EMBY_SMOKE_PASSWORD;
const confirmed = process.env.LUMARELAY_EMBY_WRITE_SMOKE_CONFIRM === "true";

if (!confirmed)
  throw new Error(
    "Set LUMARELAY_EMBY_WRITE_SMOKE_CONFIRM=true to allow a reversible write",
  );
if (!baseUrl || !username || !password)
  throw new Error(
    "The Emby smoke address and temporary credentials are required",
  );

function authorizationHeader(deviceId) {
  const safeDeviceId = deviceId.replace(/["\\]/g, "");
  return (
    'Emby Client="LumaRelay", Device="Gateway", ' +
    `DeviceId="${safeDeviceId}", Version="0.0.0"`
  );
}

async function findSafeCandidate(serverBaseUrl, userId, accessToken, deviceId) {
  const url = embyApiUrl(
    serverBaseUrl,
    `/Users/${encodeURIComponent(userId)}/Items`,
  );
  url.searchParams.set("EnableUserData", "true");
  url.searchParams.set("IncludeItemTypes", "Movie,Episode,Video");
  url.searchParams.set("Recursive", "true");
  url.searchParams.set("Limit", "100");

  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "x-emby-authorization": authorizationHeader(deviceId),
      "x-emby-token": accessToken,
    },
    redirect: "error",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok)
    throw new Error(`Safe candidate query failed (${response.status})`);

  const payload = await response.json();
  if (typeof payload !== "object" || payload === null || !("Items" in payload))
    throw new Error("Safe candidate response is invalid");
  if (!Array.isArray(payload.Items))
    throw new Error("Safe candidate response is invalid");

  return payload.Items.map((item) => EmbyBaseItemDtoSchema.safeParse(item))
    .filter((result) => result.success)
    .map((result) => result.data)
    .find(
      (item) =>
        item.UserData?.Played !== true &&
        (item.UserData?.PlaybackPositionTicks ?? 0) === 0,
    );
}

async function run() {
  let accessToken;
  let candidate;
  let cleanupError;
  let deviceId;
  let mediaInput;
  let operationError;
  let originalFavorite;
  let originalPlayed;
  let serverBaseUrl = baseUrl;

  try {
    const server = await probeEmbyServer(baseUrl, { timeoutMs: 10_000 });
    serverBaseUrl = server.baseUrl;
    deviceId = randomUUID();
    const authentication = await authenticateUser(
      server.baseUrl,
      { deviceId, password, username },
      { timeoutMs: 10_000 },
    );
    accessToken = authentication.accessToken;
    mediaInput = {
      accessToken,
      deviceId,
      serverId: server.serverId,
      userId: authentication.user.userId,
    };
    candidate = await findSafeCandidate(
      server.baseUrl,
      authentication.user.userId,
      accessToken,
      deviceId,
    );
    if (candidate === undefined)
      throw new Error(
        "No zero-progress unplayed item is available for safe write smoke",
      );

    originalFavorite = candidate.UserData?.IsFavorite === true;
    originalPlayed = candidate.UserData?.Played === true;
    const toggled = await setFavoriteState(
      server.baseUrl,
      mediaInput,
      candidate.Id,
      !originalFavorite,
      { timeoutMs: 10_000 },
    );
    if (toggled.isFavorite === originalFavorite)
      throw new Error(
        "Favorite write smoke did not persist the temporary state",
      );
    console.log("Emby write smoke: favorite=verified");

    const played = await setPlayedState(
      server.baseUrl,
      mediaInput,
      candidate.Id,
      !originalPlayed,
      { timeoutMs: 10_000 },
    );
    if (played.isPlayed === originalPlayed)
      throw new Error("Played write smoke did not persist the temporary state");
    console.log("Emby write smoke: played=verified");
  } catch (error) {
    operationError = error;
  } finally {
    if (
      candidate !== undefined &&
      mediaInput !== undefined &&
      originalFavorite !== undefined
    ) {
      try {
        const restored = await setFavoriteState(
          serverBaseUrl,
          mediaInput,
          candidate.Id,
          originalFavorite,
          { timeoutMs: 10_000 },
        );
        if (restored.isFavorite !== originalFavorite) {
          cleanupError = new Error(
            "Favorite state restoration could not be verified",
          );
        } else {
          console.log("Emby write smoke: favorite=restored");
        }
      } catch (error) {
        cleanupError = error;
      }
    }

    if (
      candidate !== undefined &&
      mediaInput !== undefined &&
      originalPlayed !== undefined
    ) {
      try {
        const restored = await setPlayedState(
          serverBaseUrl,
          mediaInput,
          candidate.Id,
          originalPlayed,
          { timeoutMs: 10_000 },
        );
        if (
          restored.isPlayed !== originalPlayed ||
          restored.playbackPositionSeconds !== 0
        ) {
          cleanupError ??= new Error(
            "Played state restoration could not be verified",
          );
        } else {
          console.log("Emby write smoke: played=restored");
        }
      } catch (error) {
        cleanupError ??= error;
      }
    }

    if (accessToken !== undefined && deviceId !== undefined) {
      try {
        await logoutEmbySession(
          serverBaseUrl,
          { accessToken, deviceId },
          { timeoutMs: 10_000 },
        );
        console.log("Emby write smoke: logout=ok");
      } catch (error) {
        cleanupError ??= error;
      }
    }
  }

  if (cleanupError !== undefined) throw cleanupError;
  if (operationError !== undefined) throw operationError;
}

await run();
