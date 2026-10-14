import { TimezoneOption } from "./types";

/**
 * Curated list of popular global tech and business hubs.
 */
export const POPULAR_TIMEZONES: TimezoneOption[] = [
  { value: "local", label: "Local System Time", region: "Local" },
  { value: "UTC", label: "UTC (Universal Coordinated Time)", region: "Global" },
  { value: "America/New_York", label: "New York (US Eastern)", region: "Americas" },
  { value: "America/Chicago", label: "Chicago (US Central)", region: "Americas" },
  { value: "America/Denver", label: "Denver (US Mountain)", region: "Americas" },
  { value: "America/Los_Angeles", label: "Los Angeles (US Pacific)", region: "Americas" },
  { value: "America/Toronto", label: "Toronto (Canada)", region: "Americas" },
  { value: "America/Sao_Paulo", label: "São Paulo (Brazil)", region: "Americas" },
  { value: "Europe/London", label: "London (GMT / BST)", region: "Europe" },
  { value: "Europe/Paris", label: "Paris (CET / CEST)", region: "Europe" },
  { value: "Europe/Berlin", label: "Berlin (Germany)", region: "Europe" },
  { value: "Europe/Amsterdam", label: "Amsterdam (Netherlands)", region: "Europe" },
  { value: "Europe/Zurich", label: "Zurich (Switzerland)", region: "Europe" },
  { value: "Asia/Dubai", label: "Dubai (GST)", region: "Middle East" },
  { value: "Asia/Kolkata", label: "India (IST)", region: "Asia" },
  { value: "Asia/Singapore", label: "Singapore (SGT)", region: "Asia" },
  { value: "Asia/Hong_Kong", label: "Hong Kong (HKT)", region: "Asia" },
  { value: "Asia/Tokyo", label: "Tokyo (JST)", region: "Asia" },
  { value: "Asia/Seoul", label: "Seoul (KST)", region: "Asia" },
  { value: "Australia/Sydney", label: "Sydney (AEST / AEDT)", region: "Oceania" },
  { value: "Pacific/Auckland", label: "Auckland (NZST / NZDT)", region: "Oceania" },
];

/**
 * Returns formatted timezone abbreviation or offset string (e.g., "GMT+5:30", "EDT", "UTC").
 */
export function getTimezoneOffset(timezone: string, date: Date = new Date()): string {
  try {
    const tz = timezone === "local" ? undefined : timezone;
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "shortOffset",
    }).formatToParts(date);
    const tzPart = parts.find((p) => p.type === "timeZoneName");
    return tzPart ? tzPart.value : "";
  } catch {
    return "";
  }
}

/**
 * Returns user-friendly timezone name.
 */
export function getTimezoneDisplayLabel(timezone: string): string {
  if (timezone === "local") {
    try {
      const resolved = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const offset = getTimezoneOffset("local");
      return `Local (${resolved.replace(/_/g, " ")}${offset ? ` · ${offset}` : ""})`;
    } catch {
      return "Local System Time";
    }
  }

  const found = POPULAR_TIMEZONES.find((t) => t.value === timezone);
  if (found) {
    const offset = getTimezoneOffset(timezone);
    return `${found.label}${offset ? ` (${offset})` : ""}`;
  }

  const offset = getTimezoneOffset(timezone);
  return `${timezone.replace(/_/g, " ")}${offset ? ` (${offset})` : ""}`;
}

/**
 * Retrieves all browser-supported IANA timezones for search.
 */
export function getAllSupportedTimezones(): string[] {
  try {
    if (typeof Intl !== "undefined" && typeof (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf === "function") {
      return (Intl as unknown as { supportedValuesOf: (key: string) => string[] }).supportedValuesOf("timeZone");
    }
  } catch {
    // Fallback if not supported
  }
  return POPULAR_TIMEZONES.filter((t) => t.value !== "local").map((t) => t.value);
}
