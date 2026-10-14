export type ThemeMode = "light" | "dark" | "system";

export interface ThemeSettings {
  mode: ThemeMode;
  isCompact: boolean;
}

export interface WidgetPosition {
  x: number;
  y: number;
}
