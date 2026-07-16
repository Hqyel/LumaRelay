import { EmbyAuthError } from "./auth-errors.js";
import { embyApiUrl } from "./url.js";

export interface LogoutSessionRequest {
  accessToken: string;
  deviceId: string;
}

export interface LogoutSessionOptions {
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

export async function logoutEmbySession(
  baseUrl: string,
  input: LogoutSessionRequest,
  options: LogoutSessionOptions = {},
): Promise<void> {
  const fetcher = options.fetch ?? globalThis.fetch;
  let response: Response;

  try {
    response = await fetcher(embyApiUrl(baseUrl, "/Sessions/Logout"), {
      headers: {
        accept: "application/json",
        "x-emby-authorization": authorizationHeader(input.deviceId),
        "x-emby-token": input.accessToken,
      },
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(options.timeoutMs ?? 5000),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError")
      throw new EmbyAuthError("timeout", "Emby logout timed out", {
        cause: error,
      });

    throw new EmbyAuthError("unreachable", "Emby server is unreachable", {
      cause: error,
    });
  }

  if (response.status === 401 || response.status === 403) return;
  if (!response.ok)
    throw new EmbyAuthError("unreachable", "Emby logout request failed");
}
