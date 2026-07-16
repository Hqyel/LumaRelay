import { randomUUID } from "node:crypto";

import {
  EmbyBaseItemDtoSchema,
  authenticateUser,
  buildEmbyImageUrl,
  embyApiUrl,
  getAuthenticatedUser,
  logoutEmbySession,
  probeEmbyServer,
} from "../packages/emby-client/dist/index.js";

const baseUrl = process.env.EMBY_SMOKE_BASE_URL;
const username = process.env.EMBY_SMOKE_USERNAME;
const password = process.env.EMBY_SMOKE_PASSWORD;

if (!baseUrl) throw new Error("EMBY_SMOKE_BASE_URL is required");
if ((username === undefined) !== (password === undefined))
  throw new Error(
    "EMBY_SMOKE_USERNAME and EMBY_SMOKE_PASSWORD must be provided together",
  );

function authorizationHeader(deviceId) {
  const safeDeviceId = deviceId.replace(/["\\]/g, "");
  return (
    'Emby Client="NewEmby", Device="Gateway", ' +
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
    throw new Error(
      `Authenticated Emby smoke request failed (${response.status})`,
    );
  return response.json();
}

function itemCollection(value) {
  if (typeof value !== "object" || value === null) return null;
  const items =
    "Items" in value && Array.isArray(value.Items) ? value.Items : null;
  const total =
    "TotalRecordCount" in value && Number.isInteger(value.TotalRecordCount)
      ? value.TotalRecordCount
      : null;
  return items === null || total === null ? null : { items, total };
}

let accessToken;
let deviceId;

try {
  const server = await probeEmbyServer(baseUrl, { timeoutMs: 10_000 });
  console.log(
    `Emby smoke: probe=ok version=${server.version} latencyMs=${server.latencyMs}`,
  );

  if (username === undefined || password === undefined) {
    console.log("Emby smoke: authenticated checks=skipped");
  } else {
    deviceId = randomUUID();
    const authentication = await authenticateUser(
      server.baseUrl,
      { deviceId, password, username },
      { timeoutMs: 10_000 },
    );
    accessToken = authentication.accessToken;
    await getAuthenticatedUser(
      server.baseUrl,
      {
        accessToken,
        deviceId,
        serverId: server.serverId,
        userId: authentication.user.userId,
      },
      { timeoutMs: 10_000 },
    );

    const viewsPayload = await fetchJson(
      embyApiUrl(
        server.baseUrl,
        `/Users/${encodeURIComponent(authentication.user.userId)}/Views`,
      ),
      accessToken,
      deviceId,
    );
    const views = itemCollection(viewsPayload);
    if (views === null) throw new Error("Emby views response is invalid");

    const itemsUrl = embyApiUrl(
      server.baseUrl,
      `/Users/${encodeURIComponent(authentication.user.userId)}/Items`,
    );
    itemsUrl.searchParams.set("IncludeItemTypes", "Movie,Series,Episode,Video");
    itemsUrl.searchParams.set("Recursive", "true");
    itemsUrl.searchParams.set("Fields", "ImageTags");
    itemsUrl.searchParams.set("ImageTypes", "Primary");
    itemsUrl.searchParams.set("Limit", "20");
    const itemsPayload = await fetchJson(itemsUrl, accessToken, deviceId);
    const items = itemCollection(itemsPayload);
    if (items === null) throw new Error("Emby items response is invalid");

    const imageItem = items.items
      .map((item) => EmbyBaseItemDtoSchema.safeParse(item))
      .find((result) => result.success && result.data.ImageTags?.Primary);
    if (!imageItem?.success)
      throw new Error(
        "No authorized media image was available for smoke testing",
      );
    const imageUrl = buildEmbyImageUrl(server.baseUrl, {
      imageTag: imageItem.data.ImageTags.Primary,
      imageType: "Primary",
      itemId: imageItem.data.Id,
      size: { maxWidth: 96 },
    });
    const imageResponse = await fetch(imageUrl, {
      headers: {
        "x-emby-authorization": authorizationHeader(deviceId),
        "x-emby-token": accessToken,
      },
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });
    if (!imageResponse.ok)
      throw new Error(`Emby image smoke failed (${imageResponse.status})`);
    await imageResponse.arrayBuffer();

    console.log(
      `Emby smoke: auth=ok views=${views.total} media=${items.total} image=ok`,
    );
  }
} finally {
  if (accessToken !== undefined && deviceId !== undefined) {
    await logoutEmbySession(
      baseUrl,
      { accessToken, deviceId },
      { timeoutMs: 10_000 },
    );
    console.log("Emby smoke: logout=ok");
  }
}
