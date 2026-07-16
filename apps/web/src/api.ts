import type {
  CurrentServerResponse,
  ErrorEnvelope,
  LoginRequest,
  LoginResponse,
  ProbeServerResponse,
  PublicUsersResponse,
  SessionResponse,
} from "@newemby/contracts";

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly requestId: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function requestJson<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    credentials: "include",
    headers: {
      accept: "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const body = (await response.json()) as ErrorEnvelope;
    throw new ApiError(
      body.error.code,
      body.error.message,
      body.error.requestId,
    );
  }

  return (await response.json()) as T;
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

export function login(credentials: LoginRequest): Promise<LoginResponse> {
  return requestJson("/api/v1/auth/login", {
    body: JSON.stringify(credentials),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
}

export function selectServer(baseUrl: string): Promise<ProbeServerResponse> {
  return requestJson("/api/v1/servers/select", {
    body: JSON.stringify({ baseUrl }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
}
