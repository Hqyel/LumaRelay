import type { UserProfile } from "@newemby/contracts";

import { EmbyAuthError } from "./auth-errors.js";
import { EmbyUserDtoSchema, toUserProfile } from "./domain-adapters.js";
import { embyApiUrl } from "./url.js";

export interface CurrentUserRequest {
  accessToken: string;
  deviceId: string;
  serverId: string;
  userId: string;
}

export interface CurrentUserOptions {
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
}

function authorizationHeader(deviceId: string): string {
  const safeDeviceId = deviceId.replace(/["\\]/g, "");

  return (
    'Emby Client="NewEmby", Device="Gateway", ' +
    `DeviceId="${safeDeviceId}", Version="0.0.0"`
  );
}

export async function getAuthenticatedUser(
  baseUrl: string,
  input: CurrentUserRequest,
  options: CurrentUserOptions = {},
): Promise<UserProfile> {
  const fetcher = options.fetch ?? globalThis.fetch;
  let response: Response;

  try {
    response = await fetcher(
      embyApiUrl(baseUrl, `/Users/${encodeURIComponent(input.userId)}`),
      {
        headers: {
          accept: "application/json",
          "x-emby-authorization": authorizationHeader(input.deviceId),
          "x-emby-token": input.accessToken,
        },
        redirect: "error",
        signal: AbortSignal.timeout(options.timeoutMs ?? 5000),
      },
    );
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError")
      throw new EmbyAuthError("timeout", "Emby user request timed out", {
        cause: error,
      });

    throw new EmbyAuthError("unreachable", "Emby server is unreachable", {
      cause: error,
    });
  }

  if (
    response.status === 401 ||
    response.status === 403 ||
    response.status === 404
  )
    throw new EmbyAuthError("unauthorized", "The Emby session has expired");
  if (!response.ok)
    throw new EmbyAuthError("unreachable", "Emby user request failed");

  const parsed = EmbyUserDtoSchema.safeParse(await response.json());
  if (!parsed.success)
    throw new EmbyAuthError(
      "invalid-response",
      "Emby user response is invalid",
    );
  if (parsed.data.Policy?.IsDisabled === true)
    throw new EmbyAuthError("unauthorized", "The Emby user is disabled");

  return toUserProfile(parsed.data, input.serverId);
}
