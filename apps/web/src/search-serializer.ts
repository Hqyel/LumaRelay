export function parseRepeatedSearch(search: string): Record<string, unknown> {
  const parsed: Record<string, unknown> = {};
  for (const [key, value] of new URLSearchParams(search)) {
    const existing = parsed[key];
    if (existing === undefined) parsed[key] = value;
    else if (Array.isArray(existing)) existing.push(value);
    else parsed[key] = [existing, value];
  }
  return parsed;
}

export function stringifyRepeatedSearch(
  search: Record<string, unknown>,
): string {
  const params = new URLSearchParams();
  for (const [key, rawValue] of Object.entries(search)) {
    if (rawValue === undefined || rawValue === null) continue;
    const values = Array.isArray(rawValue) ? rawValue : [rawValue];
    for (const value of values) params.append(key, String(value));
  }
  const serialized = params.toString();
  return serialized === "" ? "" : `?${serialized}`;
}
