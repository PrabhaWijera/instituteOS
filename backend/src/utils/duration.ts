/**
 * Parses a human-readable duration string into milliseconds.
 *
 * Supported units:
 *   s  → seconds   (e.g. "30s")
 *   m  → minutes   (e.g. "5m")
 *   h  → hours     (e.g. "2h")
 *   d  → days      (e.g. "30d")
 *   bare number    → treated as days (legacy, e.g. "30")
 *
 * @throws {Error} if the format is unrecognised
 */
export function parseDurationMs(value: string): number {
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d+(?:\.\d+)?)(s|m|h|d)?$/);
  if (!match) throw new Error(`Invalid duration: "${value}". Use formats like 5m, 2h, 1d, 30d`);

  const amount = parseFloat(match[1]);
  const unit = match[2] ?? 'd';

  switch (unit) {
    case 's': return amount * 1_000;
    case 'm': return amount * 60 * 1_000;
    case 'h': return amount * 60 * 60 * 1_000;
    case 'd': return amount * 24 * 60 * 60 * 1_000;
    default:  throw new Error(`Unknown unit "${unit}"`);
  }
}

/** Returns a new Date offset from `from` by the parsed duration. */
export function addDuration(from: Date, value: string): Date {
  return new Date(from.getTime() + parseDurationMs(value));
}
