import type { ServerSummary } from "@newemby/contracts";
import { z } from "zod";

import { EmbyProbeError } from "./errors.js";
import { embyApiUrl, normalizeEmbyBaseUrl } from "./url.js";

const PublicInfoSchema = z.object({
  Id: z.string().min(1),
  ServerName: z.string().min(1),
  Version: z.string().min(1),
});

const TLS_ERROR_CODES = new Set([
  "CERT_HAS_EXPIRED",
  "DEPTH_ZERO_SELF_SIGNED_CERT",
  "ERR_TLS_CERT_ALTNAME_INVALID",
  "SELF_SIGNED_CERT_IN_CHAIN",
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
]);

export interface ProbeEmbyServerOptions {
  fetch?: typeof globalThis.fetch;
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
        "user-agent": "NewEmby-Gateway/0.0.0",
      },
      redirect: "error",
      signal,
    });
  } catch (error) {
    throw classifyNetworkError(error);
  }
}

export async function probeEmbyServer(
  value: string,
  options: ProbeEmbyServerOptions = {},
): Promise<ServerSummary> {
  const baseUrl = normalizeEmbyBaseUrl(value);
  const fetcher = options.fetch ?? globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? 5000;
  const startedAt = performance.now();

  const pingResponse = await fetchWithTimeout(
    fetcher,
    embyApiUrl(baseUrl, "/System/Ping"),
    timeoutMs,
  );
  if (!pingResponse.ok)
    throw new EmbyProbeError("unreachable", "Emby Ping request failed");

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

  const parsed = PublicInfoSchema.safeParse(await publicInfoResponse.json());
  if (!parsed.success || !isSupportedVersion(parsed.data.Version))
    throw new EmbyProbeError(
      "unsupported-version",
      "Emby server version is unsupported",
    );

  return {
    serverId: parsed.data.Id,
    name: parsed.data.ServerName,
    version: parsed.data.Version,
    baseUrl,
    latencyMs: Math.round(performance.now() - startedAt),
    supportsHttps: new URL(baseUrl).protocol === "https:",
    capabilityFlags: {
      publicInfo: true,
      ping: true,
    },
  };
}
