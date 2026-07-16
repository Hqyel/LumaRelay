import type { UserProfile } from "@newemby/contracts";
import { z } from "zod";

import { EmbyAuthError } from "./auth-errors.js";
import { embyApiUrl } from "./url.js";

const AuthenticationResultSchema = z.object({
  AccessToken: z.string().min(1),
  ServerId: z.string().min(1),
  User: z.object({
    Id: z.string().min(1),
    Name: z.string().min(1),
    Policy: z
      .object({
        EnableContentDownloading: z.boolean().optional(),
        IsAdministrator: z.boolean().optional(),
        IsDisabled: z.boolean().optional(),
      })
      .optional(),
    PrimaryImageTag: z.string().min(1).nullish(),
  }),
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
    'Emby Client="NewEmby", Device="Gateway", ' +
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

  const isAdministrator = parsed.data.User.Policy?.IsAdministrator === true;

  return {
    accessToken: parsed.data.AccessToken,
    user: {
      name: parsed.data.User.Name,
      permissions: {
        canDownload: parsed.data.User.Policy?.EnableContentDownloading === true,
        canManageServer: isAdministrator,
        isAdministrator,
      },
      primaryImageTag: parsed.data.User.PrimaryImageTag ?? undefined,
      serverId: parsed.data.ServerId,
      userId: parsed.data.User.Id,
    },
  };
}
