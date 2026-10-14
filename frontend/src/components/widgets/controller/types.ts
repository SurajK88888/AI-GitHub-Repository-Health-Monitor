export interface WidgetItemConfig {
  id: string;
  name: string;
  description: string;
  icon: string;
  defaultVisible: boolean;
}

export interface WidgetVisibilitySettings {
  masterEnabled: boolean;
  widgets: Record<string, boolean>;
}

export interface WidgetPosition {
  x: number;
  y: number;
}
