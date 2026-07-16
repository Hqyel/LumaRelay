export type EmbyAuthErrorKind =
  "invalid-response" | "not-found" | "timeout" | "unauthorized" | "unreachable";

export class EmbyAuthError extends Error {
  constructor(
    readonly kind: EmbyAuthErrorKind,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "EmbyAuthError";
  }
}
