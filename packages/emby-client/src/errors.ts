export type EmbyProbeErrorKind =
  "tls" | "timeout" | "unreachable" | "unsupported-version";

export class EmbyProbeError extends Error {
  readonly kind: EmbyProbeErrorKind;

  constructor(
    kind: EmbyProbeErrorKind,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "EmbyProbeError";
    this.kind = kind;
  }
}
