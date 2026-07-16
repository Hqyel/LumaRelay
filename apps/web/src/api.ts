import type {
  CurrentServerResponse,
  CsrfResponse,
  ErrorEnvelope,
  LoginRequest,
  LoginResponse,
  LogoutResponse,
  MediaHomeResponse,
  MediaItemsQuery,
  MediaLibrariesResponse,
  MediaSearchResponse,
  PagedMediaResponse,
  ProbeServerResponse,
  PublicUsersResponse,
  SessionResponse,
} from "@newemby/contracts";

type UnauthorizedListener = () => void;

const unauthorizedListeners = new Set<UnauthorizedListener>();
let csrfTokenPromise: Promise<string> | undefined;

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly requestId: string,
    readonly statusCode = 0,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function errorFromResponse(response: Response): Promise<ApiError> {
  const fallbackRequestId = response.headers.get("x-request-id") ?? "unknown";

  try {
    const body = (await response.json()) as Partial<ErrorEnvelope>;
    if (
      typeof body.error?.code === "string" &&
      typeof body.error.message === "string"
    )
      return new ApiError(
        body.error.code,
        body.error.message,
        body.error.requestId ?? fallbackRequestId,
        response.status,
      );
  } catch {
    // Reverse proxies may replace JSON API errors with HTML or plain text.
  }

  return new ApiError(
    "HTTP_ERROR",
    `Gateway request failed with HTTP ${response.status}`,
    fallbackRequestId,
    response.status,
  );
}

async function fetchCsrfToken(): Promise<string> {
  const response = await fetch("/api/v1/security/csrf", {
    credentials: "include",
    headers: { accept: "application/json" },
  });
  if (!response.ok) throw await errorFromResponse(response);

  return ((await response.json()) as CsrfResponse).csrfToken;
}

function getCsrfToken(): Promise<string> {
  csrfTokenPromise ??= fetchCsrfToken().catch((error: unknown) => {
    csrfTokenPromise = undefined;
    throw error;
  });
  return csrfTokenPromise;
}

async function requestJson<T>(
  input: string,
  init?: RequestInit,
  retryCsrf = true,
): Promise<T> {
  const method = init?.method?.toUpperCase() ?? "GET";
  const headers = new Headers(init?.headers);
  headers.set("accept", "application/json");
  if (!["GET", "HEAD", "OPTIONS"].includes(method))
    headers.set("x-newemby-csrf", await getCsrfToken());

  const response = await fetch(input, {
    ...init,
    credentials: "include",
    headers,
  });

  if (!response.ok) {
    const error = await errorFromResponse(response);
    if (error.code === "CSRF_INVALID" && retryCsrf) {
      csrfTokenPromise = undefined;
      return requestJson(input, init, false);
    }
    if (error.code === "UNAUTHENTICATED")
      for (const listener of unauthorizedListeners) listener();
    throw error;
  }

  return (await response.json()) as T;
}

export function subscribeToUnauthorized(
  listener: UnauthorizedListener,
): () => void {
  unauthorizedListeners.add(listener);
  return () => unauthorizedListeners.delete(listener);
}

export function getCurrentServer(): Promise<CurrentServerResponse> {
  return requestJson("/api/v1/servers/current");
}

export function getCurrentUser(): Promise<SessionResponse> {
  return requestJson("/api/v1/auth/me");
}

export function getPublicUsers(): Promise<PublicUsersResponse> {
  return requestJson("/api/v1/auth/public-users");
}

export function getMediaHome(): Promise<MediaHomeResponse> {
  return requestJson("/api/v1/media/home");
}

export function getMediaLibraries(): Promise<MediaLibrariesResponse> {
  return requestJson("/api/v1/media/libraries");
}

export function getMediaItems(
  query: Partial<MediaItemsQuery>,
): Promise<PagedMediaResponse> {
  const params = new URLSearchParams();
  for (const [key, rawValue] of Object.entries(query)) {
    if (rawValue === undefined) continue;
    for (const value of Array.isArray(rawValue) ? rawValue : [rawValue])
      params.append(key, String(value));
  }
  return requestJson(`/api/v1/media/items?${params.toString()}`);
}

export function searchMedia(
  query: string,
  limit = 8,
): Promise<MediaSearchResponse> {
  const params = new URLSearchParams({ limit: String(limit), q: query });
  return requestJson(`/api/v1/media/search?${params.toString()}`);
}

export function mediaImageUrl(input: {
  dpr?: 1 | 2;
  imageType: "primary" | "backdrop" | "logo" | "thumb";
  itemId: string;
  preset: "poster" | "card" | "hero" | "avatar" | "logo";
  tag?: string;
}): string | undefined {
  if (input.tag === undefined) return undefined;
  const url = new URL(
    `/api/v1/media/items/${encodeURIComponent(input.itemId)}/images/${input.imageType}`,
    window.location.origin,
  );
  url.searchParams.set("dpr", String(input.dpr ?? 1));
  url.searchParams.set("preset", input.preset);
  url.searchParams.set("tag", input.tag);
  return `${url.pathname}${url.search}`;
}

export function login(credentials: LoginRequest): Promise<LoginResponse> {
  return requestJson("/api/v1/auth/login", {
    body: JSON.stringify(credentials),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
}

export async function logout(): Promise<LogoutResponse> {
  const response = await requestJson<LogoutResponse>("/api/v1/auth/logout", {
    method: "POST",
  });
  csrfTokenPromise = undefined;
  return response;
}

export function selectServer(baseUrl: string): Promise<ProbeServerResponse> {
  return requestJson("/api/v1/servers/select", {
    body: JSON.stringify({ baseUrl }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
}
