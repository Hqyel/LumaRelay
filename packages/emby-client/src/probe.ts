import type { ServerSummary } from "@lumarelay/contracts";

import { EmbyPublicInfoDtoSchema, toServerSummary } from "./domain-adapters.js";
import { EmbyProbeError } from "./errors.js";
import { embyApiUrl, normalizeEmbyBaseUrl } from "./url.js";

const TLS_ERROR_CODES = new Set([
  "CERT_HAS_EXPIRED",
  "DEPTH_ZERO_SELF_SIGNED_CERT",
  "ERR_TLS_CERT_ALTNAME_INVALID",
  "SELF_SIGNED_CERT_IN_CHAIN",
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
]);

export interface ProbeEmbyServerOptions {
  fetch?: typeof globalThis.fetch;
  now?: () => number;
  timeoutMs?: number;
}

function isAbortError(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === "AbortError" || error.name === "TimeoutError")
  );
}

function errorCode(error: unknown): string | undefined {
  if (!(error instanceof Error) || !("cause" in error)) return undefined;
  const cause = error.cause;

  if (typeof cause !== "object" || cause === null || !("code" in cause))
    return undefined;

  return typeof cause.code === "string" ? cause.code : undefined;
}

function classifyNetworkError(error: unknown): EmbyProbeError {
  if (isAbortError(error))
    return new EmbyProbeError("timeout", "Emby request timed out", {
      cause: error,
    });

  const code = errorCode(error);
  if (code !== undefined && TLS_ERROR_CODES.has(code))
    return new EmbyProbeError("tls", "Emby TLS certificate validation failed", {
      cause: error,
    });

  return new EmbyProbeError("unreachable", "Emby server is unreachable", {
    cause: error,
  });
}

function isSupportedVersion(version: string): boolean {
  const major = Number.parseInt(version.split(".")[0] ?? "", 10);
  return Number.isInteger(major) && major >= 4;
}

async function fetchWithTimeout(
  fetcher: typeof globalThis.fetch,
  url: URL,
  timeoutMs: number,
): Promise<Response> {
  const signal = AbortSignal.timeout(timeoutMs);

  try {
    return await fetcher(url, {
      headers: {
        accept: "application/json",
        "user-agent": "LumaRelay-Gateway/0.0.0",
      },
      redirect: "error",
      signal,
    });
  } catch (error) {
    throw classifyNetworkError(error);
  }
}

async function probePublicUsers(
  fetcher: typeof globalThis.fetch,
  baseUrl: string,
  timeoutMs: number,
): Promise<boolean> {
  try {
    const response = await fetchWithTimeout(
      fetcher,
      embyApiUrl(baseUrl, "/Users/Public"),
      timeoutMs,
    );
    return response.ok;
  } catch {
    return false;
  }
}

export async function probeEmbyServer(
  value: string,
  options: ProbeEmbyServerOptions = {},
): Promise<ServerSummary> {
  const baseUrl = normalizeEmbyBaseUrl(value);
  const fetcher = options.fetch ?? globalThis.fetch;
  const now = options.now ?? (() => performance.now());
  const timeoutMs = options.timeoutMs ?? 5000;
  const pingStartedAt = now();

  const pingResponse = await fetchWithTimeout(
    fetcher,
    embyApiUrl(baseUrl, "/System/Ping"),
    timeoutMs,
  );
  if (!pingResponse.ok)
    throw new EmbyProbeError("unreachable", "Emby Ping request failed");
  const latencyMs = Math.round(now() - pingStartedAt);

  const publicInfoResponse = await fetchWithTimeout(
    fetcher,
    embyApiUrl(baseUrl, "/System/Info/Public"),
    timeoutMs,
  );
  if (publicInfoResponse.status === 404)
    throw new EmbyProbeError(
      "unsupported-version",
      "Emby public information endpoint is unavailable",
    );
  if (!publicInfoResponse.ok)
    throw new EmbyProbeError(
      "unreachable",
      "Emby public information request failed",
    );

  const parsed = EmbyPublicInfoDtoSchema.safeParse(
    await publicInfoResponse.json(),
  );
  if (!parsed.success || !isSupportedVersion(parsed.data.Version))
    throw new EmbyProbeError(
      "unsupported-version",
      "Emby server version is unsupported",
    );

  const supportsPublicUsers = await probePublicUsers(
    fetcher,
    baseUrl,
    timeoutMs,
  );

  return toServerSummary(parsed.data, {
    baseUrl,
    capabilityFlags: {
      imageProcessing: true,
      publicInfo: true,
      publicUsers: supportsPublicUsers,
      ping: true,
      userAuthentication: true,
      userItems: true,
      userViews: true,
    },
    latencyMs,
  });
}
