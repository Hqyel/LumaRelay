import { randomUUID } from "node:crypto";

import {
  EmbyBaseItemDtoSchema,
  authenticateUser,
  embyApiUrl,
  getPlaybackOptions,
  loadPlaybackResource,
  logoutEmbySession,
  probeEmbyServer,
  reportPlaybackStarted,
  reportPlaybackStopped,
} from "../packages/emby-client/dist/index.js";

const baseUrl = process.env.LUMARELAY_EMBY_SMOKE_BASE_URL;
const username = process.env.LUMARELAY_EMBY_SMOKE_USERNAME;
const password = process.env.LUMARELAY_EMBY_SMOKE_PASSWORD;

if (!baseUrl) throw new Error("LUMARELAY_EMBY_SMOKE_BASE_URL is required");
if (!username) throw new Error("LUMARELAY_EMBY_SMOKE_USERNAME is required");
if (!password) throw new Error("LUMARELAY_EMBY_SMOKE_PASSWORD is required");

function authorizationHeader(deviceId) {
  const safeDeviceId = deviceId.replace(/["\\]/g, "");
  return (
    'Emby Client="LumaRelay", Device="Gateway", ' +
    `DeviceId="${safeDeviceId}", Version="0.0.0"`
  );
}

async function fetchJson(url, accessToken, deviceId) {
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
    throw new Error(`Emby session verification failed (${response.status})`);
  return response.json();
}

function playbackInput(authentication, deviceId, selection, playSessionId) {
  return {
    accessToken: authentication.accessToken,
    audioStreamIndex: selection.audioStreamIndex,
    deviceId,
    isPaused: false,
    itemId: selection.itemId,
    mediaSourceId: selection.mediaSourceId,
    playbackRate: 1,
    playSessionId,
    positionTicks: 0,
    subtitleStreamIndex: selection.subtitleStreamIndex,
  };
}

let authentication;
let deviceId;
let server;
let startedInput;

try {
  server = await probeEmbyServer(baseUrl, { timeoutMs: 10_000 });
  deviceId = randomUUID();
  authentication = await authenticateUser(
    server.baseUrl,
    { deviceId, password, username },
    { timeoutMs: 10_000 },
  );
  const itemsUrl = embyApiUrl(
    server.baseUrl,
    `/Users/${encodeURIComponent(authentication.user.userId)}/Items`,
  );
  itemsUrl.searchParams.set("Fields", "MediaSources");
  itemsUrl.searchParams.set("IncludeItemTypes", "Movie");
  itemsUrl.searchParams.set("Limit", "20");
  itemsUrl.searchParams.set("Recursive", "true");
  const payload = await fetchJson(
    itemsUrl,
    authentication.accessToken,
    deviceId,
  );
  const item = Array.isArray(payload?.Items)
    ? payload.Items.map((candidate) =>
        EmbyBaseItemDtoSchema.safeParse(candidate),
      ).find((candidate) => candidate.success)
    : undefined;
  if (!item?.success)
    throw new Error("No authorized movie was available for playback smoke");

  const mediaInput = {
    accessToken: authentication.accessToken,
    deviceId,
    serverId: server.serverId,
    userId: authentication.user.userId,
  };
  const sources = await getPlaybackOptions(
    server.baseUrl,
    mediaInput,
    item.data.Id,
    { timeoutMs: 10_000 },
  );
  const source =
    sources.find((candidate) => candidate.supportsDirectStream) ?? sources[0];
  if (source === undefined)
    throw new Error("The movie did not expose a playable media source");
  const selection = {
    audioStreamIndex: source.defaultAudioStreamIndex,
    itemId: item.data.Id,
    mediaSourceId: source.mediaSourceId,
    resumeTicks: 0,
    subtitleStreamIndex: source.defaultSubtitleStreamIndex,
  };
  const resource = await loadPlaybackResource(
    server.baseUrl,
    mediaInput,
    selection,
    {
      embyPlaySessionId: null,
      localPlaySessionId: randomUUID(),
    },
    "media",
    "bytes=0-0",
    { timeoutMs: 15_000 },
  );
  const reader = resource.response.body?.getReader();
  if (reader === undefined)
    throw new Error("The playback stream did not include a response body");
  const chunk = await reader.read();
  await reader.cancel();
  if (chunk.done || chunk.value.byteLength === 0)
    throw new Error("The playback stream returned no media bytes");

  startedInput = playbackInput(
    authentication,
    deviceId,
    { ...selection, itemId: item.data.Id },
    resource.embyPlaySessionId,
  );
  await reportPlaybackStarted(server.baseUrl, startedInput, {
    timeoutMs: 10_000,
  });
  const sessionsUrl = embyApiUrl(server.baseUrl, "/Sessions");
  const sessions = await fetchJson(
    sessionsUrl,
    authentication.accessToken,
    deviceId,
  );
  const active = Array.isArray(sessions)
    ? sessions.some(
        (session) =>
          session?.DeviceId === deviceId &&
          session?.NowPlayingItem?.Id === item.data.Id,
      )
    : false;
  if (!active && Array.isArray(sessions)) {
    const deviceSessions = sessions.filter(
      (session) => session?.DeviceId === deviceId,
    );
    const nowPlayingSessions = sessions.filter(
      (session) => session?.NowPlayingItem !== undefined,
    );
    const itemSessions = sessions.filter(
      (session) => session?.NowPlayingItem?.Id === item.data.Id,
    );
    console.log(
      `Emby playback session smoke: sessions=${sessions.length} ` +
        `device=${deviceSessions.length} playing=${nowPlayingSessions.length} ` +
        `item=${itemSessions.length}`,
    );
  }
  if (!active)
    throw new Error("Emby did not expose the active playback session");

  console.log(
    `Emby playback session smoke: stream=${resource.response.status} ` +
      "playing=visible stopped=pending",
  );
} finally {
  try {
    if (startedInput !== undefined && server !== undefined) {
      await reportPlaybackStopped(server.baseUrl, startedInput, {
        timeoutMs: 10_000,
      });
      console.log("Emby playback session smoke: stopped=ok");
    }
  } finally {
    if (authentication !== undefined && deviceId !== undefined) {
      await logoutEmbySession(
        baseUrl,
        { accessToken: authentication.accessToken, deviceId },
        { timeoutMs: 10_000 },
      );
      console.log("Emby playback session smoke: logout=ok");
    }
  }
}
