import { WidgetItemConfig } from "./types";

/**
 * Registry of all available floating / utility widgets.
 * To register a future widget, add its metadata entry here.
 */
export const REGISTERED_WIDGETS: WidgetItemConfig[] = [
  {
    id: "clock",
    name: "System Clock",
    description: "Real-time 12h/24h software clock with timezone selector",
    icon: "🕒",
    defaultVisible: true,
  },
  {
    id: "themeToggle",
    name: "Theme Switcher",
    description: "Quick toggle for Bright (Light), Dark, and Auto (System) modes",
    icon: "🌓",
    defaultVisible: true,
  },
];
