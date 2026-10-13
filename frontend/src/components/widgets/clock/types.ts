export type HourFormat = "12h" | "24h";

export interface ClockSettings {
  hourFormat: HourFormat;
  timezone: string; // "local" or IANA timezone string e.g. "UTC", "America/New_York"
  showSeconds: boolean;
  showDate: boolean;
  isCompact: boolean;
}

export interface WidgetPosition {
  x: number;
  y: number;
}

export interface TimezoneOption {
  value: string; // IANA timezone e.g. "America/New_York" or "local"
  label: string; // Display name e.g. "New York (EST/EDT)"
  region: string; // e.g. "Americas", "Europe", "Asia", "Global"
  offset?: string; // e.g. "GMT-4"
}
