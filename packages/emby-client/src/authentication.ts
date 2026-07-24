import type { UserProfile } from "@lumarelay/contracts";
import { z } from "zod";

import { EmbyAuthError } from "./auth-errors.js";
import { EmbyUserDtoSchema, toUserProfile } from "./domain-adapters.js";
import { embyApiUrl } from "./url.js";

const AuthenticationResultSchema = z.object({
  AccessToken: z.string().min(1),
  ServerId: z.string().min(1),
  User: EmbyUserDtoSchema,
});

export interface AuthenticateUserRequest {
  deviceId: string;
  password: string;
  username: string;
}

export interface AuthenticateUserResult {
  accessToken: string;
  user: UserProfile;
}

export interface AuthenticateUserOptions {
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
}

function authorizationHeader(deviceId: string): string {
  const safeDeviceId = deviceId.replace(/["\\]/g, "");

  return (
    'Emby Client="LumaRelay", Device="Gateway", ' +
    `DeviceId="${safeDeviceId}", Version="0.0.0"`
  );
}

export async function authenticateUser(
  baseUrl: string,
  credentials: AuthenticateUserRequest,
  options: AuthenticateUserOptions = {},
): Promise<AuthenticateUserResult> {
  const fetcher = options.fetch ?? globalThis.fetch;
  let response: Response;

  try {
    response = await fetcher(embyApiUrl(baseUrl, "/Users/AuthenticateByName"), {
      body: JSON.stringify({
        Pw: credentials.password,
        Username: credentials.username,
      }),
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "x-emby-authorization": authorizationHeader(credentials.deviceId),
      },
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(options.timeoutMs ?? 5000),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError")
      throw new EmbyAuthError("timeout", "Emby authentication timed out", {
        cause: error,
      });

    throw new EmbyAuthError(
      "unreachable",
      "Emby authentication server is unreachable",
      { cause: error },
    );
  }

  if (response.status === 401 || response.status === 403)
    throw new EmbyAuthError(
      "unauthorized",
      "The username or password is incorrect",
    );
  if (!response.ok)
    throw new EmbyAuthError("unreachable", "Emby authentication failed");

  const parsed = AuthenticationResultSchema.safeParse(await response.json());
  if (!parsed.success)
    throw new EmbyAuthError(
      "invalid-response",
      "Emby authentication response is invalid",
    );
  if (parsed.data.User.Policy?.IsDisabled === true)
    throw new EmbyAuthError("unauthorized", "The Emby user is disabled");

  return {
    accessToken: parsed.data.AccessToken,
    user: toUserProfile(parsed.data.User, parsed.data.ServerId),
  };
}
