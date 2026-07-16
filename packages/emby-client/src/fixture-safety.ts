const SENSITIVE_KEY_PATTERN =
  /(access.?key|api.?key|authorization|cookie|email|ip|password|path|remote.?endpoint|token|user.?id|username)/i;

const SENSITIVE_VALUE_PATTERNS = [
  /x-emby-token/i,
  /bearer\s+[a-z0-9._~-]+/i,
  /[a-z]:\\/i,
  /\/(home|media|mnt|users)\//i,
  /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i,
];

export function sanitizeFixture(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeFixture);
  if (typeof value !== "object" || value === null) {
    if (
      typeof value === "string" &&
      SENSITIVE_VALUE_PATTERNS.some((pattern) => pattern.test(value))
    )
      return "[REDACTED]";

    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      SENSITIVE_KEY_PATTERN.test(key) ? "[REDACTED]" : sanitizeFixture(entry),
    ]),
  );
}

export function assertFixtureIsSafe(value: unknown): void {
  const sanitized = sanitizeFixture(value);
  if (JSON.stringify(sanitized) !== JSON.stringify(value))
    throw new Error("Fixture contains a sensitive key or value");
}
