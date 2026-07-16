import type { PublicUser } from "@newemby/contracts";
import { z } from "zod";

import { EmbyAuthError } from "./auth-errors.js";
import { embyApiUrl } from "./url.js";

const PublicUserDtoSchema = z.object({
  HasPassword: z.boolean().default(false),
  Id: z.string().min(1),
  Name: z.string().min(1),
  PrimaryImageTag: z.string().min(1).nullish(),
});

const PublicUsersDtoSchema = z.array(PublicUserDtoSchema);

export interface PublicUserAvatar {
  body: Uint8Array;
  cacheControl?: string;
  contentType: string;
  etag?: string;
}

export interface PublicUserRequestOptions {
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
}

function authorizationHeader(): string {
  return (
    'Emby Client="NewEmby", Device="Gateway", ' +
    'DeviceId="newemby-gateway", Version="0.0.0"'
  );
}

async function request(
  baseUrl: string,
  path: string,
  options: PublicUserRequestOptions,
): Promise<Response> {
  const fetcher = options.fetch ?? globalThis.fetch;

  try {
    return await fetcher(embyApiUrl(baseUrl, path), {
      headers: {
        accept: "application/json, image/*",
        "x-emby-authorization": authorizationHeader(),
      },
      redirect: "error",
      signal: AbortSignal.timeout(options.timeoutMs ?? 5000),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError")
      throw new EmbyAuthError("timeout", "Emby request timed out", {
        cause: error,
      });

    throw new EmbyAuthError("unreachable", "Emby server is unreachable", {
      cause: error,
    });
  }
}

export async function listPublicUsers(
  baseUrl: string,
  options: PublicUserRequestOptions = {},
): Promise<PublicUser[]> {
  const response = await request(baseUrl, "/Users/Public", options);

  if (!response.ok)
    throw new EmbyAuthError("unreachable", "Emby public user request failed");

  const parsed = PublicUsersDtoSchema.safeParse(await response.json());
  if (!parsed.success)
    throw new EmbyAuthError(
      "invalid-response",
      "Emby public user response is invalid",
    );

  return parsed.data.map((user) => ({
    avatarUrl:
      user.PrimaryImageTag === undefined || user.PrimaryImageTag === null
        ? undefined
        : `/api/v1/auth/public-users/${encodeURIComponent(user.Id)}/avatar`,
    hasPassword: user.HasPassword,
    name: user.Name,
    primaryImageTag: user.PrimaryImageTag ?? undefined,
    userId: user.Id,
  }));
}

export async function loadPublicUserAvatar(
  baseUrl: string,
  userId: string,
  options: PublicUserRequestOptions = {},
): Promise<PublicUserAvatar> {
  const response = await request(
    baseUrl,
    `/Users/${encodeURIComponent(userId)}/Images/Primary`,
    options,
  );

  if (response.status === 404)
    throw new EmbyAuthError("not-found", "Public user avatar was not found");
  if (!response.ok)
    throw new EmbyAuthError("unreachable", "Public user avatar request failed");

  return {
    body: new Uint8Array(await response.arrayBuffer()),
    cacheControl: response.headers.get("cache-control") ?? undefined,
    contentType: response.headers.get("content-type") ?? "image/jpeg",
    etag: response.headers.get("etag") ?? undefined,
  };
}
